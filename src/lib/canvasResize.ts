import {
  type CanvasPoint,
  type NodePosition,
  type NodeSize,
  type ResizeDirection,
} from "@/lib/canvasInteractionTypes";

interface ComputeResizedNodeGeometryParams {
  direction: ResizeDirection;
  dragStartCanvas: CanvasPoint;
  dragStartNodePos: NodePosition;
  dragStartNodeSize: NodeSize;
  canvasPos: CanvasPoint;
  minWidth: number;
  minHeight: number;
}

export function computeResizedNodeGeometry({
  direction,
  dragStartCanvas,
  dragStartNodePos,
  dragStartNodeSize,
  canvasPos,
  minWidth,
  minHeight,
}: ComputeResizedNodeGeometryParams): {
  size: NodeSize;
  position: NodePosition;
} {
  const dx = canvasPos.x - dragStartCanvas.x;
  const dy = canvasPos.y - dragStartCanvas.y;

  let nextWidth = dragStartNodeSize.width;
  let nextHeight = dragStartNodeSize.height;
  let nextX = dragStartNodePos.x;
  let nextY = dragStartNodePos.y;

  if (direction.includes("e")) {
    nextWidth = Math.max(minWidth, dragStartNodeSize.width + dx);
  }
  if (direction.includes("s")) {
    nextHeight = Math.max(minHeight, dragStartNodeSize.height + dy);
  }
  if (direction.includes("w")) {
    nextWidth = Math.max(minWidth, dragStartNodeSize.width - dx);
    nextX = dragStartNodePos.x + (dragStartNodeSize.width - nextWidth);
  }
  if (direction.includes("n")) {
    nextHeight = Math.max(minHeight, dragStartNodeSize.height - dy);
    nextY = dragStartNodePos.y + (dragStartNodeSize.height - nextHeight);
  }

  return {
    size: {
      width: Math.round(nextWidth),
      height: Math.round(nextHeight),
    },
    position: {
      x: Math.round(nextX),
      y: Math.round(nextY),
    },
  };
}
