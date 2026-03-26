import { describe, expect, it } from "vitest";
import {
  buildStackedSortOptions,
  buildTipMarkOptions,
  computeMaxGroupSum,
  computePlotSize,
  computeCategoricalYMargin,
  computeYMargin,
  detectsHighVariance,
  getCompactAxisMargin,
  getMarginBottomForLabels,
  getMarginBottomForRotation,
  resolveStripChartMode,
  shouldShowInlineCategoricalLegend,
  getXTickRotation,
} from "@/lib/chartBarUtils";

// ─── 1. X-axis tick rotation ────────────────────────────────────────────────

describe("getXTickRotation", () => {
  it("returns -45 when there are more than 8 categories", () => {
    expect(getXTickRotation(9)).toBe(-45);
    expect(getXTickRotation(32)).toBe(-45);
  });

  it("returns 0 when there are 8 or fewer categories", () => {
    expect(getXTickRotation(1)).toBe(0);
    expect(getXTickRotation(8)).toBe(0);
  });
});

// ─── 2. Tooltip mark options ─────────────────────────────────────────────────

describe("buildTipMarkOptions", () => {
  it("includes x and y channels", () => {
    const opts = buildTipMarkOptions("state", "population");
    expect(opts).toMatchObject({ x: "state", y: "population" });
  });

  it("includes fill channel when colorColumn is provided", () => {
    const opts = buildTipMarkOptions("state", "population", "category");
    expect(opts).toMatchObject({ fill: "category" });
  });

  it("omits fill when colorColumn is not provided", () => {
    const opts = buildTipMarkOptions("state", "population");
    expect(opts).not.toHaveProperty("fill");
  });
});

// ─── 3. Sort bars by total descending ────────────────────────────────────────

describe("buildStackedSortOptions", () => {
  it("sorts x by sum of y descending", () => {
    expect(buildStackedSortOptions()).toEqual({
      x: "y",
      reduce: "sum",
      reverse: true,
    });
  });
});

// ─── 4. Log scale detection (high variance) ──────────────────────────────────

describe("detectsHighVariance", () => {
  it("returns true when max/min ratio exceeds 100", () => {
    expect(detectsHighVariance([1, 50, 500])).toBe(true);
    expect(detectsHighVariance([100, 1000, 15_000_000])).toBe(true);
  });

  it("returns false for uniformly distributed values", () => {
    expect(detectsHighVariance([100, 150, 200])).toBe(false);
    expect(detectsHighVariance([5_000_000, 8_000_000, 15_000_000])).toBe(false);
  });

  it("returns false with fewer than 2 positive values", () => {
    expect(detectsHighVariance([])).toBe(false);
    expect(detectsHighVariance([0, 0, 100])).toBe(false);
  });
});

// ─── 5a. Max aggregated group sum (for accurate tick format) ─────────────────

describe("computeMaxGroupSum", () => {
  const data = [
    { state: "A", value: 5_000_000, category: "X" },
    { state: "A", value: 3_000_000, category: "Y" },
    { state: "B", value: 2_000_000, category: "X" },
    { state: "B", value: 1_000_000, category: "Y" },
  ];

  it("returns the largest sum across all x groups", () => {
    expect(computeMaxGroupSum(data, "state", "value")).toBe(8_000_000);
  });

  it("returns 0 for empty data", () => {
    expect(computeMaxGroupSum([], "state", "value")).toBe(0);
  });

  it("returns 0 when yColumn is missing from rows", () => {
    expect(computeMaxGroupSum([{ state: "A" }], "state", "value")).toBe(0);
  });
});

// ─── 5c. Left margin based on compact tick label width ───────────────────────

describe("getCompactAxisMargin", () => {
  it("returns a small margin for values rendered as compact strings", () => {
    // "15M" = 3 chars → should be much less than 96 (raw "15,000,000" = 10 chars)
    expect(getCompactAxisMargin(15_000_000)).toBeLessThan(60);
  });

  it("returns at least the minimum fallback margin", () => {
    expect(getCompactAxisMargin(0)).toBeGreaterThanOrEqual(36);
    expect(getCompactAxisMargin(1)).toBeGreaterThanOrEqual(36);
  });

  it("grows with wider compact labels", () => {
    // "100B" is wider than "1M"
    expect(getCompactAxisMargin(100_000_000_000)).toBeGreaterThan(
      getCompactAxisMargin(1_000_000)
    );
  });
});

// ─── 5b. Bottom margin computed from actual label lengths ────────────────────

describe("getMarginBottomForLabels", () => {
  it("returns 36 when rotation is 0, regardless of label length", () => {
    expect(getMarginBottomForLabels(["Baja California Sur"], 0)).toBe(36);
    expect(getMarginBottomForLabels([], 0)).toBe(36);
  });

  it("returns at least 36 for any rotation", () => {
    expect(getMarginBottomForLabels(["AB"], -45)).toBeGreaterThanOrEqual(36);
  });

  it("returns more margin for longer labels at -45°", () => {
    const short = getMarginBottomForLabels(["BC"], -45);
    const long = getMarginBottomForLabels(["Baja California Sur"], -45);
    expect(long).toBeGreaterThan(short);
  });

  it("uses the longest label in the list", () => {
    const allShort = getMarginBottomForLabels(["AB", "CD"], -45);
    const oneLong = getMarginBottomForLabels(["AB", "Baja California Sur"], -45);
    expect(oneLong).toBeGreaterThan(allShort);
  });
});

// ─── 5d. Y-axis margin matching actual tick format ───────────────────────────

describe("computeYMargin", () => {
  it("uses compact margin for large values (≥ 1000)", () => {
    const margin = computeYMargin([5_000_000, 10_000_000, 16_000_000]);
    // "16M" = 3 chars → max(36, 3*8+16) = 40 — much less than raw "16,000,000"
    expect(margin).toBeLessThan(60);
  });

  it("uses raw format margin for small values (< 1000)", () => {
    const margin = computeYMargin([10, 50, 999]);
    // "999" = 3 chars → max(36, 3*8+20) = 44
    expect(margin).toBeGreaterThanOrEqual(36);
    expect(margin).toBeLessThan(60);
  });

  it("returns fallback for empty values", () => {
    expect(computeYMargin([])).toBe(36);
  });

  it("returns fallback when no finite values exist", () => {
    expect(computeYMargin(["a", null, undefined])).toBe(36);
  });

  it("handles mixed types by extracting numeric values", () => {
    const margin = computeYMargin([1_000_000, "2000000", null, undefined]);
    expect(margin).toBeLessThan(60);
  });
});

describe("computeCategoricalYMargin", () => {
  it("returns the minimum margin for empty labels", () => {
    expect(computeCategoricalYMargin([])).toBe(52);
  });

  it("returns more margin for longer labels", () => {
    const short = computeCategoricalYMargin(["ABC"]);
    const long = computeCategoricalYMargin(["Veracruz de Ignacio de la Llave"]);
    expect(long).toBeGreaterThan(short);
  });

  it("caps the margin at the configured maximum", () => {
    expect(computeCategoricalYMargin(["A".repeat(200)])).toBe(110);
  });
});

describe("shouldShowInlineCategoricalLegend", () => {
  it("shows the legend when the number of categories is within the limit", () => {
    expect(shouldShowInlineCategoricalLegend(["A", "B", "C"], 8)).toBe(true);
  });

  it("hides the legend when the number of categories exceeds the limit", () => {
    expect(
      shouldShowInlineCategoricalLegend(
        ["A", "B", "C", "D", "E", "F", "G", "H", "I"],
        8
      )
    ).toBe(false);
  });
});

describe("resolveStripChartMode", () => {
  it("uses simple mode when there is no category", () => {
    expect(
      resolveStripChartMode({
        hasCategory: false,
        hasGroup: true,
        categoryEqualsGroup: false,
        groupCardinality: 3,
      })
    ).toEqual({
      mode: "simple",
      showLegend: false,
      useGroupColor: false,
    });
  });

  it("uses category mode when there is a category but no group", () => {
    expect(
      resolveStripChartMode({
        hasCategory: true,
        hasGroup: false,
        categoryEqualsGroup: false,
        groupCardinality: 0,
      })
    ).toEqual({
      mode: "category",
      showLegend: false,
      useGroupColor: false,
    });
  });

  it("uses category mode when category and group are the same field", () => {
    expect(
      resolveStripChartMode({
        hasCategory: true,
        hasGroup: true,
        categoryEqualsGroup: true,
        groupCardinality: 3,
      })
    ).toEqual({
      mode: "category",
      showLegend: false,
      useGroupColor: false,
    });
  });

  it("uses grouped mode when the group cardinality is manageable", () => {
    expect(
      resolveStripChartMode({
        hasCategory: true,
        hasGroup: true,
        categoryEqualsGroup: false,
        groupCardinality: 3,
      })
    ).toEqual({
      mode: "grouped",
      showLegend: true,
      useGroupColor: true,
    });
  });

  it("falls back to category mode when the group cardinality is too high", () => {
    expect(
      resolveStripChartMode({
        hasCategory: true,
        hasGroup: true,
        categoryEqualsGroup: false,
        groupCardinality: 20,
      })
    ).toEqual({
      mode: "category",
      showLegend: false,
      useGroupColor: false,
    });
  });
});

// ─── 6. Plot size from container dimensions ──────────────────────────────────

describe("computePlotSize", () => {
  it("uses actual container height instead of capping at 420", () => {
    const result = computePlotSize(800, 600);
    expect(result.height).toBeGreaterThan(420);
  });

  it("subtracts padding from container dimensions", () => {
    const result = computePlotSize(500, 400);
    expect(result.width).toBe(484);
    expect(result.height).toBe(384);
  });

  it("enforces minimum width of 340", () => {
    const result = computePlotSize(100, 300);
    expect(result.width).toBe(340);
  });

  it("enforces minimum height of 220", () => {
    const result = computePlotSize(500, 100);
    expect(result.height).toBe(220);
  });

  it("handles zero dimensions gracefully", () => {
    const result = computePlotSize(0, 0);
    expect(result.width).toBe(340);
    expect(result.height).toBe(220);
  });
});

// ─── legacy: bottom margin for rotated labels (fixed) ────────────────────────

describe("getMarginBottomForRotation", () => {
  it("returns a larger margin when labels are rotated", () => {
    expect(getMarginBottomForRotation(-45)).toBeGreaterThan(getMarginBottomForRotation(0));
  });

  it("returns the default margin for 0 rotation", () => {
    expect(getMarginBottomForRotation(0)).toBe(36);
  });

  it("returns 72 for -45 rotation", () => {
    expect(getMarginBottomForRotation(-45)).toBe(72);
  });
});
