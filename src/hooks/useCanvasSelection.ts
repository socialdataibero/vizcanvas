import { useCallback, useMemo, useRef, useState } from "react";
import { CanvasFrame } from "@/types/canvas";
import { DAGNode } from "@/engine/types";
import {
  CanvasPoint,
  NodePosition,
  NodeSize,
  SelectionRect,
} from "@/lib/canvasInteractionTypes";
import {
  buildNodeSelectionRect,
  getSelectionBoundsFromRects,
  resolveSelectionScope,
} from "@/lib/canvasSelection";

function areNodeSelectionsEqual(left: string[], right: string[]) {
  return left.length === right.length && left.every((nodeId, index) => nodeId === right[index]);
}

interface UseCanvasSelectionParams {
  selectedNodeId: string | null;
  setSelectedNode: (nodeId: string | null) => void;
  visibleNodes: Record<string, DAGNode>;
  visibleFrames: CanvasFrame[];
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  getNodeWidth: (type: string) => number;
  getNodeHeight: (type: string) => number;
}

export function useCanvasSelection({
  selectedNodeId,
  setSelectedNode,
  visibleNodes,
  visibleFrames,
  nodePositions,
  nodeSizes,
  getNodeWidth,
  getNodeHeight,
}: UseCanvasSelectionParams) {
  const [rawSelectedNodeIds, setRawSelectedNodeIds] = useState<string[]>([]);
  const [rawSelectedFrameId, setRawSelectedFrameId] = useState<string | null>(null);
  const [marqueeStart, setMarqueeStart] = useState<CanvasPoint | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<CanvasPoint | null>(null);
  const marqueeBaseSelectionRef = useRef<string[]>([]);

  const selectedFrameId = useMemo(
    () =>
      rawSelectedFrameId && visibleFrames.some((frame) => frame.id === rawSelectedFrameId)
        ? rawSelectedFrameId
        : null,
    [rawSelectedFrameId, visibleFrames]
  );

  const selectedNodeIds = useMemo(() => {
    const visibleSelection = rawSelectedNodeIds.filter((nodeId) => Boolean(visibleNodes[nodeId]));
    if (visibleSelection.length > 1) {
      return visibleSelection;
    }

    return selectedNodeId && visibleNodes[selectedNodeId] ? [selectedNodeId] : [];
  }, [rawSelectedNodeIds, selectedNodeId, visibleNodes]);

  const setSelectedFrameId = useCallback((frameId: string | null) => {
    setRawSelectedFrameId(frameId);
  }, []);

  const setNodeSelection = useCallback((nodeIds: string[]) => {
    const deduped = Array.from(new Set(nodeIds)).filter((nodeId) => Boolean(visibleNodes[nodeId]));
    setRawSelectedNodeIds((current) => (
      areNodeSelectionsEqual(current, deduped) ? current : deduped
    ));
    setRawSelectedFrameId(null);
    setSelectedNode(deduped[deduped.length - 1] ?? null);
  }, [setSelectedNode, visibleNodes]);

  const clearNodeSelection = useCallback(() => {
    setRawSelectedNodeIds([]);
    setRawSelectedFrameId(null);
    setSelectedNode(null);
  }, [setSelectedNode]);

  const getNodeRect = useCallback((nodeId: string): SelectionRect | null => {
    const node = visibleNodes[nodeId];
    const position = nodePositions[nodeId];
    return buildNodeSelectionRect(
      node,
      position,
      nodeSizes[nodeId],
      node ? getNodeWidth(node.type) : 0,
      node ? getNodeHeight(node.type) : 0
    );
  }, [getNodeHeight, getNodeWidth, nodePositions, nodeSizes, visibleNodes]);

  const getSelectionScope = useCallback((nodeId?: string) => {
    return resolveSelectionScope(selectedNodeIds, selectedNodeId, visibleNodes, nodeId);
  }, [selectedNodeId, selectedNodeIds, visibleNodes]);

  const getSelectionBounds = useCallback((nodeIds: string[]) => {
    const rects = nodeIds
      .map((nodeId) => getNodeRect(nodeId))
      .filter((rect): rect is SelectionRect => Boolean(rect));

    return getSelectionBoundsFromRects(rects);
  }, [getNodeRect]);

  return {
    selectedNodeIds,
    selectedFrameId,
    setSelectedFrameId,
    marqueeStart,
    setMarqueeStart,
    marqueeCurrent,
    setMarqueeCurrent,
    marqueeBaseSelectionRef,
    setNodeSelection,
    clearNodeSelection,
    getNodeRect,
    getSelectionScope,
    getSelectionBounds,
  };
}
