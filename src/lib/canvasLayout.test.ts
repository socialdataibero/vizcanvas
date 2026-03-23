import { describe, expect, it } from "vitest";
import {
  buildFrameBoundsFromNodeRects,
  getBaseCanvasNodeHeight,
  getCanvasPlacementHeight,
  getCanvasNodeHeight,
  getCanvasNodeRect,
  getCanvasNodeWidth,
  getGroupNodeAutoHeight,
  getSourceNodeAutoHeight,
  getTablePreviewMinHeight,
  normalizeFrameMembership,
} from "@/lib/canvasLayout";
import type { DAGNode } from "@/engine/types";
import type { CanvasFrame } from "@/types/canvas";

function createNode(id: string, pageId = "page-1"): DAGNode {
  return {
    id,
    type: "chart",
    config: {},
    inputIds: [],
    result: null,
    status: "idle",
    pageId,
  };
}

describe("canvas node sizing", () => {
  it("derives a common table preview minimum height from the box model", () => {
    expect(getTablePreviewMinHeight(8, true)).toBe(315);
    expect(getTablePreviewMinHeight(8, false)).toBe(287);
  });

  it("uses node-specific dimensions and falls back for other node types", () => {
    expect(getCanvasNodeWidth("chart")).toBe(540);
    expect(getCanvasNodeWidth("sql")).toBe(320);
    expect(getBaseCanvasNodeHeight("from")).toBe(405);
    expect(getBaseCanvasNodeHeight("group")).toBe(769);
    expect(getCanvasNodeHeight("chart", "chart-1", {})).toBe(420);
    expect(getCanvasNodeHeight("from", "from-1", {})).toBe(405);
    expect(getCanvasNodeHeight("group", "group-1", {})).toBe(769);
    expect(getCanvasNodeHeight("sql", "sql-1", {})).toBe(485);
    expect(getCanvasNodeHeight("join", "join-1", {})).toBe(529);
    expect(getCanvasNodeHeight("table", "table-1", {})).toBe(315);
    expect(getCanvasNodeHeight("distinct", "distinct-1", {})).toBe(435);
    expect(getCanvasNodeHeight("controls", "controls-1", {})).toBe(476);
    expect(getCanvasPlacementHeight("group")).toBe(120);
    expect(getCanvasPlacementHeight("controls")).toBe(120);
    expect(getCanvasPlacementHeight("from")).toBe(405);
  });

  it("builds a node rect only when a position exists", () => {
    const node = createNode("node-1");

    expect(
      getCanvasNodeRect(
        node,
        "node-1",
        { "node-1": { x: 25, y: 40 } },
        { "node-1": { width: 120, height: 90 } }
      )
    ).toEqual({
      id: "node-1",
      x: 25,
      y: 40,
      width: 120,
      height: 90,
    });

    expect(getCanvasNodeRect(node, "node-1", {}, {})).toBeNull();
  });

  it("grows source nodes after table data loads, within bounds", () => {
    expect(getSourceNodeAutoHeight(null)).toBe(405);
    expect(
      getSourceNodeAutoHeight({
        columns: [{ name: "product", type: "TEXT", nullable: false }],
        rows: Array.from({ length: 1 }, (_, index) => ({ product: `row-${index}` })),
        totalRows: 16,
        sql: "select * from sample_data",
      })
    ).toBe(405);
    expect(
      getSourceNodeAutoHeight({
        columns: [{ name: "product", type: "TEXT", nullable: false }],
        rows: Array.from({ length: 8 }, (_, index) => ({ product: `row-${index}` })),
        totalRows: 16,
        sql: "select * from sample_data",
      })
    ).toBe(405);
    expect(
      getSourceNodeAutoHeight({
        columns: [{ name: "product", type: "TEXT", nullable: false }],
        rows: Array.from({ length: 20 }, (_, index) => ({ product: `row-${index}` })),
        totalRows: 200,
        sql: "select * from sample_data",
      })
    ).toBe(405);
  });

  it("grows group nodes after table data loads, within bounds", () => {
    expect(getGroupNodeAutoHeight(null)).toBe(769);
    expect(
      getGroupNodeAutoHeight({
        columns: [{ name: "product", type: "TEXT", nullable: false }],
        rows: Array.from({ length: 1 }, (_, index) => ({ product: `row-${index}` })),
        totalRows: 16,
        sql: "select * from sample_data",
      })
    ).toBe(769);
    expect(
      getGroupNodeAutoHeight({
        columns: [{ name: "product", type: "TEXT", nullable: false }],
        rows: Array.from({ length: 8 }, (_, index) => ({ product: `row-${index}` })),
        totalRows: 16,
        sql: "select * from sample_data",
      })
    ).toBe(769);
    expect(
      getGroupNodeAutoHeight({
        columns: [{ name: "product", type: "TEXT", nullable: false }],
        rows: Array.from({ length: 20 }, (_, index) => ({ product: `row-${index}` })),
        totalRows: 200,
        sql: "select * from sample_data",
      })
    ).toBe(769);
  });
});

describe("frame bounds", () => {
  it("expands frame bounds around all member rects with padding", () => {
    expect(
      buildFrameBoundsFromNodeRects([
        { x: 100, y: 100, width: 100, height: 80 },
        { x: 250, y: 160, width: 50, height: 40 },
      ])
    ).toEqual({
      x: 72,
      y: 56,
      width: 280,
      height: 184,
    });
  });
});

describe("normalizeFrameMembership", () => {
  it("deduplicates explicit members, filters invalid ones, and resizes the frame", () => {
    const frames: CanvasFrame[] = [
      {
        id: "frame-1",
        pageId: "page-1",
        name: "Frame",
        x: 0,
        y: 0,
        width: 50,
        height: 50,
        nodeIds: ["inside", "inside", "other-page", "missing-position"],
      },
    ];

    const result = normalizeFrameMembership(
      frames,
      {
        inside: createNode("inside"),
        "other-page": createNode("other-page", "page-2"),
        "missing-position": createNode("missing-position"),
      },
      {
        inside: { x: 100, y: 100 },
      },
      {
        inside: { width: 100, height: 80 },
      }
    );

    expect(result).toEqual([
      {
        ...frames[0],
        x: 72,
        y: 56,
        width: 180,
        height: 164,
        nodeIds: ["inside"],
      },
    ]);
  });

  it("infers members from live DOM measurements when no explicit members exist", () => {
    const insideElement = document.createElement("div");
    insideElement.setAttribute("data-node-id", "inside");
    Object.defineProperty(insideElement, "offsetWidth", { value: 120 });
    Object.defineProperty(insideElement, "offsetHeight", { value: 90 });
    document.body.appendChild(insideElement);

    const outsideElement = document.createElement("div");
    outsideElement.setAttribute("data-node-id", "outside");
    Object.defineProperty(outsideElement, "offsetWidth", { value: 120 });
    Object.defineProperty(outsideElement, "offsetHeight", { value: 90 });
    document.body.appendChild(outsideElement);

    const frames: CanvasFrame[] = [
      {
        id: "frame-1",
        pageId: "page-1",
        name: "Frame",
        x: 0,
        y: 0,
        width: 200,
        height: 200,
        nodeIds: [],
      },
    ];

    const result = normalizeFrameMembership(
      frames,
      {
        inside: createNode("inside"),
        outside: createNode("outside"),
      },
      {
        inside: { x: 20, y: 20 },
        outside: { x: 210, y: 20 },
      },
      {
        inside: { width: 100, height: 80 },
        outside: { width: 100, height: 80 },
      }
    );

    expect(result).toEqual([
      {
        ...frames[0],
        x: -8,
        y: -24,
        width: 180,
        height: 164,
        nodeIds: ["inside"],
      },
    ]);
  });
});
