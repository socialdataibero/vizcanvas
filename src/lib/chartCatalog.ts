import type { ChartIconName } from "@/components/charts/picker/chart-icons-lucide-outline";
import type { ChartType } from "@/types/nodes";

export type ChartGallerySection =
  | "COMPARISON"
  | "DISTRIBUTION"
  | "TIME"
  | "RELATIONSHIP"
  | "PART-TO-WHOLE"
  | "MAPS"
  | "FLOW";

export type ChartFieldKey = "x" | "y" | "x2" | "y2" | "color" | "size" | "length" | "label" | "facet";
export type ChartFieldRequirement = "required" | "optional";

export interface ChartCatalogEntry {
  id: string;
  label: string;
  iconName: ChartIconName;
  section: ChartGallerySection;
  description: string;
  supported: boolean;
  chartType?: ChartType;
  fields?: Partial<Record<ChartFieldKey, ChartFieldRequirement>>;
}

export const CHART_GALLERY_SECTIONS: ChartGallerySection[] = [
  "COMPARISON",
  "DISTRIBUTION",
  "TIME",
  "RELATIONSHIP",
  "PART-TO-WHOLE",
  "MAPS",
  "FLOW",
];

export const CHART_CATALOG: ChartCatalogEntry[] = [
  {
    id: "vertical-bar",
    label: "Columns",
    iconName: "ChartColumns",
    section: "COMPARISON",
    description: "Vertical bars for category comparisons.",
    supported: true,
    chartType: "bar",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "horizontal-bar",
    label: "Bars",
    iconName: "ChartBars",
    section: "COMPARISON",
    description: "Horizontal bars for rankings and long labels.",
    supported: true,
    chartType: "barX",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "grouped-bar",
    label: "Grouped",
    iconName: "ChartGrouped",
    section: "COMPARISON",
    description: "Side-by-side bars grouped by category and series.",
    supported: true,
    chartType: "bar",
    fields: { y: "required", color: "required", facet: "required" },
  },
  {
    id: "histogram",
    label: "Histogram",
    iconName: "ChartHistogram",
    section: "DISTRIBUTION",
    description: "Binned distribution of a continuous field.",
    supported: true,
    chartType: "histogram",
    fields: { x: "required" },
  },
  {
    id: "stacked-bar",
    label: "Stacked",
    iconName: "ChartStacked",
    section: "PART-TO-WHOLE",
    description: "Stacked segments showing part contribution per category.",
    supported: true,
    chartType: "stackedBar",
    fields: { x: "required", y: "required", color: "required" },
  },
  {
    id: "temporal-histogram",
    label: "Temporal",
    iconName: "ChartTemporal",
    section: "TIME",
    description: "Histogram-like counts over time intervals.",
    supported: true,
    chartType: "histogram",
    fields: { x: "required" },
  },
  {
    id: "line-chart",
    label: "Line",
    iconName: "ChartLine",
    section: "TIME",
    description: "Single-series line chart.",
    supported: true,
    chartType: "line",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "multi-series-line",
    label: "Multi-line",
    iconName: "ChartMultiLine",
    section: "TIME",
    description: "Multiple lines split by a series field.",
    supported: true,
    chartType: "line",
    fields: { x: "required", y: "required", color: "required" },
  },
  {
    id: "area-chart",
    label: "Area",
    iconName: "ChartArea",
    section: "TIME",
    description: "Area chart emphasizing magnitude over time.",
    supported: true,
    chartType: "area",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "scatterplot",
    label: "Scatter",
    iconName: "ChartScatter",
    section: "RELATIONSHIP",
    description: "Relationship between two quantitative fields.",
    supported: true,
    chartType: "scatter",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "color-scatterplot",
    label: "Color scatter",
    iconName: "ChartColorScatter",
    section: "RELATIONSHIP",
    description: "Scatterplot with group encoded as color.",
    supported: true,
    chartType: "scatter",
    fields: { x: "required", y: "required", color: "required" },
  },
  {
    id: "bubble-chart",
    label: "Bubble",
    iconName: "ChartBubble",
    section: "RELATIONSHIP",
    description: "Scatterplot with bubble size encoding a third measure.",
    supported: true,
    chartType: "scatter",
    fields: { x: "required", y: "required", size: "required", color: "optional" },
  },
  {
    id: "dot-comparison",
    label: "Dot plot",
    iconName: "ChartDotPlot",
    section: "COMPARISON",
    description: "Category comparison using dots instead of bars.",
    supported: true,
    chartType: "dot",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "beeswarm",
    label: "Beeswarm",
    iconName: "ChartBeeswarm",
    section: "DISTRIBUTION",
    description: "Jittered dots to show individual observations without overlap.",
    supported: true,
    chartType: "dot",
    fields: { x: "required", color: "optional" },
  },
  {
    id: "box-plot",
    label: "Box plot",
    iconName: "ChartBoxPlot",
    section: "DISTRIBUTION",
    description: "Quartiles and spread by category.",
    supported: true,
    chartType: "box",
    fields: { x: "required", y: "required" },
  },
  {
    id: "faceted-histogram",
    label: "Faceted",
    iconName: "ChartFaceted",
    section: "DISTRIBUTION",
    description: "Small-multiple histograms split by a category.",
    supported: true,
    chartType: "histogram",
    fields: { x: "required", facet: "required", color: "optional" },
  },
  {
    id: "barcode-strip-plot",
    label: "Strip",
    iconName: "ChartStrip",
    section: "DISTRIBUTION",
    description: "Each record rendered as a thin tick.",
    supported: true,
    chartType: "dot",
    fields: { x: "required" },
  },
  {
    id: "heatmap",
    label: "Heatmap",
    iconName: "ChartHeatmap",
    section: "RELATIONSHIP",
    description: "Matrix-style intensity map.",
    supported: true,
    chartType: "heatmap",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "treemap",
    label: "Treemap",
    iconName: "ChartTreemap",
    section: "PART-TO-WHOLE",
    description: "Nested rectangles for hierarchical part-to-whole structure.",
    supported: true,
    chartType: "treemap",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "waffle-chart",
    label: "Waffle",
    iconName: "ChartWaffle",
    section: "PART-TO-WHOLE",
    description: "Part-to-whole shown as a grid of equal units.",
    supported: true,
    chartType: "waffle",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "waterfall-chart",
    label: "Waterfall",
    iconName: "ChartWaterfall",
    section: "PART-TO-WHOLE",
    description: "Sequential increases and decreases to a final total.",
    supported: true,
    chartType: "waterfall",
    fields: { x: "required", y: "required", color: "optional" },
  },
  {
    id: "arc-map",
    label: "Arc Map",
    iconName: "ChartArcMap",
    section: "FLOW",
    description: "Curved connections between locations.",
    supported: true,
    chartType: "arc",
    fields: { x: "required", y: "required", x2: "required", y2: "required", length: "optional", color: "optional" },
  },
  {
    id: "world-choropleth",
    label: "Choropleth",
    iconName: "ChartChoropleth",
    section: "MAPS",
    description: "Values encoded over geographic regions.",
    supported: true,
    chartType: "choropleth",
    fields: { x: "required", y: "required" },
  },
  {
    id: "dot-map",
    label: "Bubble map",
    iconName: "ChartBubbleMap",
    section: "MAPS",
    description: "Points or bubbles placed over geography.",
    supported: true,
    chartType: "geoPoint",
    fields: { x: "required", y: "required", color: "optional", size: "optional" },
  },
  {
    id: "spike-map",
    label: "Spike map",
    iconName: "ChartTemporal",
    section: "MAPS",
    description: "Vertical spikes over locations, sized by magnitude.",
    supported: true,
    chartType: "spike",
    fields: { x: "required", y: "required", length: "required", color: "optional" },
  },
  {
    id: "grid-cartogram",
    label: "Cartogram",
    iconName: "ChartCartogram",
    section: "MAPS",
    description: "Grid-based geographic cartogram.",
    supported: true,
    chartType: "grid",
    fields: { x: "required", y: "required", color: "required", label: "optional" },
  },
  {
    id: "link-chart",
    label: "Link",
    iconName: "ChartLink",
    section: "FLOW",
    description: "Source-destination link visualization.",
    supported: true,
    chartType: "link",
    fields: { x: "required", y: "required", x2: "required", y2: "required", color: "optional", label: "optional" },
  },
  {
    id: "sankey-diagram",
    label: "Sankey",
    iconName: "ChartSankey",
    section: "FLOW",
    description: "Flow thickness indicates quantity across steps.",
    supported: true,
    chartType: "sankey",
    fields: { x: "required", y: "required", size: "required", color: "optional" },
  },
];

const CHART_CATALOG_BY_ID = new Map(CHART_CATALOG.map((entry) => [entry.id, entry]));

const FALLBACK_CATALOG_BY_TYPE: Partial<Record<ChartType, string>> = {
  scatter: "scatterplot",
  dot: "dot-comparison",
  histogram: "histogram",
  bar: "vertical-bar",
  barY: "vertical-bar",
  barX: "horizontal-bar",
  line: "line-chart",
  area: "area-chart",
  box: "box-plot",
  heatmap: "heatmap",
  stackedBar: "stacked-bar",
  waffle: "waffle-chart",
  waterfall: "waterfall-chart",
  treemap: "treemap",
  grid: "grid-cartogram",
  link: "link-chart",
  choropleth: "world-choropleth",
  geoPoint: "dot-map",
  spike: "spike-map",
  arc: "arc-map",
  sankey: "sankey-diagram",
};

export function getChartCatalogEntry(
  chartCatalogId?: string,
  chartType?: ChartType
): ChartCatalogEntry | null {
  if (chartCatalogId) {
    return CHART_CATALOG_BY_ID.get(chartCatalogId) ?? null;
  }

  if (!chartType) return null;
  const fallback = FALLBACK_CATALOG_BY_TYPE[chartType];
  return fallback ? CHART_CATALOG_BY_ID.get(fallback) ?? null : null;
}
