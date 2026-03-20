import { DAGNode } from "@/engine/types";
import { NodeType } from "@/types/nodes";

export type CanvasRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type NodePosition = { x: number; y: number };
type NodeSize = { width: number; height: number };

interface PlacementBaseParams {
  visibleNodes: Record<string, DAGNode>;
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  getNodeWidth: (type: string) => number;
  getNodeHeight: (type: string) => number;
}

interface PlacementParams extends PlacementBaseParams {
  preferredPosition: NodePosition;
}

interface FindAvailableNodePositionParams extends PlacementParams {
  type: NodeType;
  attempts?: number;
  stepX?: number;
  stepY?: number;
  collisionPadding?: number;
}

interface AddNodeWithCollisionAvoidanceParams extends PlacementParams {
  type: NodeType;
  onAddNode: (type: NodeType, position?: NodePosition) => string;
  attempts?: number;
  stepY?: number;
  collisionPadding?: number;
}

export const DOWNSTREAM_COLLISION_PADDING = 28;
export const DOWNSTREAM_COLLISION_STEP_Y = 56;

export function rectanglesOverlap(
  a: CanvasRect,
  b: CanvasRect,
  padding = 0
): boolean {
  return !(
    a.x + a.width + padding <= b.x ||
    b.x + b.width + padding <= a.x ||
    a.y + a.height + padding <= b.y ||
    b.y + b.height + padding <= a.y
  );
}

function collectOccupiedNodeRects({
  visibleNodes,
  nodePositions,
  nodeSizes,
  getNodeWidth,
  getNodeHeight,
}: PlacementBaseParams): CanvasRect[] {
  return Object.entries(visibleNodes)
    .filter(([nodeId]) => Boolean(nodePositions[nodeId]))
    .map(([nodeId, node]) => ({
      x: nodePositions[nodeId].x,
      y: nodePositions[nodeId].y,
      width: nodeSizes[nodeId]?.width ?? getNodeWidth(node.type),
      height: nodeSizes[nodeId]?.height ?? getNodeHeight(node.type),
    }));
}

export function findAvailableNodePosition({
  type,
  preferredPosition,
  visibleNodes,
  nodePositions,
  nodeSizes,
  getNodeWidth,
  getNodeHeight,
  attempts = 24,
  stepX = 20,
  stepY = 20,
  collisionPadding = DOWNSTREAM_COLLISION_PADDING,
}: FindAvailableNodePositionParams): NodePosition {
  const nextWidth = getNodeWidth(type);
  const nextHeight = getNodeHeight(type);
  const occupiedNodes = collectOccupiedNodeRects({
    visibleNodes,
    nodePositions,
    nodeSizes,
    getNodeWidth,
    getNodeHeight,
  });

  let candidate = { ...preferredPosition };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidateRect = {
      x: candidate.x,
      y: candidate.y,
      width: nextWidth,
      height: nextHeight,
    };
    const collision = occupiedNodes.some((rect) =>
      rectanglesOverlap(candidateRect, rect, collisionPadding)
    );

    if (!collision) {
      return candidate;
    }

    candidate = {
      x: preferredPosition.x + (attempt + 1) * stepX,
      y: preferredPosition.y + (attempt + 1) * stepY,
    };
  }

  return candidate;
}

export function addNodeWithCollisionAvoidance({
  type,
  preferredPosition,
  visibleNodes,
  nodePositions,
  nodeSizes,
  getNodeWidth,
  getNodeHeight,
  onAddNode,
  attempts = 24,
  stepY = DOWNSTREAM_COLLISION_STEP_Y,
  collisionPadding = DOWNSTREAM_COLLISION_PADDING,
}: AddNodeWithCollisionAvoidanceParams): string {
  const nextWidth = getNodeWidth(type);
  const nextHeight = getNodeHeight(type);
  const occupiedNodes = collectOccupiedNodeRects({
    visibleNodes,
    nodePositions,
    nodeSizes,
    getNodeWidth,
    getNodeHeight,
  });

  let candidate = { ...preferredPosition };
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const candidateRect = {
      x: candidate.x,
      y: candidate.y,
      width: nextWidth,
      height: nextHeight,
    };
    const collision = occupiedNodes.some((rect) =>
      rectanglesOverlap(candidateRect, rect, collisionPadding)
    );

    if (!collision) {
      return onAddNode(type, candidate);
    }

    candidate = {
      x: preferredPosition.x,
      y: preferredPosition.y + (attempt + 1) * stepY,
    };
  }

  return onAddNode(type, candidate);
}
