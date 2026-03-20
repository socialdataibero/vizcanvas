import { CanvasFrame, CanvasPage } from "@/types/canvas";
import { DAGEdge, DAGNode } from "@/engine/types";

type NodePosition = { x: number; y: number };
type NodeSize = { width: number; height: number };

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizePageOrder(pages: CanvasPage[]): CanvasPage[] {
  return pages.map((page, index) => ({ ...page, order: index }));
}

interface DeletePageStateArgs {
  pageId: string;
  pages: CanvasPage[];
  currentPageId: string;
  nodes: Record<string, DAGNode>;
  edges: DAGEdge[];
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  frames: CanvasFrame[];
  selectedNodeId: string | null;
}

interface DeletePageStateResult {
  pages: CanvasPage[];
  currentPageId: string;
  nodes: Record<string, DAGNode>;
  edges: DAGEdge[];
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  frames: CanvasFrame[];
  shouldClearSelectedNode: boolean;
}

export function buildDeletedPageState(args: DeletePageStateArgs): DeletePageStateResult | null {
  const {
    pageId,
    pages,
    currentPageId,
    nodes,
    edges,
    nodePositions,
    nodeSizes,
    frames,
    selectedNodeId,
  } = args;

  if (pages.length <= 1) return null;

  const pageNodeIds = Object.entries(nodes)
    .filter(([, node]) => node.pageId === pageId)
    .map(([nodeId]) => nodeId);

  const pageNodeIdSet = new Set(pageNodeIds);
  const nextPages = normalizePageOrder(pages.filter((page) => page.id !== pageId));
  const nextCurrentPageId =
    pageId === currentPageId ? nextPages[0]?.id ?? currentPageId : currentPageId;

  return {
    pages: nextPages,
    currentPageId: nextCurrentPageId,
    nodes: Object.fromEntries(
      Object.entries(nodes).filter(([nodeId]) => !pageNodeIdSet.has(nodeId))
    ),
    edges: edges.filter(
      (edge) => !pageNodeIdSet.has(edge.fromNodeId) && !pageNodeIdSet.has(edge.toNodeId)
    ),
    nodePositions: Object.fromEntries(
      Object.entries(nodePositions).filter(([nodeId]) => !pageNodeIdSet.has(nodeId))
    ),
    nodeSizes: Object.fromEntries(
      Object.entries(nodeSizes).filter(([nodeId]) => !pageNodeIdSet.has(nodeId))
    ),
    frames: frames.filter((frame) => frame.pageId !== pageId),
    shouldClearSelectedNode: Boolean(selectedNodeId && pageNodeIdSet.has(selectedNodeId)),
  };
}

interface DuplicatePageStateArgs {
  pageId: string;
  pages: CanvasPage[];
  nodes: Record<string, DAGNode>;
  edges: DAGEdge[];
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  frames: CanvasFrame[];
  generateId: () => string;
}

interface DuplicatePageStateResult {
  pages: CanvasPage[];
  currentPageId: string;
  nodes: Record<string, DAGNode>;
  edges: DAGEdge[];
  nodePositions: Record<string, NodePosition>;
  nodeSizes: Record<string, NodeSize>;
  frames: CanvasFrame[];
  newPageId: string;
}

export function buildDuplicatedPageState(args: DuplicatePageStateArgs): DuplicatePageStateResult | null {
  const {
    pageId,
    pages,
    nodes,
    edges,
    nodePositions,
    nodeSizes,
    frames,
    generateId,
  } = args;

  const sourcePage = pages.find((page) => page.id === pageId);
  if (!sourcePage) return null;

  const sourceNodes = Object.entries(nodes).filter(([, node]) => node.pageId === pageId);
  const idMap = new Map(sourceNodes.map(([nodeId]) => [nodeId, generateId()]));
  const sourceNodeIdSet = new Set(idMap.keys());
  const newPageId = generateId();

  const clonedNodes = Object.fromEntries(
    sourceNodes.map(([nodeId, node]) => {
      const clonedNodeId = idMap.get(nodeId)!;
      const mappedInputIds = (node.inputIds ?? []).flatMap((inputId) => {
        const mappedId = idMap.get(inputId);
        return mappedId ? [mappedId] : [];
      });

      const clonedNode: DAGNode = {
        ...node,
        id: clonedNodeId,
        pageId: newPageId,
        inputIds: mappedInputIds,
        config: cloneValue(node.config),
        result: null,
        status: "idle",
        error: undefined,
      };

      return [clonedNodeId, clonedNode];
    })
  ) as Record<string, DAGNode>;

  const clonedEdges = edges
    .filter((edge) => sourceNodeIdSet.has(edge.fromNodeId) && sourceNodeIdSet.has(edge.toNodeId))
    .map<DAGEdge>((edge) => ({
      id: generateId(),
      fromNodeId: idMap.get(edge.fromNodeId)!,
      toNodeId: idMap.get(edge.toNodeId)!,
      toInputIndex: edge.toInputIndex,
    }));

  const clonedNodePositions = Object.fromEntries(
    sourceNodes.map(([nodeId]) => {
      const clonedNodeId = idMap.get(nodeId)!;
      return [clonedNodeId, cloneValue(nodePositions[nodeId] ?? { x: 200, y: 200 })];
    })
  );

  const clonedNodeSizes = Object.fromEntries(
    sourceNodes.flatMap(([nodeId]) => {
      const size = nodeSizes[nodeId];
      const clonedNodeId = idMap.get(nodeId)!;
      return size ? [[clonedNodeId, cloneValue(size)] as const] : [];
    })
  );

  const clonedFrames = frames
    .filter((frame) => frame.pageId === pageId)
    .map((frame) => ({
      ...cloneValue(frame),
      id: generateId(),
      pageId: newPageId,
      nodeIds: (frame.nodeIds ?? []).flatMap((nodeId) => {
        const mappedId = idMap.get(nodeId);
        return mappedId ? [mappedId] : [];
      }),
    }));

  return {
    pages: normalizePageOrder([
      ...pages,
      {
        id: newPageId,
        name: `${sourcePage.name} (copy)`,
        order: pages.length,
      },
    ]),
    currentPageId: newPageId,
    nodes: { ...nodes, ...clonedNodes },
    edges: [...edges, ...clonedEdges],
    nodePositions: { ...nodePositions, ...clonedNodePositions },
    nodeSizes: { ...nodeSizes, ...clonedNodeSizes },
    frames: [...frames, ...clonedFrames],
    newPageId,
  };
}
