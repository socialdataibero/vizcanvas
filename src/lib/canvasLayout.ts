import { DAGNode } from "@/engine/types";
import { CanvasFrame } from "@/types/canvas";
import { NodeType, QueryResult } from "@/types/nodes";

const CANVAS_NODE_WIDTH: Partial<Record<NodeType, number>> = {
  chart: 460,
};

const EMPTY_STATE_PLACEMENT_HEIGHT: Partial<Record<NodeType, number>> = {
  group: 120,
  join: 120,
  table: 120,
  distinct: 120,
  controls: 120,
};

type NodeLayoutSpec = {
  fixedChromeHeight: number;
  tableRows?: number;
  hasColumnSummary?: boolean;
};

export const INITIAL_TABLE_VISIBLE_ROWS = 8;

const TABLE_PREVIEW_LAYOUT = {
  headerRow: 32,
  columnSummaryRow: 28,
  dataRow: 28,
  footer: 31,
};

const NODE_LAYOUT_SPECS: Partial<Record<NodeType, NodeLayoutSpec>> = {
  from: { fixedChromeHeight: 90, tableRows: INITIAL_TABLE_VISIBLE_ROWS, hasColumnSummary: true },
  sql: { fixedChromeHeight: 170, tableRows: INITIAL_TABLE_VISIBLE_ROWS, hasColumnSummary: true },
  group: { fixedChromeHeight: 454, tableRows: INITIAL_TABLE_VISIBLE_ROWS, hasColumnSummary: true },
  join: { fixedChromeHeight: 214, tableRows: INITIAL_TABLE_VISIBLE_ROWS, hasColumnSummary: true },
  table: { fixedChromeHeight: 0, tableRows: INITIAL_TABLE_VISIBLE_ROWS, hasColumnSummary: true },
  distinct: { fixedChromeHeight: 120, tableRows: INITIAL_TABLE_VISIBLE_ROWS, hasColumnSummary: true },
  controls: { fixedChromeHeight: 161, tableRows: INITIAL_TABLE_VISIBLE_ROWS, hasColumnSummary: true },
};

const DEFAULT_NODE_WIDTH = 320;
const DEFAULT_NODE_HEIGHT = 220;
const SOURCE_NODE_AUTO_HEIGHT_BASE = 181;
const SOURCE_NODE_AUTO_ROW_HEIGHT = 28;
const SOURCE_NODE_AUTO_MIN_VISIBLE_ROWS = INITIAL_TABLE_VISIBLE_ROWS;
const SOURCE_NODE_AUTO_MAX_VISIBLE_ROWS = INITIAL_TABLE_VISIBLE_ROWS;
const SOURCE_NODE_AUTO_MAX_HEIGHT = 448;
const GROUP_NODE_AUTO_HEIGHT_BASE = 545;
const GROUP_NODE_AUTO_ROW_HEIGHT = 28;
const GROUP_NODE_AUTO_MIN_VISIBLE_ROWS = INITIAL_TABLE_VISIBLE_ROWS;
const GROUP_NODE_AUTO_MAX_VISIBLE_ROWS = INITIAL_TABLE_VISIBLE_ROWS;
const GROUP_NODE_AUTO_MAX_HEIGHT = 872;
const FRAME_PADDING = {
  left: 28,
  right: 52,
  top: 44,
  bottom: 40,
};

export interface CanvasNodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function getCanvasNodeWidth(type: NodeType): number {
  return CANVAS_NODE_WIDTH[type] ?? DEFAULT_NODE_WIDTH;
}

export function getTablePreviewMinHeight(rows: number, hasColumnSummary = true): number {
  return (
    TABLE_PREVIEW_LAYOUT.headerRow +
    (hasColumnSummary ? TABLE_PREVIEW_LAYOUT.columnSummaryRow : 0) +
    rows * TABLE_PREVIEW_LAYOUT.dataRow +
    TABLE_PREVIEW_LAYOUT.footer
  );
}

export function getBaseCanvasNodeHeight(nodeType: NodeType): number {
  if (nodeType === "chart") {
    return 320;
  }

  const spec = NODE_LAYOUT_SPECS[nodeType];
  if (!spec?.tableRows) {
    return DEFAULT_NODE_HEIGHT;
  }

  return spec.fixedChromeHeight + getTablePreviewMinHeight(spec.tableRows, spec.hasColumnSummary);
}

export function getCanvasNodeHeight(
  nodeType: NodeType,
  nodeId: string,
  nodeSizes: Record<string, { width: number; height: number }>
): number {
  return nodeSizes[nodeId]?.height ?? getBaseCanvasNodeHeight(nodeType);
}

export function getCanvasPlacementHeight(nodeType: NodeType): number {
  return EMPTY_STATE_PLACEMENT_HEIGHT[nodeType] ?? getBaseCanvasNodeHeight(nodeType);
}

export function getSourceNodeAutoHeight(result: QueryResult | null | undefined): number {
  if (!result) {
    return getCanvasNodeHeight("from", "", {});
  }

  const visibleRows = Math.min(
    SOURCE_NODE_AUTO_MAX_VISIBLE_ROWS,
    Math.max(SOURCE_NODE_AUTO_MIN_VISIBLE_ROWS, result.rows.length)
  );

  return Math.max(
    getCanvasNodeHeight("from", "", {}),
    Math.min(
      SOURCE_NODE_AUTO_MAX_HEIGHT,
      SOURCE_NODE_AUTO_HEIGHT_BASE + visibleRows * SOURCE_NODE_AUTO_ROW_HEIGHT
    )
  );
}

export function getGroupNodeAutoHeight(result: QueryResult | null | undefined): number {
  if (!result) {
    return getCanvasNodeHeight("group", "", {});
  }

  const visibleRows = Math.min(
    GROUP_NODE_AUTO_MAX_VISIBLE_ROWS,
    Math.max(GROUP_NODE_AUTO_MIN_VISIBLE_ROWS, result.rows.length)
  );

  return Math.max(
    getCanvasNodeHeight("group", "", {}),
    Math.min(
      GROUP_NODE_AUTO_MAX_HEIGHT,
      GROUP_NODE_AUTO_HEIGHT_BASE + visibleRows * GROUP_NODE_AUTO_ROW_HEIGHT
    )
  );
}

export function getCanvasNodeRect(
  node: DAGNode,
  nodeId: string,
  nodePositions: Record<string, { x: number; y: number }>,
  nodeSizes: Record<string, { width: number; height: number }>
): CanvasNodeRect | null {
  const position = nodePositions[nodeId];
  if (!position) return null;

  return {
    id: nodeId,
    x: position.x,
    y: position.y,
    width: nodeSizes[nodeId]?.width ?? getCanvasNodeWidth(node.type),
    height: getCanvasNodeHeight(node.type, nodeId, nodeSizes),
  };
}

export function getLiveCanvasNodeRect(
  node: DAGNode,
  nodeId: string,
  nodePositions: Record<string, { x: number; y: number }>,
  nodeSizes: Record<string, { width: number; height: number }>
): CanvasNodeRect | null {
  const baseRect = getCanvasNodeRect(node, nodeId, nodePositions, nodeSizes);
  if (!baseRect) return null;

  if (typeof document === "undefined") {
    return baseRect;
  }

  const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
  if (!nodeElement) {
    return baseRect;
  }

  return {
    ...baseRect,
    width: Math.max(baseRect.width, Math.round(nodeElement.offsetWidth)),
    height: Math.max(baseRect.height, Math.round(nodeElement.offsetHeight)),
  };
}

function isNodeRectInsideFrame(
  nodeRect: Pick<CanvasNodeRect, "x" | "y" | "width" | "height">,
  frame: Pick<CanvasFrame, "x" | "y" | "width" | "height">
): boolean {
  return (
    nodeRect.x >= frame.x &&
    nodeRect.y >= frame.y &&
    nodeRect.x + nodeRect.width <= frame.x + frame.width &&
    nodeRect.y + nodeRect.height <= frame.y + frame.height
  );
}

export function buildFrameBoundsFromNodeRects(
  nodeRects: Array<Pick<CanvasNodeRect, "x" | "y" | "width" | "height">>
): Pick<CanvasFrame, "x" | "y" | "width" | "height"> | null {
  if (nodeRects.length === 0) return null;

  const minX = Math.min(...nodeRects.map((entry) => entry.x));
  const minY = Math.min(...nodeRects.map((entry) => entry.y));
  const maxX = Math.max(...nodeRects.map((entry) => entry.x + entry.width));
  const maxY = Math.max(...nodeRects.map((entry) => entry.y + entry.height));

  return {
    x: Math.round(minX - FRAME_PADDING.left),
    y: Math.round(minY - FRAME_PADDING.top),
    width: Math.round(maxX - minX + FRAME_PADDING.left + FRAME_PADDING.right),
    height: Math.round(maxY - minY + FRAME_PADDING.top + FRAME_PADDING.bottom),
  };
}

export function normalizeFrameMembership(
  frames: CanvasFrame[],
  nodes: Record<string, DAGNode>,
  nodePositions: Record<string, { x: number; y: number }>,
  nodeSizes: Record<string, { width: number; height: number }>
): CanvasFrame[] {
  return frames.map((frame) => {
    const explicitNodeIds = Array.from(
      new Set(
        (frame.nodeIds ?? []).filter((nodeId) => {
          const node = nodes[nodeId];
          return Boolean(node && node.pageId === frame.pageId && nodePositions[nodeId]);
        })
      )
    );

    const expandFrameToMembers = (frameNodeIds: string[]) => {
      const memberRects = frameNodeIds
        .map((nodeId) => {
          const node = nodes[nodeId];
          return node ? getCanvasNodeRect(node, nodeId, nodePositions, nodeSizes) : null;
        })
        .filter((entry): entry is CanvasNodeRect => Boolean(entry));
      const expectedBounds = buildFrameBoundsFromNodeRects(memberRects);

      if (!expectedBounds) {
        return {
          ...frame,
          nodeIds: frameNodeIds,
        };
      }

      return {
        ...frame,
        x: expectedBounds.x,
        y: expectedBounds.y,
        width: expectedBounds.width,
        height: expectedBounds.height,
        nodeIds: frameNodeIds,
      };
    };

    if (explicitNodeIds.length > 0) {
      return expandFrameToMembers(explicitNodeIds);
    }

    const inferredNodeIds = Object.entries(nodes)
      .filter(([, node]) => node.pageId === frame.pageId)
      .flatMap(([nodeId, node]) => {
        const nodeRect = getLiveCanvasNodeRect(node, nodeId, nodePositions, nodeSizes);
        return nodeRect && isNodeRectInsideFrame(nodeRect, frame) ? [nodeId] : [];
      });

    return expandFrameToMembers(inferredNodeIds);
  });
}
