import { describe, expect, it } from "vitest";
import type { DAGNode } from "@/engine/types";
import type { AIGraphPlan } from "@/lib/aiGraph";
import { getBaseCanvasNodeHeight } from "@/lib/canvasLayout";
import { buildAIPlanLayout } from "@/lib/aiPlanLayout";

function createExistingNode(id: string, type: DAGNode["type"]): DAGNode {
  return {
    id,
    type,
    config: {} as DAGNode["config"],
    inputIds: [],
    result: null,
    status: "idle",
    pageId: "page-1",
  };
}

describe("buildAIPlanLayout", () => {
  it("places a new AI flow in a fresh lane when the canvas is empty", () => {
    const plan: AIGraphPlan = {
      summary: "new flow",
      warnings: [],
      nodes: [
        { id: "source", type: "from", config: { tableName: "sample_data", filters: [] } },
        { id: "chart", type: "chart", config: { chartType: "bar" } },
      ],
      edges: [
        { from: "source", to: "chart", toInputIndex: 0 },
      ],
    };

    const positions = buildAIPlanLayout(plan, {
      nodes: {},
      positions: {},
      sizes: {},
    });

    expect(positions.source.x).toBe(120);
    expect(positions.source.y).toBeGreaterThanOrEqual(140);
    expect(positions.chart.x).toBeGreaterThan(positions.source.x);
  });

  it("uses the real right edge of existing nodes so new flows do not stack on top of wide charts", () => {
    const plan: AIGraphPlan = {
      summary: "new flow",
      warnings: [],
      nodes: [
        { id: "source", type: "from", config: { tableName: "sample_data", filters: [] } },
        { id: "table", type: "table", config: { hiddenColumns: [] } },
      ],
      edges: [
        { from: "source", to: "table", toInputIndex: 0 },
      ],
    };

    const positions = buildAIPlanLayout(plan, {
      nodes: {
        "chart-1": createExistingNode("chart-1", "chart"),
      },
      positions: {
        "chart-1": { x: 100, y: 80 },
      },
      sizes: {
        "chart-1": { width: 760, height: 420 },
      },
    });

    expect(positions.source.x).toBeGreaterThanOrEqual(1040);
    expect(positions.source.y).toBe(140);
  });

  it("stacks same-level AI nodes using their real heights instead of a fixed overlapping gap", () => {
    const plan: AIGraphPlan = {
      summary: "parallel flow",
      warnings: [],
      nodes: [
        { id: "chart_a", type: "chart", config: { chartType: "bar" } },
        { id: "chart_b", type: "chart", config: { chartType: "line" } },
      ],
      edges: [],
    };

    const positions = buildAIPlanLayout(plan, {
      nodes: {},
      positions: {},
      sizes: {},
    });

    expect(positions.chart_b.y - positions.chart_a.y).toBeGreaterThanOrEqual(
      getBaseCanvasNodeHeight("chart") + 220
    );
  });
});
