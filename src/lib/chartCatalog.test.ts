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

    expect(getChartCatalogEntry(undefined, "spike")).toMatchObject({
      id: "spike-map",
    });
  });

  it("keeps all catalog variants enabled", () => {
    expect(CHART_CATALOG.every((entry) => entry.supported)).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "stacked-bar")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "waffle-chart")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "waterfall-chart")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "treemap")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "grid-cartogram")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "link-chart")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "world-choropleth")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "dot-map")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "spike-map")?.supported).toBe(true);
    expect(CHART_CATALOG.find((entry) => entry.id === "sankey-diagram")?.supported).toBe(true);
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

  it("defines grid cartogram as an explicit x/y tile layout", () => {
    expect(getChartCatalogEntry("grid-cartogram", "grid")).toMatchObject({
      fields: {
        x: "required",
        y: "required",
        color: "required",
        label: "optional",
      },
    });
  });

  it("exposes optional category and group fields for strip charts", () => {
    expect(getChartCatalogEntry("barcode-strip-plot", "dot")).toMatchObject({
      fields: {
        x: "required",
        y: "optional",
        color: "optional",
      },
    });
  });
});
