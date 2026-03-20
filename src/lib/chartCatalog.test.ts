import { describe, expect, it } from "vitest";
import { CHART_CATALOG, CHART_GALLERY_SECTIONS, getChartCatalogEntry } from "@/lib/chartCatalog";

describe("chartCatalog", () => {
  it("keeps the gallery sections used by the chart node layout", () => {
    expect(CHART_GALLERY_SECTIONS).toEqual([
      "COMPARISON",
      "DISTRIBUTION",
      "TIME",
      "RELATIONSHIP",
      "PART-TO-WHOLE",
      "MAPS",
      "FLOW",
    ]);
  });

  it("resolves selected entries by explicit catalog id and chart type fallback", () => {
    expect(getChartCatalogEntry("bubble-chart", "scatter")).toMatchObject({
      id: "bubble-chart",
      chartType: "scatter",
    });

    expect(getChartCatalogEntry(undefined, "bar")).toMatchObject({
      id: "vertical-bar",
    });
  });

  it("includes supported and disabled catalog variants", () => {
    expect(CHART_CATALOG.some((entry) => entry.supported)).toBe(true);
    expect(CHART_CATALOG.some((entry) => !entry.supported)).toBe(true);
  });

  it("groups representative charts by analytical task", () => {
    expect(CHART_CATALOG.find((entry) => entry.id === "vertical-bar")?.section).toBe("COMPARISON");
    expect(CHART_CATALOG.find((entry) => entry.id === "histogram")?.section).toBe("DISTRIBUTION");
    expect(CHART_CATALOG.find((entry) => entry.id === "line-chart")?.section).toBe("TIME");
    expect(CHART_CATALOG.find((entry) => entry.id === "scatterplot")?.section).toBe("RELATIONSHIP");
    expect(CHART_CATALOG.find((entry) => entry.id === "treemap")?.section).toBe("PART-TO-WHOLE");
    expect(CHART_CATALOG.find((entry) => entry.id === "world-choropleth")?.section).toBe("MAPS");
    expect(CHART_CATALOG.find((entry) => entry.id === "sankey-diagram")?.section).toBe("FLOW");
  });
});
