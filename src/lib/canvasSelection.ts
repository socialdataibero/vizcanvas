import { DAGNode } from "@/engine/types";
import {
  CanvasPoint,
  type NodePosition,
  type NodeSize,
  type SelectionRect,
} from "@/lib/canvasInteractionTypes";
import { CanvasViewportBounds } from "@/lib/canvasViewport";

export function buildNodeSelectionRect(
  node: DAGNode | undefined,
  position: NodePosition | undefined,
  size: NodeSize | undefined,
  fallbackWidth: number,
  fallbackHeight: number
): SelectionRect | null {
  if (!node || !position) return null;

  return {
    x: position.x,
    y: position.y,
    width: size?.width ?? fallbackWidth,
    height: size?.height ?? fallbackHeight,
  };
}

export function resolveSelectionScope(
  selectedNodeIds: string[],
  selectedNodeId: string | null,
  visibleNodes: Record<string, DAGNode>,
  nodeId?: string
): string[] {
  if (nodeId && selectedNodeIds.includes(nodeId) && selectedNodeIds.length > 1) {
    return selectedNodeIds;
  }
  if (nodeId) return [nodeId];
  if (selectedNodeIds.length > 0) return selectedNodeIds;
  return selectedNodeId && visibleNodes[selectedNodeId] ? [selectedNodeId] : [];
}

export function getSelectionBoundsFromRects(
  rects: SelectionRect[]
): CanvasViewportBounds | null {
  if (rects.length === 0) return null;

  return {
    minX: Math.min(...rects.map((rect) => rect.x)),
    minY: Math.min(...rects.map((rect) => rect.y)),
    maxX: Math.max(...rects.map((rect) => rect.x + rect.width)),
    maxY: Math.max(...rects.map((rect) => rect.y + rect.height)),
  };
}

export function buildMarqueeRect(
  start: CanvasPoint,
  current: CanvasPoint
): SelectionRect {
  const minX = Math.min(start.x, current.x);
  const minY = Math.min(start.y, current.y);
  const maxX = Math.max(start.x, current.x);
  const maxY = Math.max(start.y, current.y);

  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

export function isMarqueeClick(
  rect: SelectionRect,
  zoom: number,
  thresholdPx = 4
): boolean {
  return rect.width < thresholdPx / zoom && rect.height < thresholdPx / zoom;
}

export function getIntersectingSelectionNodeIds(
  nodeIds: string[],
  getNodeRect: (nodeId: string) => SelectionRect | null,
  selectionRect: SelectionRect,
  rectanglesOverlap: (
    a: SelectionRect,
    b: SelectionRect,
    padding?: number
  ) => boolean
): string[] {
  return nodeIds.filter((nodeId) => {
    const rect = getNodeRect(nodeId);
    if (!rect) return false;
    return rectanglesOverlap(selectionRect, rect);
  });
}

interface ResolveMarqueeSelectionParams {
  marqueeStart: CanvasPoint;
  marqueeCurrent: CanvasPoint;
  baseSelection: string[];
  zoom: number;
  visibleNodeIds: string[];
  getNodeRect: (nodeId: string) => SelectionRect | null;
  rectanglesOverlap: (
    a: SelectionRect,
    b: SelectionRect,
    padding?: number
  ) => boolean;
}

export function resolveMarqueeSelection({
  marqueeStart,
  marqueeCurrent,
  baseSelection,
  zoom,
  visibleNodeIds,
  getNodeRect,
  rectanglesOverlap,
}: ResolveMarqueeSelectionParams): string[] {
  const marqueeRect = buildMarqueeRect(marqueeStart, marqueeCurrent);

  if (isMarqueeClick(marqueeRect, zoom)) {
    return baseSelection;
  }

  const hits = getIntersectingSelectionNodeIds(
    visibleNodeIds,
    getNodeRect,
    marqueeRect,
    rectanglesOverlap
  );

  return [...baseSelection, ...hits];
}
