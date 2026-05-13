import { DAGNode } from "@/engine/types";
import { AIGraphPlan } from "@/lib/aiGraph";
import { getBaseCanvasNodeHeight, getCanvasNodeWidth } from "@/lib/canvasLayout";
import { rectanglesOverlap, CanvasRect } from "@/lib/canvasPlacement";

const AI_GRAPH_GAP_X = 96;
const AI_GRAPH_GAP_Y = 220;
const AI_FLOW_START_X = 120;
const AI_FLOW_START_Y = 140;
const AI_FLOW_BLOCK_GAP_X = 180;
const AI_FLOW_BLOCK_GAP_Y = 220;
const AI_FLOW_COLLISION_PADDING = 56;

type NodePosition = { x: number; y: number };
type NodeSize = { width: number; height: number };
type LayoutRect = CanvasRect;

interface ExistingLayoutContext {
  nodes: Record<string, DAGNode>;
  positions: Record<string, NodePosition>;
  sizes: Record<string, NodeSize>;
}

function buildPlanRects(
  plan: AIGraphPlan,
  positions: Record<string, NodePosition>
): LayoutRect[] {
  return plan.nodes.map((node) => ({
    x: positions[node.id]?.x ?? 0,
    y: positions[node.id]?.y ?? 0,
    width: getCanvasNodeWidth(node.type),
    height: getBaseCanvasNodeHeight(node.type),
  }));
}

function getBounds(rects: LayoutRect[]): LayoutRect | null {
  if (rects.length === 0) return null;

  const minX = Math.min(...rects.map((rect) => rect.x));
  const minY = Math.min(...rects.map((rect) => rect.y));
  const maxRight = Math.max(...rects.map((rect) => rect.x + rect.width));
  const maxBottom = Math.max(...rects.map((rect) => rect.y + rect.height));

  return {
    x: minX,
    y: minY,
    width: maxRight - minX,
    height: maxBottom - minY,
  };
}

function collectOccupiedRects(existingLayout?: ExistingLayoutContext): LayoutRect[] {
  if (!existingLayout) return [];

  return Object.entries(existingLayout.nodes).flatMap(([nodeId, node]) => {
    const position = existingLayout.positions[nodeId];
    if (!position) return [];

    const explicitSize = existingLayout.sizes[nodeId];
    return [{
      x: position.x,
      y: position.y,
      width: explicitSize?.width ?? getCanvasNodeWidth(node.type),
      height: explicitSize?.height ?? getBaseCanvasNodeHeight(node.type),
    }];
  });
}

function translatePositions(
  positions: Record<string, NodePosition>,
  offset: NodePosition
): Record<string, NodePosition> {
  return Object.fromEntries(
    Object.entries(positions).map(([nodeId, position]) => [
      nodeId,
      {
        x: Math.round(position.x + offset.x),
        y: Math.round(position.y + offset.y),
      },
    ])
  );
}

function buildRelativePlanLayout(plan: AIGraphPlan): Record<string, NodePosition> {
  const nodeOrder = new Map(plan.nodes.map((node, index) => [node.id, index]));
  const nodeById = new Map(plan.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  const levels = new Map<string, number>();

  for (const node of plan.nodes) {
    incoming.set(node.id, 0);
    outgoing.set(node.id, []);
    parents.set(node.id, []);
    levels.set(node.id, 0);
  }

  for (const edge of plan.edges) {
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) continue;
    outgoing.get(edge.from)?.push(edge.to);
    parents.get(edge.to)?.push(edge.from);
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }

  const queue = plan.nodes
    .filter((node) => (incoming.get(node.id) ?? 0) === 0)
    .map((node) => node.id)
    .sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));

  const topologicalOrder: string[] = [];

  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    topologicalOrder.push(nodeId);

    for (const childId of outgoing.get(nodeId) ?? []) {
      levels.set(childId, Math.max(levels.get(childId) ?? 0, (levels.get(nodeId) ?? 0) + 1));
      const nextIncoming = (incoming.get(childId) ?? 0) - 1;
      incoming.set(childId, nextIncoming);
      if (nextIncoming === 0) {
        queue.push(childId);
        queue.sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));
      }
    }
  }

  for (const node of plan.nodes) {
    if (!topologicalOrder.includes(node.id)) {
      topologicalOrder.push(node.id);
    }
  }

  const levelsUsed = Array.from(new Set(plan.nodes.map((node) => levels.get(node.id) ?? 0))).sort((a, b) => a - b);
  const nodesByLevel = new Map<number, string[]>();

  for (const level of levelsUsed) {
    nodesByLevel.set(level, []);
  }

  for (const nodeId of topologicalOrder) {
    const level = levels.get(nodeId) ?? 0;
    nodesByLevel.set(level, [...(nodesByLevel.get(level) ?? []), nodeId]);
  }

  const xByLevel = new Map<number, number>();
  let cursorX = 0;

  for (const level of levelsUsed) {
    xByLevel.set(level, cursorX);
    const maxWidth = Math.max(
      ...(nodesByLevel.get(level) ?? []).map((nodeId) => getCanvasNodeWidth(nodeById.get(nodeId)?.type ?? "table")),
      getCanvasNodeWidth("table")
    );
    cursorX += maxWidth + AI_GRAPH_GAP_X;
  }

  const usedRectsByLevel = new Map<number, LayoutRect[]>();
  const positions: Record<string, NodePosition> = {};

  for (const nodeId of topologicalOrder) {
    const level = levels.get(nodeId) ?? 0;
    const node = nodeById.get(nodeId);
    const nodeWidth = getCanvasNodeWidth(node?.type ?? "table");
    const nodeHeight = getBaseCanvasNodeHeight(node?.type ?? "table");
    const levelRects = usedRectsByLevel.get(level) ?? [];
    const parentIds = parents.get(nodeId) ?? [];
    const parentCenters = parentIds
      .map((parentId) => {
        const parentPosition = positions[parentId];
        const parentNode = nodeById.get(parentId);
        if (!parentPosition || !parentNode) return null;
        return parentPosition.y + getBaseCanvasNodeHeight(parentNode.type) / 2;
      })
      .filter((value): value is number => typeof value === "number");

    let y =
      parentCenters.length > 0
        ? parentCenters.reduce((sum, value) => sum + value, 0) / parentCenters.length - nodeHeight / 2
        : levelRects.length === 0
          ? 0
          : Math.max(...levelRects.map((rect) => rect.y + rect.height)) + AI_GRAPH_GAP_Y;

    let candidateRect: LayoutRect = {
      x: xByLevel.get(level) ?? 0,
      y,
      width: nodeWidth,
      height: nodeHeight,
    };

    while (levelRects.some((rect) => rectanglesOverlap(candidateRect, rect, AI_FLOW_COLLISION_PADDING))) {
      y = Math.max(
        ...levelRects
          .filter((rect) => rectanglesOverlap(candidateRect, rect, AI_FLOW_COLLISION_PADDING))
          .map((rect) => rect.y + rect.height)
      ) + AI_GRAPH_GAP_Y;
      candidateRect = {
        ...candidateRect,
        y,
      };
    }

    positions[nodeId] = {
      x: candidateRect.x,
      y: Math.round(candidateRect.y),
    };
    levelRects.push({
      ...candidateRect,
      y: Math.round(candidateRect.y),
    });
    usedRectsByLevel.set(level, levelRects);
  }

  const bounds = getBounds(buildPlanRects(plan, positions));
  if (!bounds) return positions;

  return translatePositions(positions, {
    x: -bounds.x,
    y: -bounds.y,
  });
}

function findFlowAnchor(
  plan: AIGraphPlan,
  relativePositions: Record<string, NodePosition>,
  occupiedRects: LayoutRect[]
): NodePosition {
  if (occupiedRects.length === 0) {
    return { x: AI_FLOW_START_X, y: AI_FLOW_START_Y };
  }

  const occupiedBounds = getBounds(occupiedRects);
  const planBounds = getBounds(buildPlanRects(plan, relativePositions));

  if (!occupiedBounds || !planBounds) {
    return { x: AI_FLOW_START_X, y: AI_FLOW_START_Y };
  }

  const candidateAnchors: NodePosition[] = [
    {
      x: occupiedBounds.x + occupiedBounds.width + AI_FLOW_BLOCK_GAP_X,
      y: Math.max(AI_FLOW_START_Y, occupiedBounds.y),
    },
    {
      x: Math.max(AI_FLOW_START_X, occupiedBounds.x),
      y: occupiedBounds.y + occupiedBounds.height + AI_FLOW_BLOCK_GAP_Y,
    },
  ];

  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      candidateAnchors.push({
        x: occupiedBounds.x + occupiedBounds.width + AI_FLOW_BLOCK_GAP_X + column * (planBounds.width + AI_FLOW_BLOCK_GAP_X),
        y: Math.max(AI_FLOW_START_Y, occupiedBounds.y) + row * (planBounds.height + AI_FLOW_BLOCK_GAP_Y),
      });
    }
  }

  const relativeRects = buildPlanRects(plan, relativePositions);

  for (const anchor of candidateAnchors) {
    const translatedRects = relativeRects.map((rect) => ({
      ...rect,
      x: rect.x + anchor.x,
      y: rect.y + anchor.y,
    }));

    const overlapsExisting = translatedRects.some((rect) =>
      occupiedRects.some((occupiedRect) =>
        rectanglesOverlap(rect, occupiedRect, AI_FLOW_COLLISION_PADDING)
      )
    );

    if (!overlapsExisting) {
      return anchor;
    }
  }

  return {
    x: occupiedBounds.x + occupiedBounds.width + AI_FLOW_BLOCK_GAP_X,
    y: Math.max(AI_FLOW_START_Y, occupiedBounds.y),
  };
}

export function buildAIPlanLayout(
  plan: AIGraphPlan,
  existingLayout?: ExistingLayoutContext
): Record<string, NodePosition> {
  const relativePositions = buildRelativePlanLayout(plan);
  const occupiedRects = collectOccupiedRects(existingLayout);
  const anchor = findFlowAnchor(plan, relativePositions, occupiedRects);

  return translatePositions(relativePositions, anchor);
}
