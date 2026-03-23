import { describe, expect, it } from "vitest";
import {
  buildCenteredDownstreamNodePosition,
  buildFirstNodeVerticalPosition,
  buildLaneDownstreamNodePosition,
  buildPortAlignedDownstreamNodePosition,
  findPreferredAnchorNodeId,
  findRightmostAnchorNodeId,
} from "@/lib/canvasPlacement";

describe("buildFirstNodeVerticalPosition", () => {
  it("centers the first node vertically on the visible surface", () => {
    expect(
      buildFirstNodeVerticalPosition({
        surfaceHeight: 900,
        nodeHeight: 540,
      })
    ).toEqual({
      x: 360,
      y: 180,
    });
  });
});

describe("buildCenteredDownstreamNodePosition", () => {
  it("centers a downstream node against the source node using the real target height", () => {
    expect(
      buildCenteredDownstreamNodePosition({
        sourcePosition: { x: 120, y: 100 },
        sourceSize: { width: 320, height: 388 },
        targetHeight: 540,
      })
    ).toEqual({
      x: 536,
      y: 84,
    });
  });

  it("keeps smaller targets centered as well", () => {
    expect(
      buildCenteredDownstreamNodePosition({
        sourcePosition: { x: 120, y: 100 },
        sourceSize: { width: 320, height: 388 },
        targetHeight: 280,
      })
    ).toEqual({
      x: 536,
      y: 148,
    });
  });

  it("biases top-heavy nodes upward and clamps them near the source top", () => {
    expect(
      buildCenteredDownstreamNodePosition({
        sourcePosition: { x: 900, y: 420 },
        sourceSize: { width: 320, height: 315 },
        targetHeight: 120,
        targetType: "group",
      })
    ).toEqual({
      x: 1316,
      y: 468,
    });
  });
});

describe("buildLaneDownstreamNodePosition", () => {
  it("keeps new toolbar nodes on the same vertical lane as the anchor", () => {
    expect(
      buildLaneDownstreamNodePosition({
        sourcePosition: { x: 580, y: 268 },
        sourceSize: { width: 320, height: 315 },
      })
    ).toEqual({
      x: 996,
      y: 268,
    });
  });
});

describe("buildPortAlignedDownstreamNodePosition", () => {
  it("aligns downstream ports on the same horizontal axis for add-from-node actions", () => {
    expect(
      buildPortAlignedDownstreamNodePosition({
        sourcePosition: { x: 220, y: 240 },
        sourceSize: { width: 320, height: 405 },
        targetHeight: 769,
      })
    ).toEqual({
      x: 636,
      y: 58,
    });
  });
});

describe("findRightmostAnchorNodeId", () => {
  it("prefers the node whose right edge is farthest to the right", () => {
    expect(
      findRightmostAnchorNodeId({
        visibleNodes: {
          source: {
            id: "source",
            type: "from",
            config: {},
            inputIds: [],
            result: null,
            status: "idle",
            pageId: "page-1",
          },
          table: {
            id: "table",
            type: "table",
            config: {},
            inputIds: [],
            result: null,
            status: "idle",
            pageId: "page-1",
          },
        },
        nodePositions: {
          source: { x: 220, y: 240 },
          table: { x: 580, y: 260 },
        },
        nodeSizes: {
          source: { width: 320, height: 405 },
          table: { width: 320, height: 315 },
        },
        getNodeWidth: () => 320,
      })
    ).toBe("table");
  });

  it("returns null when no positioned nodes are available", () => {
    expect(
      findRightmostAnchorNodeId({
        visibleNodes: {},
        nodePositions: {},
        nodeSizes: {},
        getNodeWidth: () => 320,
      })
    ).toBeNull();
  });
});

describe("findPreferredAnchorNodeId", () => {
  const visibleNodes = {
    source: {
      id: "source",
      type: "from" as const,
      config: {},
      inputIds: [],
      result: null,
      status: "idle" as const,
      pageId: "page-1",
    },
    table: {
      id: "table",
      type: "table" as const,
      config: {},
      inputIds: [],
      result: null,
      status: "idle" as const,
      pageId: "page-1",
    },
  };

  const nodePositions = {
    source: { x: 220, y: 240 },
    table: { x: 580, y: 260 },
  };

  const nodeSizes = {
    source: { width: 320, height: 405 },
    table: { width: 320, height: 315 },
  };

  it("prefers the selected node when it is visible and positioned", () => {
    expect(
      findPreferredAnchorNodeId({
        selectedNodeId: "source",
        visibleNodes,
        nodePositions,
        nodeSizes,
        getNodeWidth: () => 320,
      })
    ).toBe("source");
  });

  it("falls back to the rightmost visible node when there is no valid selection", () => {
    expect(
      findPreferredAnchorNodeId({
        selectedNodeId: "missing",
        visibleNodes,
        nodePositions,
        nodeSizes,
        getNodeWidth: () => 320,
      })
    ).toBe("table");
  });
});
