import { createStore, useStore } from "@/lib/createStore";
import { v4 as uuidv4 } from "uuid";
import { ControlsConfig, FromConfig, GroupConfig, NodeType, NodeConfig, QueryResult, SQLConfig } from "@/types/nodes";
import { DAGNode, DAGEdge, ExecutionContext } from "@/engine/types";
import { topologicalSortRecord, getDownstreamNodes, getUpstreamNodes } from "@/engine/dag";
import { getExecutor } from "@/engine/executor";
import { executeQueryLimited } from "@/db/duckdb";
import { dataStoreApi } from "@/stores/dataStore";

interface DAGState {
  nodes: Record<string, DAGNode>;
  edges: DAGEdge[];

  addNode: (type: NodeType, config: NodeConfig, pageId: string) => string;
  removeNode: (nodeId: string) => void;
  updateNodeConfig: (
    nodeId: string,
    config: Partial<NodeConfig>,
    options?: { autoExecute?: boolean }
  ) => void;
  addEdge: (fromNodeId: string, toNodeId: string, toInputIndex?: number) => string | null;
  removeEdge: (edgeId: string) => void;
  executeNode: (nodeId: string) => Promise<void>;
  executeAll: () => Promise<void>;
  executeDirty: (nodeId: string) => Promise<void>;
  getNodeResult: (nodeId: string) => QueryResult | null;
  getUpstreamNodeIds: (nodeId: string) => string[];
}

function resetNodeExecutionState(nodeId: string, state: DAGState) {
  return {
    nodes: {
      ...state.nodes,
      [nodeId]: {
        ...state.nodes[nodeId],
        status: "idle" as const,
        error: undefined,
        result: null,
      },
    },
  };
}

function resetDirtySubgraph(nodeId: string, state: DAGState, configPatch: Partial<NodeConfig>) {
  const dirtyIds = new Set<string>([nodeId]);
  getDownstreamNodes(nodeId, state.edges).forEach((id) => dirtyIds.add(id));

  const nodes = { ...state.nodes };
  dirtyIds.forEach((dirtyId) => {
    const existing = nodes[dirtyId];
    if (!existing) return;
    nodes[dirtyId] = {
      ...existing,
      status: "idle",
      error: undefined,
      result: null,
    };
  });

  nodes[nodeId] = {
    ...nodes[nodeId],
    config: { ...nodes[nodeId].config, ...configPatch } as NodeConfig,
  };

  return nodes;
}

const dagStore = createStore<DAGState>((set, get) => ({
  nodes: {},
  edges: [],

  addNode: (type, config, pageId) => {
    const id = uuidv4();
    const node: DAGNode = {
      id,
      type,
      config,
      inputIds: [],
      result: null,
      status: "idle",
      pageId,
    };
    set((state) => ({
      nodes: { ...state.nodes, [id]: node },
    }));
    return id;
  },

  removeNode: (nodeId) => {
    set((state) => {
      const { [nodeId]: _, ...rest } = state.nodes;
      return {
        nodes: rest,
        edges: state.edges.filter(
          (e) => e.fromNodeId !== nodeId && e.toNodeId !== nodeId
        ),
      };
    });
  },

  updateNodeConfig: (nodeId, configPatch, options) => {
    const node = get().nodes[nodeId];
    if (!node) return;
    const autoExecute = options?.autoExecute ?? true;

    set((state) => ({
      nodes: autoExecute
        ? {
            ...state.nodes,
            [nodeId]: {
              ...state.nodes[nodeId],
              config: { ...state.nodes[nodeId].config, ...configPatch } as NodeConfig,
            },
          }
        : resetDirtySubgraph(nodeId, state, configPatch),
    }));

    if (autoExecute) {
      void get().executeDirty(nodeId);
    }
  },

  addEdge: (fromNodeId, toNodeId, toInputIndex = 0) => {
    const { nodes, edges } = get();
    if (!nodes[fromNodeId] || !nodes[toNodeId]) return null;
    if (fromNodeId === toNodeId) return null;

    const downstream = getDownstreamNodes(toNodeId, edges);
    if (downstream.has(fromNodeId)) return null;

    const existingEdge = edges.find(
      (e) => e.toNodeId === toNodeId && e.toInputIndex === toInputIndex
    );

    const edgeId = uuidv4();
    const newEdge: DAGEdge = { id: edgeId, fromNodeId, toNodeId, toInputIndex };

    set((state) => {
      const filteredEdges = existingEdge
        ? state.edges.filter((e) => e.id !== existingEdge.id)
        : state.edges;
      const updatedEdges = [...filteredEdges, newEdge];

      return {
        edges: updatedEdges,
        nodes: {
          ...state.nodes,
          [toNodeId]: {
            ...state.nodes[toNodeId],
            inputIds: getUpstreamNodes(toNodeId, updatedEdges),
          },
        },
      };
    });

    get().executeDirty(toNodeId);
    return edgeId;
  },

  removeEdge: (edgeId) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) return;

    set((state) => ({
      edges: state.edges.filter((e) => e.id !== edgeId),
    }));

    get().executeDirty(edge.toNodeId);
  },

  executeNode: async (nodeId: string) => {
    const node = get().nodes[nodeId];
    if (!node) return;
    const state = get();
    const upstreamIds = getUpstreamNodes(nodeId, state.edges);
    const requiredInputs =
      node.type === "join"
        ? 2
        : ["group", "table", "chart", "distinct", "controls"].includes(node.type)
          ? 1
          : 0;

    if (node.type === "from") {
      const tableName = (node.config as FromConfig).tableName?.trim();
      if (!tableName) {
        set((currentState) => resetNodeExecutionState(nodeId, currentState));
        return;
      }

      const loadedTableNames = new Set(
        dataStoreApi.getState().tables.map((table) => table.name)
      );

      if (!loadedTableNames.has(tableName)) {
        set((currentState) => resetNodeExecutionState(nodeId, currentState));
        return;
      }
    }

    if (node.type === "sql" && !((node.config as SQLConfig).query || "").trim()) {
      set((currentState) => resetNodeExecutionState(nodeId, currentState));
      return;
    }

    if (node.type === "group") {
      const config = node.config as GroupConfig;
      const validAggregationCount =
        config.aggregations?.filter((aggregation) => aggregation.function && aggregation.column).length ?? 0;
      const hasOperation =
        (config.groupByColumns?.length ?? 0) > 0 ||
        validAggregationCount > 0;
      const configVersion = config.configVersion ?? 0;
      const lastRunVersion = config.lastRunVersion ?? 0;

      if (!hasOperation || lastRunVersion < configVersion) {
        set((currentState) => resetNodeExecutionState(nodeId, currentState));
        return;
      }
    }

    if (node.type === "controls") {
      const config = node.config as ControlsConfig;
      const validControlCount =
        config.controls?.filter((control) => {
          if (!control.column) return false;
          switch (control.type) {
            case "dropdown":
            case "text":
              return String(control.value ?? "").trim().length > 0;
            case "slider":
              if (Array.isArray(control.value)) {
                return control.value.length === 2 && control.value.every((value) => value !== undefined && value !== null && value !== "");
              }
              return control.value !== undefined && control.value !== null && control.value !== "";
            case "date":
              if (Array.isArray(control.value)) {
                return control.value.length === 2 && control.value.every((value) => String(value ?? "").trim().length > 0);
              }
              return String(control.value ?? "").trim().length > 0;
          }
        }).length ?? 0;

      if (validControlCount === 0) {
        set((currentState) => resetNodeExecutionState(nodeId, currentState));
        return;
      }
    }

    if (upstreamIds.length < requiredInputs) {
      set((currentState) => resetNodeExecutionState(nodeId, currentState));
      return;
    }

    if (
      requiredInputs > 0 &&
      upstreamIds.some((upstreamId) => {
        const upstreamNode = state.nodes[upstreamId];
        return !upstreamNode || upstreamNode.status !== "success" || !upstreamNode.result;
      })
    ) {
      set((currentState) => resetNodeExecutionState(nodeId, currentState));
      return;
    }

    set((state) => ({
      nodes: {
        ...state.nodes,
        [nodeId]: { ...state.nodes[nodeId], status: "running" as const, error: undefined },
      },
    }));

    try {
      const executor = getExecutor(node.type);
      const context: ExecutionContext = {
        executeQuery: executeQueryLimited,
        getNodeResult: (id) => get().nodes[id]?.result || null,
        getNodeConfig: (id) => get().nodes[id]?.config,
        getNodeType: (id) => get().nodes[id]?.type,
        getUpstreamNodes: (id) => getUpstreamNodes(id, get().edges),
      };

      const sql = await executor(node, context);

      if (!sql) {
        set((state) => ({
          nodes: {
            ...state.nodes,
            [nodeId]: { ...state.nodes[nodeId], result: null, status: "success" as const, error: undefined },
          },
        }));
        return;
      }

      const { nodes, edges } = get();
      const upstreamIds = getUpstreamNodes(nodeId, edges);
      const ctes: string[] = [];

      for (const upId of upstreamIds) {
        const upNode = nodes[upId];
        if (upNode?.result?.sql) {
          ctes.push(`"_node_${upId}" AS (${upNode.result.sql})`);
        }
      }

      const fullSql =
        ctes.length > 0 ? `WITH ${ctes.join(", ")} ${sql}` : sql;

      const result = await executeQueryLimited(fullSql);

      set((state) => ({
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...state.nodes[nodeId],
            // Persist the fully expanded SQL so downstream nodes can reuse
            // transitive dependencies without losing upstream CTEs.
            result: { ...result, sql: fullSql },
            status: "success" as const,
            error: undefined,
          },
        },
      }));
    } catch (err) {
      set((state) => ({
        nodes: {
          ...state.nodes,
          [nodeId]: {
            ...state.nodes[nodeId],
            result: null,
            status: "error" as const,
            error: String(err),
          },
        },
      }));
    }
  },

  executeDirty: async (nodeId: string) => {
    const { nodes, edges } = get();
    const dirty = new Set<string>([nodeId]);
    const downstream = getDownstreamNodes(nodeId, edges);
    downstream.forEach((id) => dirty.add(id));

    const sorted = topologicalSortRecord(nodes, edges).filter((id) =>
      dirty.has(id)
    );

    for (const id of sorted) {
      await get().executeNode(id);
    }
  },

  executeAll: async () => {
    const { nodes, edges } = get();
    const sorted = topologicalSortRecord(nodes, edges);
    for (const id of sorted) {
      await get().executeNode(id);
    }
  },

  getNodeResult: (nodeId) => {
    return get().nodes[nodeId]?.result || null;
  },

  getUpstreamNodeIds: (nodeId) => {
    return getUpstreamNodes(nodeId, get().edges);
  },
}));

export function useDagStore<S>(selector: (state: DAGState) => S): S {
  return useStore(dagStore, selector);
}

// Direct access for outside React (e.g., setTimeout callbacks)
export const dagStoreApi = dagStore;

// Expose for debugging in dev
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  (window as unknown as Record<string, unknown>).__dagStore = dagStore;
}
