import { describe, expect, it } from "vitest";
import { CHART_CATALOG } from "@/lib/chartCatalog";
import { normalizeAIGraphPlan } from "@/lib/aiGraph";

function buildChartConfigForEntry(entry: (typeof CHART_CATALOG)[number]) {
  const config: Record<string, string> = {
    chartType: entry.chartType ?? "bar",
    chartCatalogId: entry.id,
  };

  if (!entry.fields) {
    return config;
  }

  Object.entries(entry.fields).forEach(([field, requirement]) => {
    if (requirement !== "required") return;

    if (field === "x") config.xColumn = "x";
    if (field === "y") config.yColumn = "y";
    if (field === "x2") config.x2Column = "x2";
    if (field === "y2") config.y2Column = "y2";
    if (field === "color") config.colorColumn = "color";
    if (field === "size") config.sizeColumn = "size";
    if (field === "length") config.lengthColumn = "length";
    if (field === "label") config.labelColumn = "label";
    if (field === "facet") config.facetColumn = "facet";
  });

  return config;
}

describe("normalizeAIGraphPlan chart variants", () => {
  it("infers concrete chart variants when the AI omits chartCatalogId", () => {
    const plan = normalizeAIGraphPlan(
      {
        nodes: [
          {
            id: "grouped",
            type: "chart",
            config: {
              chartType: "bar",
              yColumn: "value",
              colorColumn: "segment",
              facetColumn: "region",
            },
          },
          {
            id: "multi_line",
            type: "chart",
            config: {
              chartType: "line",
              xColumn: "date",
              yColumn: "value",
              colorColumn: "series",
            },
          },
          {
            id: "bubble",
            type: "chart",
            config: {
              chartType: "scatter",
              xColumn: "x",
              yColumn: "y",
              sizeColumn: "magnitude",
            },
          },
          {
            id: "faceted_histogram",
            type: "chart",
            config: {
              chartType: "histogram",
              xColumn: "value",
              facetColumn: "group",
            },
          },
        ],
      },
      []
    );

    expect(plan?.warnings).toEqual([]);
    expect(plan?.nodes).toMatchObject([
      { id: "grouped", config: { chartType: "bar", chartCatalogId: "grouped-bar" } },
      { id: "multi_line", config: { chartType: "line", chartCatalogId: "multi-series-line" } },
      { id: "bubble", config: { chartType: "scatter", chartCatalogId: "bubble-chart" } },
      { id: "faceted_histogram", config: { chartType: "histogram", chartCatalogId: "faceted-histogram" } },
    ]);
  });

  it("accepts every supported chart catalog variant from an AI plan", () => {
    const supportedEntries = CHART_CATALOG.filter((entry) => entry.supported && entry.chartType);
    const plan = normalizeAIGraphPlan(
      {
        nodes: supportedEntries.map((entry) => ({
          id: entry.id,
          type: "chart",
          config: buildChartConfigForEntry(entry),
        })),
      },
      []
    );

    expect(plan).not.toBeNull();
    expect(plan?.warnings).toEqual([]);
    expect(plan?.nodes).toHaveLength(supportedEntries.length);

    supportedEntries.forEach((entry) => {
      const node = plan?.nodes.find((candidate) => candidate.id === entry.id);
      expect(node?.config).toMatchObject({
        chartType: entry.chartType,
        chartCatalogId: entry.id,
      });
    });
  });
});
