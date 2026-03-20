import { DAGNode, DAGEdge } from "./types";

export function topologicalSortRecord(
  nodes: Record<string, DAGNode>,
  edges: DAGEdge[]
): string[] {
  const nodeIds = Object.keys(nodes);
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  for (const id of nodeIds) {
    inDegree.set(id, 0);
    adjacency.set(id, []);
  }

  for (const edge of edges) {
    const current = inDegree.get(edge.toNodeId) || 0;
    inDegree.set(edge.toNodeId, current + 1);
    const adj = adjacency.get(edge.fromNodeId) || [];
    adj.push(edge.toNodeId);
    adjacency.set(edge.fromNodeId, adj);
  }

  const queue: string[] = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeId);
    const neighbors = adjacency.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const deg = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, deg);
      if (deg === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== nodeIds.length) {
    const cycleNodes = nodeIds.filter((id) => !sorted.includes(id));
    console.warn("Cycle detected in DAG involving nodes:", cycleNodes);
    // Include cycle nodes at the end so they still get some processing
    for (const id of cycleNodes) {
      sorted.push(id);
    }
  }

  return sorted;
}

export function getDownstreamNodes(
  nodeId: string,
  edges: DAGEdge[]
): Set<string> {
  const downstream = new Set<string>();
  const queue = [nodeId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (edge.fromNodeId === current && !downstream.has(edge.toNodeId)) {
        downstream.add(edge.toNodeId);
        queue.push(edge.toNodeId);
      }
    }
  }

  return downstream;
}

export function getUpstreamNodes(
  nodeId: string,
  edges: DAGEdge[]
): string[] {
  return edges
    .filter((e) => e.toNodeId === nodeId)
    .sort((a, b) => a.toInputIndex - b.toInputIndex)
    .map((e) => e.fromNodeId);
}
