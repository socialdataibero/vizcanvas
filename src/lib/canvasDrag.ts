import {
  type CanvasPoint,
  type NodePosition,
} from "@/lib/canvasInteractionTypes";

interface ComputeDraggedPositionParams {
  canvasPos: CanvasPoint;
  dragStartCanvas: CanvasPoint;
  dragStartPosition: NodePosition;
}

export function computeDraggedPosition({
  canvasPos,
  dragStartCanvas,
  dragStartPosition,
}: ComputeDraggedPositionParams): NodePosition {
  return {
    x: dragStartPosition.x + (canvasPos.x - dragStartCanvas.x),
    y: dragStartPosition.y + (canvasPos.y - dragStartCanvas.y),
  };
}
