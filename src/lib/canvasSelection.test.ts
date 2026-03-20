import { describe, expect, it } from "vitest";
import {
  buildMarqueeRect,
  buildNodeSelectionRect,
  getSelectionBoundsFromRects,
  isMarqueeClick,
  resolveMarqueeSelection,
  resolveSelectionScope,
} from "@/lib/canvasSelection";
import type { DAGNode } from "@/engine/types";

function createNode(id: string): DAGNode {
  return {
    id,
    type: "chart",
    config: {},
    inputIds: [],
    result: null,
    status: "idle",
    pageId: "page-1",
  };
}

describe("buildNodeSelectionRect", () => {
  it("uses measured size when available and falls back otherwise", () => {
    const node = createNode("node-1");

    expect(
      buildNodeSelectionRect(node, { x: 12, y: 24 }, { width: 150, height: 80 }, 320, 220)
    ).toEqual({
      x: 12,
      y: 24,
      width: 150,
      height: 80,
    });

    expect(buildNodeSelectionRect(node, { x: 12, y: 24 }, undefined, 320, 220)).toEqual({
      x: 12,
      y: 24,
      width: 320,
      height: 220,
    });
  });
});

describe("resolveSelectionScope", () => {
  it("keeps a multi-selection when the interacted node is already selected", () => {
    const visibleNodes = {
      a: createNode("a"),
      b: createNode("b"),
    };

    expect(resolveSelectionScope(["a", "b"], "a", visibleNodes, "a")).toEqual(["a", "b"]);
  });

  it("falls back to the focused node when there is no explicit multi-selection", () => {
    const visibleNodes = {
      a: createNode("a"),
    };

    expect(resolveSelectionScope([], "a", visibleNodes)).toEqual(["a"]);
  });
});

describe("marquee helpers", () => {
  it("normalizes marquee coordinates and detects click-sized selections", () => {
    const rect = buildMarqueeRect({ x: 20, y: 30 }, { x: 10, y: 12 });

    expect(rect).toEqual({ x: 10, y: 12, width: 10, height: 18 });
    expect(isMarqueeClick({ x: 0, y: 0, width: 3, height: 3 }, 1)).toBe(true);
    expect(isMarqueeClick({ x: 0, y: 0, width: 5, height: 5 }, 1)).toBe(false);
  });

  it("returns the base selection for click-sized marquee gestures", () => {
    const overlap = () => true;

    expect(
      resolveMarqueeSelection({
        marqueeStart: { x: 0, y: 0 },
        marqueeCurrent: { x: 2, y: 2 },
        baseSelection: ["existing"],
        zoom: 1,
        visibleNodeIds: ["a", "b"],
        getNodeRect: () => ({ x: 0, y: 0, width: 10, height: 10 }),
        rectanglesOverlap: overlap,
      })
    ).toEqual(["existing"]);
  });

  it("expands selection with intersecting nodes during a drag marquee", () => {
    expect(
      resolveMarqueeSelection({
        marqueeStart: { x: 0, y: 0 },
        marqueeCurrent: { x: 100, y: 100 },
        baseSelection: ["existing"],
        zoom: 1,
        visibleNodeIds: ["inside", "outside"],
        getNodeRect: (nodeId) =>
          nodeId === "inside"
            ? { x: 10, y: 10, width: 20, height: 20 }
            : { x: 200, y: 200, width: 20, height: 20 },
        rectanglesOverlap: (selectionRect, nodeRect) =>
          !(
            selectionRect.x + selectionRect.width < nodeRect.x ||
            nodeRect.x + nodeRect.width < selectionRect.x ||
            selectionRect.y + selectionRect.height < nodeRect.y ||
            nodeRect.y + nodeRect.height < selectionRect.y
          ),
      })
    ).toEqual(["existing", "inside"]);
  });
});

describe("getSelectionBoundsFromRects", () => {
  it("builds viewport bounds from many selection rectangles", () => {
    expect(
      getSelectionBoundsFromRects([
        { x: 10, y: 20, width: 30, height: 40 },
        { x: -5, y: 15, width: 10, height: 10 },
      ])
    ).toEqual({
      minX: -5,
      minY: 15,
      maxX: 40,
      maxY: 60,
    });
  });
});
