import { AIGraphPlan } from "@/lib/aiGraph";
import { getCanvasNodeWidth } from "@/lib/canvasLayout";

const AI_GRAPH_GAP_X = 96;
const AI_GRAPH_GAP_Y = 220;

export function buildAIPlanLayout(
  plan: AIGraphPlan,
  existingPositions: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
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

  const existingEntries = Object.values(existingPositions);
  const baseX = existingEntries.length > 0 ? Math.max(...existingEntries.map((position) => position.x)) + 420 : 120;
  const baseY = existingEntries.length > 0 ? Math.min(...existingEntries.map((position) => position.y)) : 140;
  const xByLevel = new Map<number, number>();
  let cursorX = baseX;

  for (const level of levelsUsed) {
    xByLevel.set(level, cursorX);
    const maxWidth = Math.max(
      ...(nodesByLevel.get(level) ?? []).map((nodeId) => getCanvasNodeWidth(nodeById.get(nodeId)?.type ?? "table")),
      getCanvasNodeWidth("table")
    );
    cursorX += maxWidth + AI_GRAPH_GAP_X;
  }

  const usedYs = new Map<number, number[]>();
  const positions: Record<string, { x: number; y: number }> = {};

  for (const nodeId of topologicalOrder) {
    const level = levels.get(nodeId) ?? 0;
    const levelYs = usedYs.get(level) ?? [];
    const parentIds = parents.get(nodeId) ?? [];
    const parentYs = parentIds
      .map((parentId) => positions[parentId]?.y)
      .filter((value): value is number => typeof value === "number");

    let y =
      parentYs.length > 0
        ? parentYs.reduce((sum, value) => sum + value, 0) / parentYs.length
        : baseY + levelYs.length * AI_GRAPH_GAP_Y;

    while (levelYs.some((usedY) => Math.abs(usedY - y) < AI_GRAPH_GAP_Y * 0.75)) {
      y += AI_GRAPH_GAP_Y;
    }

    positions[nodeId] = {
      x: xByLevel.get(level) ?? baseX,
      y: Math.round(y),
    };
    levelYs.push(y);
    usedYs.set(level, levelYs);
  }

  return positions;
}
