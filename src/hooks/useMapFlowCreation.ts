"use client";

import { useCallback } from "react";
import { dagStoreApi } from "@/stores/dagStore";
import { DataTable } from "@/types/data";
import { ChartConfig, FromConfig, JoinConfig, NodeType } from "@/types/nodes";
import { DAGNode } from "@/engine/types";
import { SuggestedMapFlow } from "@/lib/columnSemantics";
import { chooseMapLabelColumn, chooseMetricColumn } from "@/lib/canvasAIHelpers";
import {
  buildFirstNodeVerticalPosition,
  findAvailableNodePosition,
  findRightmostAnchorNodeId,
} from "@/lib/canvasPlacement";
import { getCanvasNodeHeight, getCanvasNodeWidth } from "@/lib/canvasLayout";
import { getDefaultNodeConfig } from "@/lib/nodeConfig";

interface Params {
  addNode: (type: NodeType, config: object, pageId: string) => string;
  currentPageId: string;
  nodes: Record<string, DAGNode>;
  nodePositions: Record<string, { x: number; y: number }>;
  nodeSizes: Record<string, { width: number; height: number }>;
  tables: DataTable[];
  setNodePositions: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  setSelectedNode: (id: string | null) => void;
  onError?: (title: string, message: string) => void;
}

export function useMapFlowCreation({
  addNode,
  currentPageId,
  nodes,
  nodePositions,
  nodeSizes,
  tables,
  setNodePositions,
  setSelectedNode,
  onError,
}: Params) {
  return useCallback(
    (tableName: string, selectedSuggestion?: SuggestedMapFlow) => {
      const suggestion =
        selectedSuggestion &&
        (selectedSuggestion.geoTableName === tableName || selectedSuggestion.dataTableName === tableName)
          ? selectedSuggestion
          : tables.find((t) => t.name === tableName)?.suggestedMapFlows?.[0];

      if (!suggestion) {
        onError?.("No se pudo crear el mapa", "Necesito una tabla geográfica y otra tabular con una llave común para inferir el mapa automáticamente.");
        return;
      }

      const geoTable = tables.find((t) => t.name === suggestion.geoTableName);
      const dataTable = tables.find((t) => t.name === suggestion.dataTableName);
      if (!geoTable || !dataTable) {
        onError?.("Tablas no encontradas", "No se pudieron resolver las tablas necesarias para crear el flujo de mapa.");
        return;
      }

      const labelColumn = chooseMapLabelColumn(geoTable.columns, [suggestion.join.leftColumn])?.name ?? suggestion.join.leftColumn;
      const valueColumn = chooseMetricColumn(dataTable.columns, [suggestion.join.rightColumn])?.name;
      if (!valueColumn) {
        onError?.("Sin columna numérica", "No encontré una columna numérica para colorear el mapa en la tabla tabular.");
        return;
      }

      const pageNodes = Object.entries(nodes).filter(([, n]) => n.pageId === currentPageId);
      const visibleNodes = Object.fromEntries(pageNodes);
      const anchorNodeId = findRightmostAnchorNodeId({
        visibleNodes,
        nodePositions,
        nodeSizes,
        getNodeWidth: (t) => getCanvasNodeWidth(t as NodeType),
      }) ?? undefined;
      const anchorNode = anchorNodeId ? nodes[anchorNodeId] : undefined;
      const anchorPosition = anchorNodeId ? nodePositions[anchorNodeId] : undefined;
      const anchorWidth = anchorNodeId && anchorNode ? (nodeSizes[anchorNodeId]?.width ?? getCanvasNodeWidth(anchorNode.type)) : 0;
      const basePosition = !anchorNode || !anchorPosition
        ? buildFirstNodeVerticalPosition({ surfaceHeight: typeof window !== "undefined" ? window.innerHeight : 900, nodeHeight: getCanvasNodeHeight("join", "", {}) })
        : { x: anchorPosition.x + anchorWidth + 180, y: anchorPosition.y + 20 };

      const draftNodes: Record<string, DAGNode> = { ...visibleNodes };
      const draftPositions = { ...nodePositions };
      const draftSizes = { ...nodeSizes };
      let draftIndex = 0;

      const reservePosition = (type: NodeType, preferred: { x: number; y: number }) => {
        const position = findAvailableNodePosition({
          type,
          preferredPosition: preferred,
          visibleNodes: draftNodes,
          nodePositions: draftPositions,
          nodeSizes: draftSizes,
          getNodeWidth: (t) => getCanvasNodeWidth(t as NodeType),
          getNodeHeight: (t) => getCanvasNodeHeight(t as NodeType, "", {}),
        });
        const draftId = `draft-map-${draftIndex++}`;
        draftNodes[draftId] = { id: draftId, type, config: getDefaultNodeConfig(type), inputIds: [], result: null, status: "idle", pageId: currentPageId };
        draftPositions[draftId] = position;
        draftSizes[draftId] = { width: getCanvasNodeWidth(type), height: getCanvasNodeHeight(type, "", {}) };
        return position;
      };

      const geoPosition = reservePosition("from", { x: basePosition.x - 60, y: basePosition.y - 170 });
      const dataPosition = reservePosition("from", { x: basePosition.x - 60, y: basePosition.y + 150 });
      const joinPosition = reservePosition("join", { x: basePosition.x + 360, y: basePosition.y - 10 });
      const chartPosition = reservePosition("chart", { x: basePosition.x + 770, y: basePosition.y - 10 });

      const geoSourceId = addNode("from", { tableName: geoTable.name, filters: [] } as FromConfig, currentPageId);
      const dataSourceId = addNode("from", { tableName: dataTable.name, filters: [] } as FromConfig, currentPageId);
      const joinId = addNode("join", { joinType: "LEFT", leftColumn: suggestion.join.leftColumn, rightColumn: suggestion.join.rightColumn } as JoinConfig, currentPageId);
      const chartId = addNode("chart", { chartType: "choropleth", chartCatalogId: "world-choropleth", xColumn: labelColumn, yColumn: valueColumn } as ChartConfig, currentPageId);

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
    },
    [addNode, currentPageId, nodePositions, nodeSizes, nodes, setNodePositions, setSelectedNode, tables],
  );
}
