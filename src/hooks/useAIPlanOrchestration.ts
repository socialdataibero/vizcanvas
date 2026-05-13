"use client";

import { useCallback } from "react";
import { dagStoreApi } from "@/stores/dagStore";
import { DataTable } from "@/types/data";
import { ChartConfig, GroupConfig, NodeType } from "@/types/nodes";
import { AIGraphPlan } from "@/lib/aiGraph";
import { buildAIPlanLayout } from "@/lib/aiPlanLayout";
import { inferChartConfigDefaults } from "@/lib/aiChartDefaults";
import { getNodeTypeLabel } from "@/lib/utils";
import {
  chooseGroupByColumn,
  describeAINode,
  getAvailableColumnsForNode,
  pickAIAutoConnectSource,
} from "@/lib/canvasAIHelpers";

interface Params {
  addNode: (type: NodeType, config: object, pageId: string) => string;
  currentPageId: string;
  nodePositions: Record<string, { x: number; y: number }>;
  nodeSizes: Record<string, { width: number; height: number }>;
  selectedNodeId: string | null;
  tables: DataTable[];
  setNodePositions: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  setSelectedNode: (id: string | null) => void;
}

export function useAIPlanOrchestration({
  addNode,
  currentPageId,
  nodePositions,
  nodeSizes,
  selectedNodeId,
  tables,
  setNodePositions,
  setSelectedNode,
}: Params) {
  return useCallback(
    async (plan: AIGraphPlan): Promise<string[]> => {
      const issues: string[] = [];

      if (plan.nodes.length === 0) return issues;
      if (plan.nodes.length > 1 && plan.edges.length === 0) {
        issues.push("La IA creó varios nodos sin conexiones; puede que necesiten enlazarse manualmente.");
      }

      const existingNodesOnPage = Object.fromEntries(
        Object.entries(dagStoreApi.getState().nodes).filter(([, n]) => n.pageId === currentPageId),
      );
      const plannedPositions = buildAIPlanLayout(plan, {
        nodes: existingNodesOnPage,
        positions: nodePositions,
        sizes: nodeSizes,
      });

      const nodeIdMap: Record<string, string> = {};
      const planNodeById = new Map(plan.nodes.map((n) => [n.id, n]));
      const createdPositions: Record<string, { x: number; y: number }> = {};
      const createdNodeIds = new Set<string>();

      for (const plannedNode of plan.nodes) {
        const realId = addNode(plannedNode.type, plannedNode.config, currentPageId);
        nodeIdMap[plannedNode.id] = realId;
        createdNodeIds.add(realId);
        createdPositions[realId] = plannedPositions[plannedNode.id] ?? {
          x: 200 + Math.random() * 300,
          y: 200 + Math.random() * 200,
        };
      }

      setNodePositions((prev) => ({ ...prev, ...createdPositions }));

      const connectedInputsByNode = new Map<string, Set<number>>();
      const registerInput = (nodeId: string, index: number) => {
        connectedInputsByNode.set(nodeId, new Set([...(connectedInputsByNode.get(nodeId) ?? []), index]));
      };

      for (const edge of plan.edges) {
        const currentNodes = dagStoreApi.getState().nodes;
        const fromId = nodeIdMap[edge.from] ?? (currentNodes[edge.from] ? edge.from : undefined);
        const toId = nodeIdMap[edge.to] ?? (currentNodes[edge.to] ? edge.to : undefined);
        if (!fromId || !toId) continue;
        if (!createdNodeIds.has(fromId) && !createdNodeIds.has(toId)) continue;
        const edgeId = dagStoreApi.getState().addEdge(fromId, toId, edge.toInputIndex);
        if (!edgeId) { issues.push(`No se pudo conectar ${edge.from} con ${edge.to}.`); continue; }
        registerInput(toId, edge.toInputIndex);
      }

      const autoSource = pickAIAutoConnectSource(dagStoreApi.getState().nodes, currentPageId, createdNodeIds, selectedNodeId);

      for (const plannedNode of plan.nodes) {
        const realId = nodeIdMap[plannedNode.id];
        if (!realId || plannedNode.type === "from") continue;

        const connectedInputs = connectedInputsByNode.get(realId) ?? new Set<number>();

        if (plannedNode.type === "join") {
          const missingIndex = [0, 1].find((i) => !connectedInputs.has(i));
          if (missingIndex === undefined || !autoSource) continue;
          const upstream = dagStoreApi.getState().getUpstreamNodeIds(realId);
          if (upstream.includes(autoSource.id)) continue;
          const edgeId = dagStoreApi.getState().addEdge(autoSource.id, realId, missingIndex);
          if (!edgeId) continue;
          registerInput(realId, missingIndex);
          issues.push(`Se conectó automáticamente ${describeAINode(autoSource)} al nodo ${getNodeTypeLabel(plannedNode.type)}.`);
          continue;
        }

        if (connectedInputs.size > 0 || !autoSource) continue;
        const edgeId = dagStoreApi.getState().addEdge(autoSource.id, realId, 0);
        if (!edgeId) continue;
        registerInput(realId, 0);
        issues.push(`Se conectó automáticamente ${describeAINode(autoSource)} al nodo ${getNodeTypeLabel(plannedNode.type)}.`);
      }

      const unresolvedRoots = plan.nodes.filter((pn) => {
        if (pn.type === "from") return false;
        const realId = nodeIdMap[pn.id];
        if (!realId) return false;
        const ci = connectedInputsByNode.get(realId) ?? new Set<number>();
        return pn.type === "join" ? ci.size < 2 : ci.size === 0;
      });
      if (unresolvedRoots.length > 0 && !autoSource) {
        issues.push("La IA no pudo identificar con claridad qué nodo existente debía alimentar el flujo nuevo.");
      }

      for (const plannedNode of plan.nodes) {
        const realId = nodeIdMap[plannedNode.id];
        const created = realId ? dagStoreApi.getState().nodes[realId] : undefined;
        if (!realId || !created || created.type !== "group") continue;

        const upstreamIds = dagStoreApi.getState().getUpstreamNodeIds(realId);
        const upstreamNode = upstreamIds[0] ? dagStoreApi.getState().nodes[upstreamIds[0]] : undefined;
        const availableCols = getAvailableColumnsForNode(upstreamNode, tables);
        const currentConfig = created.config as GroupConfig;
        const downstreamChart = plan.edges
          .filter((e) => e.from === plannedNode.id)
          .map((e) => planNodeById.get(e.to))
          .find((n): n is NonNullable<typeof n> => Boolean(n?.type === "chart"));
        const chartConfig = downstreamChart?.config as ChartConfig | undefined;

        let nextGroupByCols = currentConfig.groupByColumns ?? [];
        if (nextGroupByCols.length === 0 && availableCols.length > 0) {
          const preferred =
            chartConfig?.xColumn && availableCols.some((c) => c.name === chartConfig.xColumn)
              ? chartConfig.xColumn
              : chooseGroupByColumn(availableCols);
          if (preferred) nextGroupByCols = [preferred];
        }

        if (nextGroupByCols.join("|") !== (currentConfig.groupByColumns ?? []).join("|")) {
          dagStoreApi.getState().updateNodeConfig(realId, { groupByColumns: nextGroupByCols } as Partial<GroupConfig>);
          issues.push("Se completó automáticamente la agrupación mínima del nodo group.");
        }
      }

      await dagStoreApi.getState().executeAll();

      for (const plannedNode of plan.nodes) {
        const realId = nodeIdMap[plannedNode.id];
        const created = realId ? dagStoreApi.getState().nodes[realId] : undefined;
        if (!realId || !created || created.type !== "chart") continue;

        const upstreamIds = dagStoreApi.getState().getUpstreamNodeIds(realId);
        const upstreamNode = upstreamIds[0] ? dagStoreApi.getState().nodes[upstreamIds[0]] : undefined;
        const availableCols = getAvailableColumnsForNode(upstreamNode, tables);
        const configPatch = inferChartConfigDefaults(created.config as ChartConfig, availableCols);
        if (Object.keys(configPatch).length === 0) continue;
        dagStoreApi.getState().updateNodeConfig(realId, configPatch);
        issues.push("Se completó automáticamente la configuración mínima del nodo chart.");
      }

      const finalNodes = dagStoreApi.getState().nodes;
      const failedNodes = plan.nodes
        .map((pn) => {
          const n = finalNodes[nodeIdMap[pn.id]];
          if (!n || n.status !== "error") return null;
          return `${getNodeTypeLabel(pn.type)}: ${n.error ?? "error desconocido"}`;
        })
        .filter((e): e is string => e !== null);

      if (failedNodes.length > 0) {
        issues.push(`Algunos nodos necesitan revisión: ${failedNodes.join(" | ")}`);
      }

      const preferredFocusId = plan.focusNodeId ? nodeIdMap[plan.focusNodeId] : undefined;
      const fallbackFocusId = nodeIdMap[plan.nodes[plan.nodes.length - 1]?.id];
      setSelectedNode(preferredFocusId ?? fallbackFocusId ?? null);

      return issues;
    },
    [addNode, currentPageId, nodePositions, nodeSizes, selectedNodeId, setNodePositions, setSelectedNode, tables],
  );
}
