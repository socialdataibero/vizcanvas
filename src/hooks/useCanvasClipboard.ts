import { RefObject, useCallback, useRef } from "react";
import { dagStoreApi } from "@/stores/dagStore";
import { DAGEdge, DAGNode } from "@/engine/types";
import { NodeConfig, NodeType } from "@/types/nodes";
import { deepClone } from "@/lib/utils";

type NodePosition = { x: number; y: number };
type NodeSize = { width: number; height: number };
type SelectionBounds = { minX: number; minY: number; maxX: number; maxY: number } | null;

interface CopiedNodePayload {
  nodes: Array<{
    sourceId: string;
    type: NodeType;
    config: NodeConfig;
    position: NodePosition;
    size?: NodeSize;
  }>;
  edges: Array<{
    from: string;
    to: string;
    toInputIndex: number;
  }>;
}

interface UseCanvasClipboardParams {
  canvasRef: RefObject<HTMLDivElement | null>;
  currentPageId: string;
  visibleNodes: Record<string, DAGNode>;
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  edges: DAGEdge[];
  pan: NodePosition;
  zoom: number;
  getNodeWidth: (type: string) => number;
  getNodeHeight: (type: string) => number;
  findAvailableNodePosition: (type: NodeType, preferredPosition: NodePosition) => NodePosition;
  onNodeMove: (nodeId: string, x: number, y: number) => void;
  onNodeResize: (nodeId: string, size: NodeSize, position?: NodePosition) => void;
  setNodeSelection: (nodeIds: string[]) => void;
  getSelectionBounds: (nodeIds: string[]) => SelectionBounds;
  getSelectionScope: () => string[];
}

export function useCanvasClipboard({
  canvasRef,
  currentPageId,
  visibleNodes,
  nodePositions,
  nodeSizes,
  edges,
  pan,
  zoom,
  getNodeWidth,
  getNodeHeight,
  findAvailableNodePosition,
  onNodeMove,
  onNodeResize,
  setNodeSelection,
  getSelectionBounds,
  getSelectionScope,
}: UseCanvasClipboardParams) {
  const copiedNodeRef = useRef<CopiedNodePayload | null>(null);

  const buildCopiedPayload = useCallback((nodeIds: string[]): CopiedNodePayload | null => {
    const scope = Array.from(new Set(nodeIds)).filter((nodeId) => Boolean(visibleNodes[nodeId] && nodePositions[nodeId]));
    if (scope.length === 0) return null;

    const scopeSet = new Set(scope);
    return {
      nodes: scope.map((nodeId) => ({
        sourceId: nodeId,
        type: visibleNodes[nodeId].type,
        config: deepClone(visibleNodes[nodeId].config),
        position: deepClone(nodePositions[nodeId]),
        size: nodeSizes[nodeId]
          ? {
              width: nodeSizes[nodeId].width,
              height: nodeSizes[nodeId].height,
            }
          : undefined,
      })),
      edges: edges
        .filter((edge) => scopeSet.has(edge.fromNodeId) && scopeSet.has(edge.toNodeId))
        .map((edge) => ({
          from: edge.fromNodeId,
          to: edge.toNodeId,
          toInputIndex: edge.toInputIndex,
        })),
    };
  }, [edges, nodePositions, nodeSizes, visibleNodes]);

  const instantiateCopiedPayload = useCallback((
    payload: CopiedNodePayload,
    preferredOrigin?: NodePosition
  ) => {
    if (payload.nodes.length === 0) return [];

    const minX = Math.min(...payload.nodes.map((node) => node.position.x));
    const minY = Math.min(...payload.nodes.map((node) => node.position.y));
    const maxX = Math.max(...payload.nodes.map((node) => node.position.x + (node.size?.width ?? getNodeWidth(node.type))));
    const maxY = Math.max(...payload.nodes.map((node) => node.position.y + (node.size?.height ?? getNodeHeight(node.type))));
    const payloadWidth = maxX - minX;
    const payloadHeight = maxY - minY;

    const rect = canvasRef.current?.getBoundingClientRect();
    const viewportOrigin = rect
      ? {
          x: (rect.width / 2 - pan.x) / zoom - payloadWidth / 2,
          y: (rect.height / 2 - pan.y) / zoom - payloadHeight / 2,
        }
      : { x: 240, y: 180 };

    const origin = preferredOrigin ?? viewportOrigin;
    const nodeIdMap: Record<string, string> = {};
    const newNodeIds: string[] = [];

    for (const copiedNode of payload.nodes) {
      const preferredPosition = {
        x: origin.x + (copiedNode.position.x - minX),
        y: origin.y + (copiedNode.position.y - minY),
      };
      const position = findAvailableNodePosition(copiedNode.type, preferredPosition);
      const newNodeId = dagStoreApi
        .getState()
        .addNode(copiedNode.type, deepClone(copiedNode.config), currentPageId);

      nodeIdMap[copiedNode.sourceId] = newNodeId;
      newNodeIds.push(newNodeId);
      onNodeMove(newNodeId, position.x, position.y);

      if (copiedNode.size) {
        onNodeResize(newNodeId, {
          width: copiedNode.size.width,
          height: copiedNode.size.height,
        });
      }
    }

    for (const edge of payload.edges) {
      const fromNodeId = nodeIdMap[edge.from];
      const toNodeId = nodeIdMap[edge.to];
      if (fromNodeId && toNodeId) {
        dagStoreApi.getState().addEdge(fromNodeId, toNodeId, edge.toInputIndex);
      }
    }

    setNodeSelection(newNodeIds);
    return newNodeIds;
  }, [
    canvasRef,
    currentPageId,
    findAvailableNodePosition,
    getNodeHeight,
    getNodeWidth,
    onNodeMove,
    onNodeResize,
    pan.x,
    pan.y,
    setNodeSelection,
    zoom,
  ]);

  const handleCopySelection = useCallback(async (nodeIds: string[]) => {
    const payload = buildCopiedPayload(nodeIds);
    if (!payload) return;

    copiedNodeRef.current = payload;

    try {
      await navigator.clipboard?.writeText(JSON.stringify(payload, null, 2));
    } catch (error) {
      console.error("Failed to copy nodes:", error);
    }
  }, [buildCopiedPayload]);

  const handleDuplicateSelection = useCallback((nodeIds: string[]) => {
    const scope = Array.from(new Set(nodeIds)).filter((nodeId) => Boolean(visibleNodes[nodeId] && nodePositions[nodeId]));
    if (scope.length === 0) return [];

    const scopeSet = new Set(scope);
    const nodeIdMap: Record<string, string> = {};
    const newNodeIds: string[] = [];

    for (const nodeId of scope) {
      const node = visibleNodes[nodeId];
      const originalPosition = nodePositions[nodeId];
      if (!node || !originalPosition) continue;

      const position = findAvailableNodePosition(node.type, {
        x: originalPosition.x + 40,
        y: originalPosition.y + 40,
      });

      const duplicateId = dagStoreApi
        .getState()
        .addNode(node.type, deepClone(node.config), currentPageId);

      nodeIdMap[nodeId] = duplicateId;
      newNodeIds.push(duplicateId);
      onNodeMove(duplicateId, position.x, position.y);

      if (nodeSizes[nodeId]) {
        onNodeResize(duplicateId, {
          width: nodeSizes[nodeId].width,
          height: nodeSizes[nodeId].height,
        });
      }
    }

    for (const edge of edges) {
      if (scopeSet.has(edge.fromNodeId) && scopeSet.has(edge.toNodeId)) {
        const fromNodeId = nodeIdMap[edge.fromNodeId];
        const toNodeId = nodeIdMap[edge.toNodeId];
        if (fromNodeId && toNodeId) {
          dagStoreApi.getState().addEdge(fromNodeId, toNodeId, edge.toInputIndex);
        }
      } else if (!scopeSet.has(edge.fromNodeId) && scopeSet.has(edge.toNodeId)) {
        const toNodeId = nodeIdMap[edge.toNodeId];
        if (toNodeId) {
          dagStoreApi.getState().addEdge(edge.fromNodeId, toNodeId, edge.toInputIndex);
        }
      }
    }

    setNodeSelection(newNodeIds);
    return newNodeIds;
  }, [
    currentPageId,
    edges,
    findAvailableNodePosition,
    nodePositions,
    nodeSizes,
    onNodeMove,
    onNodeResize,
    setNodeSelection,
    visibleNodes,
  ]);

  const handlePasteSelection = useCallback(() => {
    const payload = copiedNodeRef.current;
    if (!payload) return [];

    const bounds = getSelectionBounds(getSelectionScope());
    const preferredOrigin = bounds
      ? {
          x: bounds.minX + 40,
          y: bounds.minY + 40,
        }
      : undefined;

    return instantiateCopiedPayload(payload, preferredOrigin);
  }, [getSelectionBounds, getSelectionScope, instantiateCopiedPayload]);

  return {
    handleCopySelection,
    handleDuplicateSelection,
    handlePasteSelection,
  };
}
