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

interface BuildCenteredDownstreamNodePositionParams {
  sourcePosition: NodePosition;
  sourceSize: NodeSize;
  targetHeight: number;
  targetType?: NodeType;
  gapX?: number;
}

interface BuildPortAlignedDownstreamNodePositionParams {
  sourcePosition: NodePosition;
  sourceSize: NodeSize;
  targetHeight: number;
  gapX?: number;
}

interface BuildLaneDownstreamNodePositionParams {
  sourcePosition: NodePosition;
  sourceSize: NodeSize;
  gapX?: number;
}

interface BuildFirstNodeVerticalPositionParams {
  surfaceHeight: number;
  nodeHeight: number;
  x?: number;
}

interface FindRightmostAnchorNodeIdParams {
  visibleNodes: Record<string, DAGNode>;
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  getNodeWidth: (type: string) => number;
}

interface FindPreferredAnchorNodeIdParams extends FindRightmostAnchorNodeIdParams {
  selectedNodeId?: string | null;
}

export const DOWNSTREAM_COLLISION_PADDING = 28;
export const DOWNSTREAM_COLLISION_STEP_Y = 56;
export const DOWNSTREAM_NODE_GAP_X = 96;
export const FIRST_NODE_X = 360;
export const FIRST_NODE_VIEWPORT_Y_RATIO = 0.5;
const TOP_HEAVY_NODE_TYPES = new Set<NodeType>(["group", "join", "distinct", "controls"]);
const DEFAULT_TARGET_VISUAL_ANCHOR_RATIO = 0.5;
const TOP_HEAVY_TARGET_VISUAL_ANCHOR_RATIO = 0.33;
const DOWNSTREAM_TOP_OFFSET_MIN = -16;
const DOWNSTREAM_TOP_OFFSET_MAX = 48;

function getSymmetricStepMultiplier(attempt: number): number {
  if (attempt === 0) return 0;
  const magnitude = Math.ceil(attempt / 2);
  return attempt % 2 === 1 ? -magnitude : magnitude;
}

export function buildFirstNodeVerticalPosition({
  surfaceHeight,
  nodeHeight,
  x = FIRST_NODE_X,
}: BuildFirstNodeVerticalPositionParams): NodePosition {
  return {
    x,
    y: Math.round(surfaceHeight * FIRST_NODE_VIEWPORT_Y_RATIO - nodeHeight / 2),
  };
}

export function buildCenteredDownstreamNodePosition({
  sourcePosition,
  sourceSize,
  targetHeight,
  targetType,
  gapX = DOWNSTREAM_NODE_GAP_X,
}: BuildCenteredDownstreamNodePositionParams): NodePosition {
  const visualAnchorRatio = targetType && TOP_HEAVY_NODE_TYPES.has(targetType)
    ? TOP_HEAVY_TARGET_VISUAL_ANCHOR_RATIO
    : DEFAULT_TARGET_VISUAL_ANCHOR_RATIO;
  const idealY = Math.round(
    sourcePosition.y + sourceSize.height / 2 - targetHeight * visualAnchorRatio
  );
  const minY = sourcePosition.y + DOWNSTREAM_TOP_OFFSET_MIN;
  const maxY = sourcePosition.y + DOWNSTREAM_TOP_OFFSET_MAX;

  return {
    x: sourcePosition.x + sourceSize.width + gapX,
    y: Math.max(minY, Math.min(maxY, idealY)),
  };
}

export function buildPortAlignedDownstreamNodePosition({
  sourcePosition,
  sourceSize,
  targetHeight,
  gapX = DOWNSTREAM_NODE_GAP_X,
}: BuildPortAlignedDownstreamNodePositionParams): NodePosition {
  return {
    x: sourcePosition.x + sourceSize.width + gapX,
    y: Math.round(sourcePosition.y + sourceSize.height / 2 - targetHeight / 2),
  };
}

export function buildLaneDownstreamNodePosition({
  sourcePosition,
  sourceSize,
  gapX = DOWNSTREAM_NODE_GAP_X,
}: BuildLaneDownstreamNodePositionParams): NodePosition {
  return {
    x: sourcePosition.x + sourceSize.width + gapX,
    y: sourcePosition.y,
  };
}

export function findRightmostAnchorNodeId({
  visibleNodes,
  nodePositions,
  nodeSizes,
  getNodeWidth,
}: FindRightmostAnchorNodeIdParams): string | null {
  let bestNodeId: string | null = null;
  let bestRightEdge = Number.NEGATIVE_INFINITY;

  for (const [nodeId, node] of Object.entries(visibleNodes)) {
    const position = nodePositions[nodeId];
    if (!position) continue;

    const width = nodeSizes[nodeId]?.width ?? getNodeWidth(node.type);
    const rightEdge = position.x + width;

    if (rightEdge > bestRightEdge) {
      bestRightEdge = rightEdge;
      bestNodeId = nodeId;
    }
  }

  return bestNodeId;
}

export function findPreferredAnchorNodeId({
  selectedNodeId,
  visibleNodes,
  nodePositions,
  nodeSizes,
  getNodeWidth,
}: FindPreferredAnchorNodeIdParams): string | null {
  if (selectedNodeId && visibleNodes[selectedNodeId] && nodePositions[selectedNodeId]) {
    return selectedNodeId;
  }

  return findRightmostAnchorNodeId({
    visibleNodes,
    nodePositions,
    nodeSizes,
    getNodeWidth,
  });
}

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

    const stepMultiplier = getSymmetricStepMultiplier(attempt + 1);
    candidate = {
      x: preferredPosition.x + Math.abs(stepMultiplier) * stepX,
      y: preferredPosition.y + stepMultiplier * stepY,
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

    const stepMultiplier = getSymmetricStepMultiplier(attempt + 1);
    candidate = {
      x: preferredPosition.x,
      y: preferredPosition.y + stepMultiplier * stepY,
    };
  }

  return onAddNode(type, candidate);
}
