"use client";

import React, { useEffect, useCallback, useRef, useState } from "react";
import { useDuckDB } from "@/hooks/useDuckDB";
import { canvasStoreApi, useCanvasStore } from "@/stores/canvasStore";
import { useDataStore } from "@/stores/dataStore";
import { useUIStore } from "@/stores/uiStore";
import { useDagStore, dagStoreApi } from "@/stores/dagStore";
import InfiniteCanvas from "./InfiniteCanvas";
import Toolbar from "./Toolbar";
import DataPanel from "@/components/panels/DataPanel";
import StylePanel from "@/components/panels/StylePanel";
import TitleCard from "@/components/panels/TitleCard";
import AIPanel from "@/components/panels/AIPanel";
import PageTabs from "@/components/panels/PageTabs";
import ShortcutsModal from "@/components/ui/ShortcutsModal";
import { NodeType, FromConfig, ColumnInfo, GroupConfig, ChartConfig, AggregationConfig, JoinConfig } from "@/types/nodes";
import { CanvasFrame } from "@/types/canvas";
import { DataTable } from "@/types/data";
import { DAGEdge, DAGNode } from "@/engine/types";
import { AIGraphPlan } from "@/lib/aiGraph";
import { buildAIPlanLayout } from "@/lib/aiPlanLayout";
import { buildDeletedPageState, buildDuplicatedPageState } from "@/lib/canvasPages";
import {
  buildCenteredDownstreamNodePosition,
  buildFirstNodeVerticalPosition,
  buildLaneDownstreamNodePosition,
  findPreferredAnchorNodeId,
  findRightmostAnchorNodeId,
  findAvailableNodePosition,
} from "@/lib/canvasPlacement";
import {
  buildFrameBoundsFromNodeRects,
  getBaseCanvasNodeHeight,
  getCanvasNodeHeight,
  getCanvasPlacementHeight,
  getCanvasNodeWidth,
  getLiveCanvasNodeRect,
  normalizeFrameMembership,
} from "@/lib/canvasLayout";
import { getDefaultNodeConfig } from "@/lib/nodeConfig";
import {
  buildPersistedAppState,
  parsePersistedAppState,
  readPersistedAppState,
  PersistedAppState,
  readPersistedUploadedTables,
  writePersistedAppState,
} from "@/lib/persistence";
import { SuggestedMapFlow, applyColumnSemanticsToColumns, getSuggestedMapFlows } from "@/lib/columnSemantics";
import { inferChartConfigDefaults } from "@/lib/aiChartDefaults";
import { getNodeTypeLabel } from "@/lib/utils";
import { useAutoSave } from "@/hooks/useAutoSave";
import { useCanvasHistory } from "@/hooks/useCanvasHistory";
import { useCanvasPresentation } from "@/hooks/useCanvasPresentation";
import { useVizCanvasIO } from "@/hooks/useVizCanvasIO";
import { v4 as uuidv4 } from "uuid";

const AI_SOURCE_NODE_TYPES: NodeType[] = [
  "from",
  "sql",
  "group",
  "join",
  "table",
  "distinct",
  "javascript",
  "controls",
];

function isReusableAISourceNode(node: DAGNode): boolean {
  return AI_SOURCE_NODE_TYPES.includes(node.type) && node.status !== "error";
}

function describeAINode(node: DAGNode): string {
  if (node.type === "from") {
    return `el nodo Source "${(node.config as FromConfig).tableName}"`;
  }

  return `el nodo ${getNodeTypeLabel(node.type)}`;
}

function isNumericColumn(column: ColumnInfo): boolean {
  return /int|decimal|double|float|real|numeric|number|hugeint|bigint|smallint|tinyint/i.test(column.type);
}

function isTemporalColumn(column: ColumnInfo): boolean {
  return /date|time|timestamp/i.test(column.type);
}

function isSpatialColumn(column: ColumnInfo): boolean {
  return column.role === "geometry" || column.role === "latitude" || column.role === "longitude";
}

function isCategoricalColumn(column: ColumnInfo): boolean {
  if (isSpatialColumn(column)) return false;
  return /char|text|string|uuid/i.test(column.type) || isTemporalColumn(column);
}

function chooseGroupByColumn(columns: ColumnInfo[]): string | undefined {
  return (
    columns.find((column) => isCategoricalColumn(column))?.name ??
    columns.find((column) => !isNumericColumn(column))?.name ??
    columns[0]?.name
  );
}

function chooseMetricColumn(columns: ColumnInfo[], excludedColumns: string[]): ColumnInfo | undefined {
  return (
    columns.find((column) => !excludedColumns.includes(column.name) && !isSpatialColumn(column) && isNumericColumn(column)) ??
    columns.find((column) => !excludedColumns.includes(column.name) && !isSpatialColumn(column))
  );
}

function chooseMapLabelColumn(columns: ColumnInfo[], excludedColumns: string[]): ColumnInfo | undefined {
  return (
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column) &&
      !isNumericColumn(column) &&
      /name|nom|label|region|state|country|province|geo/i.test(column.name)
    ) ??
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column) &&
      !isNumericColumn(column) &&
      column.role === "join_key"
    ) ??
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column) &&
      isCategoricalColumn(column)
    ) ??
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column)
    )
  );
}

function guessAggregation(column?: ColumnInfo): AggregationConfig["function"] {
  if (!column || !isNumericColumn(column)) {
    return "COUNT";
  }

  return /price|cost|rate|ratio|score|avg|mean|margin|pct|percent/i.test(column.name) ? "AVG" : "SUM";
}

function getAvailableColumnsForNode(node: DAGNode | undefined, tables: DataTable[]): ColumnInfo[] {
  if (!node) return [];
  if (node.result?.columns?.length) return node.result.columns;

  if (node.type === "from") {
    const tableName = (node.config as FromConfig).tableName;
    return tables.find((table) => table.name === tableName)?.columns ?? [];
  }

  return [];
}

function clearHydratedNodeExecution(nodes: Record<string, DAGNode>): Record<string, DAGNode> {
  return Object.fromEntries(
    Object.entries(nodes).map(([nodeId, node]) => [
      nodeId,
      {
        ...node,
        status: "idle" as const,
        error: undefined,
        result: null,
      },
    ])
  );
}

function hasReferencedSampleData(nodes: Record<string, DAGNode>): boolean {
  return Object.values(nodes).some(
    (node) =>
      node.type === "from" &&
      (node.config as FromConfig).tableName?.trim().toLowerCase() === "sample_data"
  );
}

function pickAIAutoConnectSource(
  nodes: Record<string, DAGNode>,
  currentPageId: string,
  createdNodeIds: Set<string>,
  selectedNodeId: string | null
): DAGNode | null {
  const candidates = Object.values(nodes).filter(
    (node) =>
      node.pageId === currentPageId &&
      !createdNodeIds.has(node.id) &&
      isReusableAISourceNode(node)
  );

  if (selectedNodeId) {
    const selectedCandidate = candidates.find((node) => node.id === selectedNodeId);
    if (selectedCandidate) return selectedCandidate;
  }

  const fromCandidates = candidates.filter((node) => node.type === "from");
  if (fromCandidates.length === 1) return fromCandidates[0];

  const successfulCandidates = candidates.filter((node) => node.status === "success" && node.result);
  if (successfulCandidates.length === 1) return successfulCandidates[0];

  if (candidates.length === 1) return candidates[0];

  return null;
}

export default function CanvasApp() {
  const { ready, loading, error } = useDuckDB();
  const canvasId = useCanvasStore((s) => s.id);
  const title = useCanvasStore((s) => s.title);
  const pages = useCanvasStore((s) => s.pages);
  const setTitle = useCanvasStore((s) => s.setTitle);
  const setCurrentPage = useCanvasStore((s) => s.setCurrentPage);
  const focusMode = useCanvasStore((s) => s.focusMode);
  const toggleFocusMode = useCanvasStore((s) => s.toggleFocusMode);
  const shortcutsModalOpen = useUIStore((s) => s.shortcutsModalOpen);
  const toggleShortcutsModal = useUIStore((s) => s.toggleShortcutsModal);
  const setSelectedNode = useUIStore((s) => s.setSelectedNode);
  const selectedNodeId = useUIStore((s) => s.selectedNodeId);
  const dataPanelOpen = useUIStore((s) => s.dataPanelOpen);
  const stylePanelOpen = useUIStore((s) => s.stylePanelOpen);
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const tables = useDataStore((s) => s.tables);
  const uploadFile = useDataStore((s) => s.uploadFile);
  const currentPageId = useCanvasStore((s) => s.currentPageId);
  const addNode = useDagStore((s) => s.addNode);
  const nodes = useDagStore((s) => s.nodes);
  const edges = useDagStore((s) => s.edges);

  // Node positions stored locally for the canvas
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({});
  const [nodeSizes, setNodeSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [frames, setFrames] = useState<CanvasFrame[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const sampleDataRestoreAttemptedRef = useRef(false);
  const framesRef = useRef<CanvasFrame[]>([]);

  useEffect(() => {
    framesRef.current = frames;
  }, [frames]);

  useEffect(() => {
    const nextPositionUpdates: Record<string, { x: number; y: number }> = {};

    setNodeSizes((prev) => {
      let changed = false;
      const next = { ...prev };

      for (const [nodeId, node] of Object.entries(nodes)) {
        const minHeight = getBaseCanvasNodeHeight(node.type);
        const currentSize = prev[nodeId];
        const currentHeight = currentSize?.height ?? minHeight;
        if (currentHeight >= minHeight) continue;

        next[nodeId] = {
          width: currentSize?.width ?? getCanvasNodeWidth(node.type),
          height: minHeight,
        };

        const currentPosition = nodePositions[nodeId];
        if (currentPosition) {
          nextPositionUpdates[nodeId] = {
            x: currentPosition.x,
            y: Math.round(currentPosition.y - (minHeight - currentHeight) / 2),
          };
        }
        changed = true;
      }

      return changed ? next : prev;
    });

    if (Object.keys(nextPositionUpdates).length > 0) {
      setNodePositions((prev) => ({
        ...prev,
        ...nextPositionUpdates,
      }));
    }
  }, [nodePositions, nodes]);

  const buildCurrentPersistedState = useCallback(() => buildPersistedAppState({
    nodePositions,
    nodeSizes,
    frames,
    canvas: {
      id: canvasId,
      title,
      pages,
      currentPageId,
      focusMode,
    },
    dag: {
      nodes,
      edges,
    },
  }), [canvasId, currentPageId, edges, focusMode, frames, nodePositions, nodeSizes, nodes, pages, title]);

  const persistCanvasStateNow = useCallback(() => {
    writePersistedAppState(buildCurrentPersistedState());
  }, [buildCurrentPersistedState]);

  const handleSaveSnapshot = useCallback(() => {
    const snapshotData = JSON.stringify(buildCurrentPersistedState());
    canvasStoreApi.getState().saveSnapshot(snapshotData, title);
  }, [buildCurrentPersistedState, title]);

  const buildHistoryState = useCallback(() => ({
    ...buildPersistedAppState({
      nodePositions,
      nodeSizes,
      frames,
      canvas: {
        id: canvasId,
        title,
        pages,
        currentPageId,
        focusMode,
      },
      dag: {
        nodes: clearHydratedNodeExecution(nodes),
        edges,
      },
    }),
    savedAt: "history",
  }), [canvasId, currentPageId, edges, focusMode, frames, nodePositions, nodeSizes, nodes, pages, title]);

  const applyPersistedState = useCallback((state: PersistedAppState) => {
    sampleDataRestoreAttemptedRef.current = false;
    setNodePositions(state.nodePositions);
    setNodeSizes(state.nodeSizes ?? {});
    const restoredNodes = clearHydratedNodeExecution(state.dag.nodes);
    const restoredFrames = normalizeFrameMembership(
      state.frames ?? [],
      restoredNodes,
      state.nodePositions,
      state.nodeSizes ?? {}
    );
    setFrames(restoredFrames);
    canvasStoreApi.setState({
      id: state.canvas.id,
      title: state.canvas.title,
      pages: state.canvas.pages,
      currentPageId: state.canvas.currentPageId,
      focusMode: state.canvas.focusMode,
    });
    dagStoreApi.setState({
      nodes: restoredNodes,
      edges: state.dag.edges,
    });
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleRestoreSnapshot = useCallback(async (snapshotId: string) => {
    const snapshot = canvasStoreApi.getState().snapshots.find((entry) => entry.id === snapshotId);
    if (!snapshot) {
      window.alert("No se encontro el snapshot seleccionado.");
      return;
    }

    const parsedState = parsePersistedAppState(snapshot.data);
    if (!parsedState) {
      window.alert("El snapshot guardado no tiene un formato valido.");
      return;
    }

    applyPersistedState(parsedState);
    await dagStoreApi.getState().executeAll();
  }, [applyPersistedState]);

  const { undoCanvas, redoCanvas } = useCanvasHistory({
    hydrated,
    buildHistoryState,
    applyHistoryState: applyPersistedState,
    onAfterRestore: async () => {
      await dagStoreApi.getState().executeAll();
    },
  });

  const {
    presentationMode,
    presentationFrameId,
    sharedNodeIds,
    presentationTitle,
    showPresentationTitle,
  } = useCanvasPresentation({
    hydrated,
    currentPageId,
    pages,
    frames,
    nodes,
    setCurrentPage: (pageId) => canvasStoreApi.getState().setCurrentPage(pageId),
  });

  const handleAddNode = useCallback((type: NodeType, position?: { x: number; y: number }) => {
    const config = getDefaultNodeConfig(type);
    const nodeId = addNode(type, config, currentPageId);
    const pageNodes = Object.entries(nodes).filter(([, node]) => node.pageId === currentPageId);
    const pageNodeCount = pageNodes.length;
    const pageVisibleNodes = Object.fromEntries(pageNodes);
    const anchorNodeId = findPreferredAnchorNodeId({
      selectedNodeId,
      visibleNodes: pageVisibleNodes,
      nodePositions,
      nodeSizes,
      getNodeWidth: (nodeType) => getCanvasNodeWidth(nodeType as NodeType),
    });
    const anchorNode = anchorNodeId ? nodes[anchorNodeId] : undefined;
    const anchorNodePosition = anchorNodeId ? nodePositions[anchorNodeId] : undefined;
    const pos = position || (
      pageNodeCount === 0 && typeof window !== "undefined"
        ? buildFirstNodeVerticalPosition({
            surfaceHeight: window.innerHeight,
            nodeHeight: getCanvasNodeHeight(type, "", {}),
          })
        : anchorNode &&
            anchorNode.pageId === currentPageId &&
            anchorNodeId &&
            anchorNodePosition
          ? findAvailableNodePosition({
              type,
              preferredPosition: buildCenteredDownstreamNodePosition({
                sourcePosition: anchorNodePosition,
                sourceSize: {
                  width: nodeSizes[anchorNodeId]?.width ?? getCanvasNodeWidth(anchorNode.type),
                  height: nodeSizes[anchorNodeId]?.height ?? getCanvasNodeHeight(anchorNode.type, "", {}),
                },
                targetHeight: getCanvasPlacementHeight(type),
                targetType: type,
              }),
              visibleNodes: pageVisibleNodes,
              nodePositions,
              nodeSizes,
              getNodeWidth: (nodeType) => getCanvasNodeWidth(nodeType as NodeType),
              getNodeHeight: (nodeType) => getCanvasNodeHeight(nodeType as NodeType, "", {}),
            })
        : { x: 200 + Math.random() * 400, y: 200 + Math.random() * 300 }
    );
    setNodePositions((prev) => ({ ...prev, [nodeId]: pos }));
    return nodeId;
  }, [addNode, currentPageId, nodePositions, nodeSizes, nodes, selectedNodeId]);

  const handleAddToolbarNode = useCallback((type: NodeType) => {
    const pageNodes = Object.entries(nodes).filter(([, node]) => node.pageId === currentPageId);
    const pageVisibleNodes = Object.fromEntries(pageNodes);
    const anchorNodeId = findPreferredAnchorNodeId({
      selectedNodeId,
      visibleNodes: pageVisibleNodes,
      nodePositions,
      nodeSizes,
      getNodeWidth: (nodeType) => getCanvasNodeWidth(nodeType as NodeType),
    }) ?? undefined;

    if (!anchorNodeId) {
      return handleAddNode(type);
    }

    const anchorNode = nodes[anchorNodeId];
    const anchorNodePosition = nodePositions[anchorNodeId];
    if (!anchorNode || anchorNode.pageId !== currentPageId || !anchorNodePosition) {
      return handleAddNode(type);
    }

    const preferredPosition = findAvailableNodePosition({
      type,
      preferredPosition: buildLaneDownstreamNodePosition({
        sourcePosition: anchorNodePosition,
        sourceSize: {
          width: nodeSizes[anchorNodeId]?.width ?? getCanvasNodeWidth(anchorNode.type),
          height: nodeSizes[anchorNodeId]?.height ?? getCanvasNodeHeight(anchorNode.type, "", {}),
        },
      }),
      visibleNodes: pageVisibleNodes,
      nodePositions,
      nodeSizes,
      getNodeWidth: (nodeType) => getCanvasNodeWidth(nodeType as NodeType),
      getNodeHeight: (nodeType) => getCanvasNodeHeight(nodeType as NodeType, "", {}),
    });

    return handleAddNode(type, preferredPosition);
  }, [currentPageId, handleAddNode, nodePositions, nodeSizes, nodes, selectedNodeId]);

  const handleSelectPage = useCallback((pageId: string) => {
    canvasStoreApi.getState().setCurrentPage(pageId);
    setSelectedNode(null);
  }, [setSelectedNode]);

  const handleAddPage = useCallback(() => {
    const pageId = canvasStoreApi.getState().addPage();
    setSelectedNode(null);
    return pageId;
  }, [setSelectedNode]);

  const handleRenamePage = useCallback((pageId: string, name: string) => {
    canvasStoreApi.getState().renamePage(pageId, name);
  }, []);

  const handleDeletePage = useCallback((pageId: string) => {
    const canvasState = canvasStoreApi.getState();
    const dagState = dagStoreApi.getState();
    const nextState = buildDeletedPageState({
      pageId,
      pages: canvasState.pages,
      currentPageId: canvasState.currentPageId,
      nodes: dagState.nodes,
      edges: dagState.edges,
      nodePositions,
      nodeSizes,
      frames,
      selectedNodeId,
    });

    if (!nextState) return;

    dagStoreApi.setState({
      nodes: nextState.nodes,
      edges: nextState.edges,
    });
    setNodePositions(nextState.nodePositions);
    setNodeSizes(nextState.nodeSizes);
    setFrames(nextState.frames);
    canvasStoreApi.setState({
      pages: nextState.pages,
      currentPageId: nextState.currentPageId,
    });

    if (nextState.shouldClearSelectedNode) {
      setSelectedNode(null);
    }
  }, [frames, nodePositions, nodeSizes, selectedNodeId, setSelectedNode]);

  const handleDuplicatePage = useCallback((pageId: string) => {
    const canvasState = canvasStoreApi.getState();
    const dagState = dagStoreApi.getState();
    const nextState = buildDuplicatedPageState({
      pageId,
      pages: canvasState.pages,
      nodes: dagState.nodes,
      edges: dagState.edges,
      nodePositions,
      nodeSizes,
      frames,
      generateId: uuidv4,
    });

    if (!nextState) return pageId;

    dagStoreApi.setState({
      nodes: nextState.nodes,
      edges: nextState.edges,
    });
    setNodePositions(nextState.nodePositions);
    setNodeSizes(nextState.nodeSizes);
    setFrames(nextState.frames);
    canvasStoreApi.setState({
      pages: nextState.pages,
      currentPageId: nextState.currentPageId,
    });

    setSelectedNode(null);
    setTimeout(() => {
      void dagStoreApi.getState().executeAll();
    }, 0);

    return nextState.newPageId;
  }, [frames, nodePositions, nodeSizes, setSelectedNode]);

  const {
    exportVizCanvas: handleExportVizCanvas,
    importVizCanvas: handleImportVizCanvas,
  } = useVizCanvasIO({
    title,
    buildCurrentPersistedState,
    applyPersistedState,
  });

  const handleAddFromNode = useCallback((tableName: string) => {
    const config: FromConfig = { tableName, filters: [] };
    const nodeId = addNode("from", config, currentPageId);
    const pageNodeCount = Object.values(nodes).filter((node) => node.pageId === currentPageId).length;
    const pos = pageNodeCount === 0 && typeof window !== "undefined"
      ? buildFirstNodeVerticalPosition({
          surfaceHeight: window.innerHeight,
          nodeHeight: getCanvasNodeHeight("from", "", {}),
        })
      : { x: 200 + Math.random() * 400, y: 200 + Math.random() * 300 };
    setNodePositions((prev) => ({ ...prev, [nodeId]: pos }));
    // Execute immediately
    setTimeout(() => dagStoreApi.getState().executeNode(nodeId), 100);
  }, [addNode, currentPageId, nodes]);

  const handleCreateMapFlow = useCallback((tableName: string, selectedSuggestion?: SuggestedMapFlow) => {
    const persistedRowsByTable = new Map(
      readPersistedUploadedTables().map((table) => [table.name, table.rows] as const)
    );
    const tablesWithRows = tables.map((table) => ({
      ...table,
      columns: applyColumnSemanticsToColumns(table.columns),
      rows: persistedRowsByTable.get(table.name),
    }));
    const suggestion =
      selectedSuggestion &&
      (selectedSuggestion.geoTableName === tableName || selectedSuggestion.dataTableName === tableName)
        ? selectedSuggestion
        : getSuggestedMapFlows(tablesWithRows, tableName)[0];

    if (!suggestion) {
      window.alert("No pude inferir automáticamente un mapa para esta tabla. Necesito una tabla geográfica y otra tabular con una llave común.");
      return;
    }

    const geoTable = tablesWithRows.find((table) => table.name === suggestion.geoTableName);
    const dataTable = tablesWithRows.find((table) => table.name === suggestion.dataTableName);
    if (!geoTable || !dataTable) {
      window.alert("No pude resolver las tablas necesarias para crear el flujo de mapa.");
      return;
    }

    const joinColumns = [suggestion.join.leftColumn, suggestion.join.rightColumn];
    const labelColumn =
      chooseMapLabelColumn(geoTable.columns, [suggestion.join.leftColumn])?.name ??
      suggestion.join.leftColumn;
    const valueColumn = chooseMetricColumn(dataTable.columns, [suggestion.join.rightColumn])?.name;

    if (!valueColumn) {
      window.alert("No encontré una columna numérica para colorear el mapa en la tabla tabular.");
      return;
    }

    const pageNodes = Object.entries(nodes).filter(([, node]) => node.pageId === currentPageId);
    const visibleNodes = Object.fromEntries(pageNodes);
    const rightmostAnchorNodeId = findRightmostAnchorNodeId({
      visibleNodes,
      nodePositions,
      nodeSizes,
      getNodeWidth: (nodeType) => getCanvasNodeWidth(nodeType as NodeType),
    });
    const anchorNodeId = rightmostAnchorNodeId ?? undefined;
    const anchorNode = anchorNodeId ? nodes[anchorNodeId] : undefined;
    const anchorPosition = anchorNodeId ? nodePositions[anchorNodeId] : undefined;
    const anchorWidth =
      anchorNodeId && anchorNode
        ? nodeSizes[anchorNodeId]?.width ?? getCanvasNodeWidth(anchorNode.type)
        : 0;
    const basePosition = !anchorNode || !anchorPosition
      ? buildFirstNodeVerticalPosition({
          surfaceHeight: typeof window !== "undefined" ? window.innerHeight : 900,
          nodeHeight: getCanvasNodeHeight("join", "", {}),
        })
      : {
          x: anchorPosition.x + anchorWidth + 180,
          y: anchorPosition.y + 20,
        };

    const draftNodes: Record<string, DAGNode> = { ...visibleNodes };
    const draftPositions = { ...nodePositions };
    const draftSizes = { ...nodeSizes };
    let draftIndex = 0;

    const reservePosition = (type: NodeType, preferredPosition: { x: number; y: number }) => {
      const position = findAvailableNodePosition({
        type,
        preferredPosition,
        visibleNodes: draftNodes,
        nodePositions: draftPositions,
        nodeSizes: draftSizes,
        getNodeWidth: (nodeType) => getCanvasNodeWidth(nodeType as NodeType),
        getNodeHeight: (nodeType) => getCanvasNodeHeight(nodeType as NodeType, "", {}),
      });

      const draftNodeId = `draft-map-${draftIndex++}`;
      draftNodes[draftNodeId] = {
        id: draftNodeId,
        type,
        config: getDefaultNodeConfig(type),
        inputIds: [],
        result: null,
        status: "idle",
        pageId: currentPageId,
      };
      draftPositions[draftNodeId] = position;
      draftSizes[draftNodeId] = {
        width: getCanvasNodeWidth(type),
        height: getCanvasNodeHeight(type, "", {}),
      };

      return position;
    };

    const geoPosition = reservePosition("from", {
      x: basePosition.x - 60,
      y: basePosition.y - 170,
    });
    const dataPosition = reservePosition("from", {
      x: basePosition.x - 60,
      y: basePosition.y + 150,
    });
    const joinPosition = reservePosition("join", {
      x: basePosition.x + 360,
      y: basePosition.y - 10,
    });
    const chartPosition = reservePosition("chart", {
      x: basePosition.x + 770,
      y: basePosition.y - 10,
    });

    const geoSourceId = addNode("from", { tableName: geoTable.name, filters: [] } as FromConfig, currentPageId);
    const dataSourceId = addNode("from", { tableName: dataTable.name, filters: [] } as FromConfig, currentPageId);
    const joinId = addNode("join", {
      joinType: "LEFT",
      leftColumn: suggestion.join.leftColumn,
      rightColumn: suggestion.join.rightColumn,
    } as JoinConfig, currentPageId);
    const chartId = addNode("chart", {
      chartType: "choropleth",
      chartCatalogId: "world-choropleth",
      xColumn: labelColumn,
      yColumn: valueColumn,
    } as ChartConfig, currentPageId);

    setNodePositions((prev) => ({
      ...prev,
      [geoSourceId]: geoPosition,
      [dataSourceId]: dataPosition,
      [joinId]: joinPosition,
      [chartId]: chartPosition,
    }));

    setTimeout(() => {
      dagStoreApi.getState().addEdge(geoSourceId, joinId, 0);
      dagStoreApi.getState().addEdge(dataSourceId, joinId, 1);
      dagStoreApi.getState().addEdge(joinId, chartId, 0);
      setSelectedNode(chartId);
      void dagStoreApi.getState().executeAll();
    }, 80);

    console.info("[Map Flow]", {
      geoTable: geoTable.name,
      dataTable: dataTable.name,
      joinColumns,
      labelColumn,
      valueColumn,
    });
  }, [addNode, currentPageId, nodePositions, nodeSizes, nodes, setSelectedNode, tables]);

  const handleNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    setNodePositions((prev) => ({ ...prev, [nodeId]: { x, y } }));
  }, []);

  const handleNodeResize = useCallback((
    nodeId: string,
    size: { width: number; height: number },
    position?: { x: number; y: number }
  ) => {
    setNodeSizes((prev) => ({ ...prev, [nodeId]: size }));
    if (position) {
      setNodePositions((prev) => ({ ...prev, [nodeId]: position }));
    }
  }, []);

  const createFrameFromNodeIds = useCallback((nodeIds: string[], name?: string) => {
    const scopedNodes = Array.from(new Set(nodeIds))
      .map((nodeId) => {
        const node = nodes[nodeId];
        if (!node || node.pageId !== currentPageId) return null;
        return getLiveCanvasNodeRect(node, nodeId, nodePositions, nodeSizes);
      })
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

    if (scopedNodes.length === 0) return null;

    const scopedNodeIds = scopedNodes.map((entry) => entry.id);
    const bounds = buildFrameBoundsFromNodeRects(scopedNodes);
    if (!bounds) return null;
    const frameId = uuidv4();
    const nextFrame: CanvasFrame = {
      id: frameId,
      pageId: currentPageId,
      name: name || `Frame ${frames.filter((frame) => frame.pageId === currentPageId).length + 1}`,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      nodeIds: scopedNodeIds,
    };

    setFrames((prev) => [...prev, nextFrame]);
    return frameId;
  }, [currentPageId, frames, nodePositions, nodeSizes, nodes]);

  const handleMoveFrame = useCallback((frameId: string, x: number, y: number) => {
    const currentFrame = framesRef.current.find((frame) => frame.id === frameId);
    if (!currentFrame) return;

    const nextX = Math.round(x);
    const nextY = Math.round(y);
    const deltaX = nextX - currentFrame.x;
    const deltaY = nextY - currentFrame.y;

    if (deltaX === 0 && deltaY === 0) return;

    setFrames((prev) => prev.map((frame) => (
      frame.id === frameId ? { ...frame, x: nextX, y: nextY } : frame
    )));

    if (currentFrame.nodeIds.length === 0) return;

    setNodePositions((prevPositions) => {
      const nextPositions = { ...prevPositions };
      for (const nodeId of currentFrame.nodeIds) {
        const current = prevPositions[nodeId];
        if (!current) continue;
        nextPositions[nodeId] = {
          x: Math.round(current.x + deltaX),
          y: Math.round(current.y + deltaY),
        };
      }
      return nextPositions;
    });
  }, []);

  const handleDeleteFrame = useCallback((frameId: string) => {
    setFrames((prev) => prev.filter((frame) => frame.id !== frameId));
  }, []);

  const handleRenameFrame = useCallback((frameId: string, name: string) => {
    setFrames((prev) => prev.map((frame) => (
      frame.id === frameId ? { ...frame, name: name.trim() || frame.name } : frame
    )));
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    dagStoreApi.getState().removeNode(nodeId);
    setNodePositions((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setNodeSizes((prev) => {
      const next = { ...prev };
      delete next[nodeId];
      return next;
    });
    setFrames((prev) =>
      prev.map((frame) => ({
        ...frame,
        nodeIds: frame.nodeIds.filter((memberNodeId) => memberNodeId !== nodeId),
      }))
    );
  }, []);

  useEffect(() => {
    if (!hydrated || typeof document === "undefined" || frames.length === 0) return;

    const frameRequest = window.requestAnimationFrame(() => {
      setFrames((prev) => {
        let hasChanges = false;

        const nextFrames = prev.map((frame) => {
          const memberRects = frame.nodeIds
            .map((nodeId) => {
              const node = nodes[nodeId];
              if (!node || node.pageId !== frame.pageId) return null;
              return getLiveCanvasNodeRect(node, nodeId, nodePositions, nodeSizes);
            })
            .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));

          const expectedBounds = buildFrameBoundsFromNodeRects(memberRects);
          if (!expectedBounds) return frame;

          if (
            expectedBounds.x === frame.x &&
            expectedBounds.y === frame.y &&
            expectedBounds.width === frame.width &&
            expectedBounds.height === frame.height
          ) {
            return frame;
          }

          hasChanges = true;
          return {
            ...frame,
            x: expectedBounds.x,
            y: expectedBounds.y,
            width: expectedBounds.width,
            height: expectedBounds.height,
          };
        });

        return hasChanges ? nextFrames : prev;
      });
    });

    return () => window.cancelAnimationFrame(frameRequest);
  }, [frames, hydrated, nodePositions, nodeSizes, nodes]);

  const applyAIPlan = useCallback(async (plan: AIGraphPlan) => {
    const issues: string[] = [];

    if (plan.nodes.length === 0) {
      return issues;
    }

    if (plan.nodes.length > 1 && plan.edges.length === 0) {
      issues.push("La IA creó varios nodos sin conexiones; puede que necesiten enlazarse manualmente.");
    }

    const existingNodesOnPage = Object.fromEntries(
      Object.entries(dagStoreApi.getState().nodes).filter(([, node]) => node.pageId === currentPageId)
    );
    const plannedPositions = buildAIPlanLayout(plan, {
      nodes: existingNodesOnPage,
      positions: nodePositions,
      sizes: nodeSizes,
    });
    const nodeIdMap: Record<string, string> = {};
    const planNodeById = new Map(plan.nodes.map((node) => [node.id, node]));
    const createdPositions: Record<string, { x: number; y: number }> = {};
    const createdNodeIds = new Set<string>();

    for (const plannedNode of plan.nodes) {
      const realNodeId = addNode(plannedNode.type, plannedNode.config, currentPageId);
      nodeIdMap[plannedNode.id] = realNodeId;
      createdNodeIds.add(realNodeId);
      createdPositions[realNodeId] = plannedPositions[plannedNode.id] ?? {
        x: 200 + Math.random() * 300,
        y: 200 + Math.random() * 200,
      };
    }

    setNodePositions((prev) => ({ ...prev, ...createdPositions }));

    const connectedInputsByNode = new Map<string, Set<number>>();
    const registerIncomingConnection = (nodeId: string, inputIndex: number) => {
      connectedInputsByNode.set(nodeId, new Set([...(connectedInputsByNode.get(nodeId) ?? []), inputIndex]));
    };

    for (const edge of plan.edges) {
      const currentNodes = dagStoreApi.getState().nodes;
      const fromNodeId = nodeIdMap[edge.from] ?? (currentNodes[edge.from] ? edge.from : undefined);
      const toNodeId = nodeIdMap[edge.to] ?? (currentNodes[edge.to] ? edge.to : undefined);
      if (!fromNodeId || !toNodeId) continue;
      if (!createdNodeIds.has(fromNodeId) && !createdNodeIds.has(toNodeId)) continue;
      const edgeId = dagStoreApi.getState().addEdge(fromNodeId, toNodeId, edge.toInputIndex);
      if (!edgeId) {
        issues.push(`No se pudo conectar ${edge.from} con ${edge.to}.`);
        continue;
      }
      registerIncomingConnection(toNodeId, edge.toInputIndex);
    }

    const autoConnectSource = pickAIAutoConnectSource(
      dagStoreApi.getState().nodes,
      currentPageId,
      createdNodeIds,
      selectedNodeId
    );

    for (const plannedNode of plan.nodes) {
      const realNodeId = nodeIdMap[plannedNode.id];
      if (!realNodeId || plannedNode.type === "from") continue;

      const connectedInputs = connectedInputsByNode.get(realNodeId) ?? new Set<number>();
      if (plannedNode.type === "join") {
        const missingInputIndex = [0, 1].find((inputIndex) => !connectedInputs.has(inputIndex));
        if (missingInputIndex === undefined) continue;
        if (!autoConnectSource) continue;

        const upstreamIds = dagStoreApi.getState().getUpstreamNodeIds(realNodeId);
        if (upstreamIds.includes(autoConnectSource.id)) continue;

        const edgeId = dagStoreApi.getState().addEdge(autoConnectSource.id, realNodeId, missingInputIndex);
        if (!edgeId) continue;

        registerIncomingConnection(realNodeId, missingInputIndex);
        issues.push(
          `Se conectó automáticamente ${describeAINode(autoConnectSource)} al nodo ${getNodeTypeLabel(plannedNode.type)}.`
        );
        continue;
      }

      if (connectedInputs.size > 0 || !autoConnectSource) continue;

      const edgeId = dagStoreApi.getState().addEdge(autoConnectSource.id, realNodeId, 0);
      if (!edgeId) continue;

      registerIncomingConnection(realNodeId, 0);
      issues.push(`Se conectó automáticamente ${describeAINode(autoConnectSource)} al nodo ${getNodeTypeLabel(plannedNode.type)}.`);
    }

    const unresolvedRoots = plan.nodes.filter((plannedNode) => {
      if (plannedNode.type === "from") return false;
      const realNodeId = nodeIdMap[plannedNode.id];
      if (!realNodeId) return false;
      const connectedInputs = connectedInputsByNode.get(realNodeId) ?? new Set<number>();
      return plannedNode.type === "join" ? connectedInputs.size < 2 : connectedInputs.size === 0;
    });

    if (unresolvedRoots.length > 0 && !autoConnectSource) {
      issues.push(
        "La IA no pudo identificar con claridad qué nodo existente debía alimentar el flujo nuevo."
      );
    }

    for (const plannedNode of plan.nodes) {
      const realNodeId = nodeIdMap[plannedNode.id];
      const createdNode = realNodeId ? dagStoreApi.getState().nodes[realNodeId] : undefined;
      if (!realNodeId || !createdNode) continue;

      if (createdNode.type === "group") {
        const upstreamIds = dagStoreApi.getState().getUpstreamNodeIds(realNodeId);
        const upstreamNode = upstreamIds[0] ? dagStoreApi.getState().nodes[upstreamIds[0]] : undefined;
        const availableColumns = getAvailableColumnsForNode(upstreamNode, tables);
        const currentConfig = createdNode.config as GroupConfig;
        const downstreamChart = plan.edges
          .filter((edge) => edge.from === plannedNode.id)
          .map((edge) => planNodeById.get(edge.to))
          .find((node): node is NonNullable<typeof node> => Boolean(node?.type === "chart"));
        const chartConfig = downstreamChart?.config as ChartConfig | undefined;

        let nextGroupByColumns = currentConfig.groupByColumns ?? [];

        if (nextGroupByColumns.length === 0 && availableColumns.length > 0) {
          const preferredGroupColumn =
            chartConfig?.xColumn && availableColumns.some((column) => column.name === chartConfig.xColumn)
              ? chartConfig.xColumn
              : chooseGroupByColumn(availableColumns);

          if (preferredGroupColumn) {
            nextGroupByColumns = [preferredGroupColumn];
          }
        }

        if (
          nextGroupByColumns.join("|") !== (currentConfig.groupByColumns ?? []).join("|")
        ) {
          dagStoreApi.getState().updateNodeConfig(realNodeId, {
            groupByColumns: nextGroupByColumns,
          } as Partial<GroupConfig>);
          issues.push("Se completó automáticamente la agrupación mínima del nodo group.");
        }
      }
    }

    await dagStoreApi.getState().executeAll();

    for (const plannedNode of plan.nodes) {
      const realNodeId = nodeIdMap[plannedNode.id];
      const createdNode = realNodeId ? dagStoreApi.getState().nodes[realNodeId] : undefined;
      if (!realNodeId || !createdNode || createdNode.type !== "chart") continue;

      const upstreamIds = dagStoreApi.getState().getUpstreamNodeIds(realNodeId);
      const upstreamNode = upstreamIds[0] ? dagStoreApi.getState().nodes[upstreamIds[0]] : undefined;
      const availableColumns = getAvailableColumnsForNode(upstreamNode, tables);
      const configPatch = inferChartConfigDefaults(createdNode.config as ChartConfig, availableColumns);

      if (Object.keys(configPatch).length === 0) continue;

      dagStoreApi.getState().updateNodeConfig(realNodeId, configPatch);
      issues.push("Se completó automáticamente la configuración mínima del nodo chart.");
    }

    const createdNodes = dagStoreApi.getState().nodes;
    const failedNodes = plan.nodes
      .map((plannedNode) => {
        const createdNode = createdNodes[nodeIdMap[plannedNode.id]];
        if (!createdNode || createdNode.status !== "error") return null;
        return `${getNodeTypeLabel(plannedNode.type)}: ${createdNode.error ?? "error desconocido"}`;
      })
      .filter((entry): entry is string => entry !== null);

    if (failedNodes.length > 0) {
      issues.push(`Algunos nodos necesitan revisión: ${failedNodes.join(" | ")}`);
    }

    const preferredFocusId = plan.focusNodeId ? nodeIdMap[plan.focusNodeId] : undefined;
    const fallbackFocusId = nodeIdMap[plan.nodes[plan.nodes.length - 1]?.id];
    setSelectedNode(preferredFocusId ?? fallbackFocusId ?? null);

    return issues;
  }, [addNode, currentPageId, nodePositions, nodeSizes, selectedNodeId, setSelectedNode, tables]);

  useEffect(() => {
    if (hydrated) return;
    const saved = readPersistedAppState();
    if (saved) {
      applyPersistedState(saved);
    }
    setHydrated(true);
  }, [applyPersistedState, hydrated]);

  useEffect(() => {
    if (!hydrated || !ready) return;
    if (sampleDataRestoreAttemptedRef.current) return;

    const currentNodes = dagStoreApi.getState().nodes;
    const sampleDataLoaded = tables.some((table) => table.name === "sample_data");
    if (!hasReferencedSampleData(currentNodes) || sampleDataLoaded) return;

    sampleDataRestoreAttemptedRef.current = true;
    void (async () => {
      try {
        const response = await fetch("/sample_data.csv", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`No se pudo cargar sample_data.csv (${response.status})`);
        }

        const blob = await response.blob();
        await uploadFile(new File([blob], "sample_data.csv", { type: "text/csv" }));
      } catch (restoreError) {
        console.error("Failed to restore sample_data after hydration:", restoreError);
        sampleDataRestoreAttemptedRef.current = false;
      }
    })();
  }, [hydrated, ready, tables, uploadFile]);

  useEffect(() => {
    if (!hydrated || !ready) return;
    void dagStoreApi.getState().executeAll();
  }, [hydrated, ready, tables]);

  useAutoSave(
    hydrated
      ? buildCurrentPersistedState()
      : null
  );

  // Keyboard shortcuts
  if (loading && !ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
          <p className="text-sm text-gray-500">Initializing DuckDB...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-4xl">⚠️</div>
          <p className="text-sm text-red-600">Error initializing: {error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {/* Canvas */}
      <InfiniteCanvas
        nodePositions={nodePositions}
        nodeSizes={nodeSizes}
        frames={frames}
        presentationMode={presentationMode}
        presentationFrameId={presentationFrameId}
        linkedNodeIds={sharedNodeIds}
        onNodeMove={handleNodeMove}
        onNodeResize={handleNodeResize}
        onDeleteNode={handleDeleteNode}
        onAddNode={handleAddNode}
        onCreateFrameFromSelection={createFrameFromNodeIds}
        onMoveFrame={handleMoveFrame}
        onDeleteFrame={handleDeleteFrame}
        onRenameFrame={handleRenameFrame}
        undoCanvas={undoCanvas}
        redoCanvas={redoCanvas}
        toggleFocusMode={toggleFocusMode}
        toggleShortcutsModal={toggleShortcutsModal}
        persistCanvasStateNow={persistCanvasStateNow}
      />

      {presentationMode && showPresentationTitle && presentationTitle && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex justify-center pt-4">
          <div className="rounded-full border border-white/80 bg-white/92 px-4 py-2 text-sm font-semibold text-slate-700 shadow-lg backdrop-blur">
            {presentationTitle}
          </div>
        </div>
      )}

      {/* Overlay UI - hidden in focus mode */}
      {!(focusMode || presentationMode) && (
        <>
          {/* Top Left - Title + Data Panel */}
          <div className="pointer-events-none absolute left-0 top-0 z-20 flex flex-col gap-2 p-3">
            <div className="pointer-events-auto">
              <TitleCard
                onSaveSnapshot={handleSaveSnapshot}
                onRestoreSnapshot={(snapshotId) => { void handleRestoreSnapshot(snapshotId); }}
                onExportVizCanvas={handleExportVizCanvas}
                onImportVizCanvas={handleImportVizCanvas}
              />
            </div>
            {dataPanelOpen && (
              <div className="pointer-events-auto">
                <DataPanel onAddFromNode={handleAddFromNode} onCreateMapFlow={handleCreateMapFlow} />
              </div>
            )}
          </div>

          {/* Top Right - Style Panel */}
          {stylePanelOpen && (
            <div className="pointer-events-none absolute right-0 top-0 z-20 p-3">
              <div className="pointer-events-auto">
                <StylePanel />
              </div>
            </div>
          )}

          {/* Bottom Center - Toolbar */}
          <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 pb-4">
            <div className="pointer-events-auto">
              <Toolbar onAddNode={handleAddToolbarNode} />
            </div>
          </div>

          {/* Page Tabs - Bottom Left */}
          <div className="pointer-events-none absolute bottom-0 left-0 z-20 pb-4 pl-3">
              <div className="pointer-events-auto">
                <PageTabs
                  onSelectPage={handleSelectPage}
                  onAddPage={handleAddPage}
                  onRenamePage={handleRenamePage}
                  onDeletePage={handleDeletePage}
                  onDuplicatePage={handleDuplicatePage}
                />
              </div>
            </div>

          {/* Right Side - AI Panel */}
          {aiPanelOpen && (
            <div className="pointer-events-none absolute bottom-0 right-0 z-20 p-3 pb-4">
              <div className="pointer-events-auto">
                <AIPanel onApplyPlan={applyAIPlan} />
              </div>
            </div>
          )}
        </>
      )}

      {/* Focus mode indicator */}
        {focusMode && !presentationMode && (
          <div className="absolute bottom-4 left-1/2 z-30 -translate-x-1/2">
            <button
              onClick={toggleFocusMode}
              className="rounded-full bg-black/70 px-4 py-2 text-xs text-white backdrop-blur hover:bg-black/80"
            >
              {`Press ${typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent) ? "\u2318" : "Ctrl"}+. to exit focus mode`}
            </button>
          </div>
        )}

      {/* Shortcuts Modal */}
      {shortcutsModalOpen && <ShortcutsModal onClose={toggleShortcutsModal} />}
    </div>
  );
}
