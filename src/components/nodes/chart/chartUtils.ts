import type * as PlotModule from "@observablehq/plot";
import type { ChartCatalogEntry, ChartFieldKey, ChartFieldRequirement } from "@/lib/chartCatalog";
import type { ChartConfig, ChartType } from "@/types/nodes";

export function getFieldLabel(
  field: ChartFieldKey,
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined
): string {
  switch (field) {
    case "x":
      if (entry?.id === "world-choropleth") return "Feature label";
      if (entry?.id === "spike-map") return "Feature label";
      if (entry?.id === "dot-map") return "Feature label";
      if (entry?.id === "grid-cartogram") return "Grid X";
      if (entry?.id === "arc-map") return "Origin Lon";
      if (entry?.id === "sankey-diagram") return "Source";
      if (entry?.id === "waterfall-chart") return "Step";
      if (entry?.id === "treemap") return "Item";
      if (entry?.id === "link-chart") return "Start X";
      if (entry?.id === "line-chart" || entry?.id === "multi-series-line" || entry?.id === "area-chart" || entry?.id === "temporal-histogram") return "Time";
      if (entry?.id === "vertical-bar" || entry?.id === "dot-comparison" || entry?.id === "box-plot" || entry?.id === "waffle-chart" || entry?.id === "stacked-bar") return "Category";
      if (entry?.id === "barcode-strip-plot" || entry?.id === "beeswarm" || entry?.id === "histogram" || entry?.id === "faceted-dodge") return "Value";
      if (entry?.id === "horizontal-bar") return "Value";
      if (entry?.id === "grouped-bar") return "Series";
      return chartType === "histogram" ? "Value" : "X";
    case "y":
      if (entry?.id === "world-choropleth") return "Value";
      if (entry?.id === "arc-map") return "Origin Lat";
      if (entry?.id === "sankey-diagram") return "Target";
      if (entry?.id === "waterfall-chart") return "Change";
      if (entry?.id === "treemap" || entry?.id === "waffle-chart" || entry?.id === "stacked-bar" || entry?.id === "grouped-bar" || entry?.id === "vertical-bar" || entry?.id === "dot-comparison" || entry?.id === "box-plot" || entry?.id === "line-chart" || entry?.id === "multi-series-line" || entry?.id === "area-chart") return "Value";
      if (entry?.id === "heatmap") return "Row";
      if (entry?.id === "grid-cartogram") return "Grid Y";
      if (entry?.id === "link-chart") return "Start Y";
      if (entry?.id === "barcode-strip-plot") return "Category";
      if (entry?.id === "horizontal-bar") return "Category";
      return "Y";
    case "x2":
      if (entry?.id === "arc-map") return "Dest Lon";
      if (entry?.id === "link-chart") return "End X";
      return "X2";
    case "y2":
      if (entry?.id === "arc-map") return "Dest Lat";
      if (entry?.id === "link-chart") return "End Y";
      return "Y2";
    case "color":
      if (entry?.id === "dot-map") return "Group";
      if (entry?.id === "arc-map") return "Color";
      if (entry?.id === "spike-map") return "Group";
      if (entry?.id === "sankey-diagram") return "Group";
      if (entry?.id === "stacked-bar") return "Segment";
      if (entry?.id === "treemap") return "Group";
      if (entry?.id === "grid-cartogram" || entry?.id === "heatmap") return "Value";
      if (entry?.id === "link-chart") return "Color";
      if (entry?.id === "barcode-strip-plot") return "Group";
      if (entry?.id === "grouped-bar" || entry?.id === "multi-series-line") return "Series";
      return "Color";
    case "size":
      if (entry?.id === "dot-map") return "Magnitude";
      if (entry?.id === "sankey-diagram") return "Value";
      return "Size";
    case "length":
      if (entry?.id === "arc-map") return "Weight";
      if (entry?.id === "spike-map") return "Magnitude";
      return "Length";
    case "label":
      if (entry?.id === "grid-cartogram") return "Label";
      if (entry?.id === "link-chart") return "Label";
      return "Label";
    case "facet":
      if (entry?.id === "grouped-bar") return "Group";
      if (entry?.id === "faceted-dodge") return "Group";
      return "Facet";
  }
}

export const BASE_CHART_COLOR = "#14b8a6";
export const ALL_CHART_FIELDS: ChartFieldKey[] = ["x", "y", "x2", "y2", "color", "size", "length", "label", "facet"];
export const MAX_INLINE_CATEGORICAL_LEGEND_ITEMS = 8;


export function getBarYMarkOptions(xColumn: string, yColumn: string, fill: string) {
  return { x: xColumn, y: yColumn, fill };
}

export function getBarXMarkOptions(yColumn: string, xColumn: string, fill: string) {
  return { y: yColumn, x: xColumn, fill };
}

export function getCompactSwatchLegendOptions(..._args: unknown[]) {
  return { legend: true };
}

export function getQuantitativeLegendOptions(label: string, values: unknown[] = []) {
  const tickSample = formatAxisTickValue(0, label, values);
  return {
    legend: true,
    label,
    ...(tickSample === undefined
      ? {}
      : { tickFormat: (value: number) => formatAxisTickValue(value, label, values) ?? value }),
  };
}

export function isPercentageLikeColumnName(name?: string | null) {
  return Boolean(name && /pct|percent|percentage|porcentaje|tasa|rate|ratio/i.test(name));
}

export function isAverageLikeColumnName(name?: string | null) {
  return Boolean(name && /price|cost|rate|ratio|score|avg|mean|margin|pct|percent|percentage|porcentaje/i.test(name));
}

export function getReducerForColumnName(name?: string | null) {
  return isAverageLikeColumnName(name) ? "mean" : "sum";
}

export function getAxisLabel(
  field: "x" | "y",
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  column?: string,
  counterpartColumn?: string
) {
  if (!column) return undefined;
  if (counterpartColumn && counterpartColumn === column) return column;
  if (entry?.id === "grouped-bar" && field === "x") return getFieldLabel("color", entry, chartType);
  return column;
}

export function mergeAxisOptions(existing: unknown, label?: string) {
  if (
    existing &&
    typeof existing === "object" &&
    "axis" in (existing as Record<string, unknown>) &&
    (existing as Record<string, unknown>).axis === null
  ) {
    return existing;
  }
  if (!label) return existing;
  return {
    ...(existing && typeof existing === "object" ? (existing as Record<string, unknown>) : {}),
    label,
  };
}

export function formatAxisTickValue(value: number, columnName?: string, values: unknown[] = []) {
  const numericValues = values
    .map((entry) => (typeof entry === "number" ? entry : Number(entry)))
    .filter((entry) => Number.isFinite(entry));
  const maxAbs =
    numericValues.length > 0
      ? Math.max(...numericValues.map((entry) => Math.abs(entry)))
      : Math.abs(value);

  if (isPercentageLikeColumnName(columnName)) {
    const usesUnitScale = maxAbs <= 1;
    const normalizedValue = usesUnitScale ? value * 100 : value;
    return `${new Intl.NumberFormat("en-US", {
      maximumFractionDigits: Math.abs(normalizedValue) >= 10 ? 0 : 1,
    }).format(normalizedValue)}%`;
  }

  if (maxAbs >= 1000) {
    return new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }

  return undefined;
}

export function mergeAxisDisplayOptions(
  existing: unknown,
  label: string | undefined,
  columnName?: string,
  values: unknown[] = []
) {
  const merged = mergeAxisOptions(existing, label);
  if (!columnName || !merged || typeof merged !== "object") return merged;
  if ((merged as Record<string, unknown>).percent === true) return merged;

  const tickSample = formatAxisTickValue(0, columnName, values);
  if (tickSample === undefined) return merged;

  return {
    ...(merged as Record<string, unknown>),
    tickFormat: (value: number) => formatAxisTickValue(value, columnName, values) ?? value,
  };
}

export function roundUpToNiceStep(value: number) {
  if (value <= 0) return 1;
  if (value <= 5) return Math.ceil(value);
  if (value <= 10) return Math.ceil(value / 2) * 2;
  if (value <= 25) return Math.ceil(value / 5) * 5;
  if (value <= 50) return Math.ceil(value / 10) * 10;
  if (value <= 100) return Math.ceil(value / 20) * 20;
  if (value <= 250) return Math.ceil(value / 50) * 50;
  if (value <= 500) return Math.ceil(value / 100) * 100;
  if (value <= 1000) return Math.ceil(value / 200) * 200;
  return Math.ceil(value / 20) * 20;
}

export function isNumericType(type: string): boolean {
  return /int|float|double|decimal|numeric|real|bigint|smallint|tinyint/i.test(type);
}

export function toFiniteNumber(value: unknown): number | null {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

export function alignSvgTopLeft(markup: string) {
  if (!markup.includes("<svg") || typeof document === "undefined") return markup;
  const container = document.createElement("div");
  container.innerHTML = markup;
  const targetSvg = Array.from(container.querySelectorAll("svg")).find(
    (svg) => !Array.from(svg.classList).some((className) => className.endsWith("-ramp"))
  );
  if (!targetSvg) return markup;
  targetSvg.setAttribute("preserveAspectRatio", "xMinYMin meet");
  return container.innerHTML;
}

export function injectSvgStyle(markup: string, style: string) {
  if (!markup.includes("<svg")) return markup;
  if (markup.includes('style="')) {
    return markup.replace(/style="([^"]*)"/, (_match, existing) => `style="${existing}; ${style}"`);
  }
  return markup.replace("<svg", `<svg style="${style}"`);
}

export function normalizeSvgImageHref(markup: string) {
  return markup.replace(/\sxlink:href=/g, " href=");
}

export function compactSwatchLegendMarkup(markup: string) {
  const prefixMatch = markup.match(/class="([^"]*?(plot-[^"\s]+))-swatches\b/);
  const prefix = prefixMatch?.[2];
  if (!prefix || !markup.includes(`${prefix}-swatches-wrap`)) return markup;

  const compactLegendStyle = `<style>
:where(.${prefix}-swatches) { font-size: 9px !important; line-height: 1.05; margin-bottom: 0.35em !important; }
:where(.${prefix}-swatches-wrap) { align-items: flex-start !important; min-height: 22px !important; gap: 4px 6px; max-width: 100%; justify-content: flex-start !important; }
:where(.${prefix}-swatches-wrap .${prefix}-swatch) { margin-right: 0 !important; max-width: 180px; white-space: normal; overflow: visible; text-overflow: clip; line-height: 1.15; }
:where(.${prefix}-swatch > svg) { width: 10px; height: 10px; margin-right: 0.35em !important; flex: none; }
</style>`;

  return markup.replace("</style>", `</style>${compactLegendStyle}`);
}

export type SpikeLegendMode = "percent" | "compact" | "plain";

export function getSpikeLegendMode(values: number[], columnName?: string): SpikeLegendMode {
  const finiteValues = values.filter((value) => Number.isFinite(value) && value >= 0);
  if (finiteValues.length === 0) return "plain";
  const maxValue = Math.max(...finiteValues);
  if (isPercentageLikeColumnName(columnName) && maxValue <= 100) return "percent";
  if (maxValue >= 1000) return "compact";
  return "plain";
}

export function formatSpikeLegendValue(value: number, mode: SpikeLegendMode) {
  if (mode === "percent") {
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value)}%`;
  }
  if (mode === "compact") {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: value >= 10 ? 0 : 1 }).format(value);
}

export function getSpikeLengthRange(mode: SpikeLegendMode, maxValue: number) {
  if (mode === "percent") return [0, 64];
  if (mode === "compact") return [0, 110];
  return maxValue <= 100 ? [0, 80] : [0, 96];
}

export function buildSpikeLegendValues(values: number[], mode: SpikeLegendMode) {
  const finiteValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finiteValues.length === 0) return [];
  const maxValue = Math.max(...finiteValues);
  if (mode === "percent" || mode === "plain") {
    const niceMax = roundUpToNiceStep(maxValue);
    const step = Math.max(1, niceMax / 4);
    return Array.from({ length: 4 }, (_, index) => step * (index + 1)).filter((value) => value <= niceMax);
  }
  const step = maxValue / 4;
  return Array.from({ length: 4 }, (_, index) => step * (index + 1)).filter((value) => value > 0);
}

export function buildSpikeLegendMarks(
  Plot: typeof PlotModule,
  values: number[],
  mode: SpikeLegendMode,
  stroke: string,
  frameAnchor: "bottom-right" | "bottom-left" | "top-right" | "top-left" = "bottom-right"
): PlotModule.Markish[] {
  const legendValues = buildSpikeLegendValues(values, mode);
  if (legendValues.length === 0) return [];

  return legendValues.flatMap((value, index) => {
    const dx = (index - legendValues.length) * 26;
    return [
      Plot.spike([value], { length: [value], dx, dy: -24, frameAnchor, stroke } as Record<string, unknown>),
      Plot.text([value], {
        text: [formatSpikeLegendValue(value, mode)],
        dx,
        dy: -8,
        frameAnchor,
        textAnchor: "middle",
      } as Record<string, unknown>),
    ];
  });
}

export function getFieldRequirement(
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  field: ChartFieldKey
): ChartFieldRequirement | null {
  if (entry?.fields) return entry.fields[field] ?? null;

  switch (chartType) {
    case "histogram": return field === "x" ? "required" : null;
    case "heatmap":
      if (field === "x" || field === "y") return "required";
      return field === "color" ? "optional" : null;
    case "choropleth": return field === "x" || field === "y" ? "required" : null;
    case "geoPoint":
      if (field === "x") return "required";
      return field === "color" || field === "size" ? "optional" : null;
    case "spike":
      if (field === "x" || field === "length") return "required";
      return field === "color" ? "optional" : null;
    case "arc":
      if (field === "x" || field === "y" || field === "x2" || field === "y2") return "required";
      return field === "color" || field === "length" ? "optional" : null;
    case "link":
      if (field === "x" || field === "y" || field === "x2" || field === "y2") return "required";
      return field === "color" || field === "label" ? "optional" : null;
    case "scatter":
    case "dot":
      if (field === "x") return "required";
      if (field === "y") return chartType === "scatter" ? "required" : "optional";
      if (field === "color" || field === "size") return "optional";
      return null;
    case "box": return field === "x" || field === "y" ? "required" : null;
    case "stackedBar":
      if (field === "x" || field === "y" || field === "color") return "required";
      return null;
    case "waffle":
    case "waterfall":
    case "treemap":
      if (field === "x" || field === "y") return "required";
      return field === "color" ? "optional" : null;
    case "grid":
      if (field === "x" || field === "y" || field === "color") return "required";
      return field === "label" ? "optional" : null;
    case "bar":
    case "barY":
    case "barX":
    case "line":
    case "area":
    case "pie":
      if (field === "x" || field === "y") return "required";
      return field === "color" ? "optional" : null;
    default: return null;
  }
}

export function getMissingConfigFields(config: ChartConfig, entry: ChartCatalogEntry | null): ChartFieldKey[] {
  if (!config.chartType) return ["x"];
  return ALL_CHART_FIELDS.filter((field) => {
    if (getFieldRequirement(entry, config.chartType, field) !== "required") return false;
    switch (field) {
      case "x": return !config.xColumn;
      case "y": return !config.yColumn;
      case "x2": return !config.x2Column;
      case "y2": return !config.y2Column;
      case "color": return !config.colorColumn;
      case "size": return !config.sizeColumn;
      case "length": return !config.lengthColumn;
      case "label": return !config.labelColumn;
      case "facet": return !config.facetColumn;
    }
  });
}

export function isChartReady(config: ChartConfig, entry: ChartCatalogEntry | null): boolean {
  if (!config.chartType) return false;
  return getMissingConfigFields(config, entry).length === 0;
}

export function getChartSetupMessage(config: ChartConfig, entry: ChartCatalogEntry | null): string {
  if (!config.chartType) return "Chart type not selected";
  const missing = getMissingConfigFields(config, entry);
  if (missing.length === 0) return "";
  return `Choose ${missing.map((field) => getFieldLabel(field, entry, config.chartType)).join(", ")}`;
}

export type GridCartogramDatum = {
  gridX: number;
  gridY: number;
  value: number;
  label: string | null;
};

export function buildGridCartogramData(
  data: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  valueColumn: string,
  labelColumn?: string
): GridCartogramDatum[] {
  return data.flatMap((row) => {
    const gridX = toFiniteNumber(row[xColumn]);
    const gridY = toFiniteNumber(row[yColumn]);
    const value = toFiniteNumber(row[valueColumn]);
    if (gridX === null || gridY === null || value === null) return [];
    return [{
      gridX,
      gridY,
      value,
      label:
        labelColumn && row[labelColumn] !== undefined && row[labelColumn] !== null
          ? String(row[labelColumn])
          : null,
    }];
  });
}

export function isGridRatioDomain(values: number[]) {
  return values.length > 0 && values.every((value) => value > 0) && Math.min(...values) < 1 && Math.max(...values) > 1;
}

export function formatGridCartogramValue(value: number, ratioDomain: boolean) {
  if (ratioDomain) {
    const percentChange = (value - 1) * 100;
    const rounded = Math.abs(percentChange) >= 10 ? Math.round(percentChange) : Math.round(percentChange * 10) / 10;
    return `${rounded > 0 ? "+" : ""}${rounded}%`;
  }
  if (Math.abs(value) >= 1000) {
    return new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  }
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 1 }).format(value);
}

export function buildWaterfallData(
  data: Record<string, unknown>[],
  xColumn: string,
  yColumn: string,
  colorColumn?: string
) {
  let runningTotal = 0;
  return data.flatMap((row) => {
    const change = toFiniteNumber(row[yColumn]);
    const step = row[xColumn];
    if (change === null || step === undefined || step === null) return [];
    const start = runningTotal;
    const end = runningTotal + change;
    runningTotal = end;
    return [{
      step: String(step),
      start,
      end,
      change,
      label: change > 0 ? `+${change}` : `${change}`,
      fill:
        colorColumn && row[colorColumn] !== undefined && row[colorColumn] !== null
          ? String(row[colorColumn])
          : change >= 0 ? "Increase" : "Decrease",
    }];
  });
}

export function aggregateCategoryValues(
  data: Record<string, unknown>[],
  categoryColumn: string,
  valueColumn: string,
  reducer: "sum" | "mean",
  groupColumn?: string
) {
  const grouped = new Map<string, { category: string; group?: string; total: number; count: number }>();
  data.forEach((row) => {
    const category = row[categoryColumn];
    const numericValue = toFiniteNumber(row[valueColumn]);
    if (category === undefined || category === null || numericValue === null) return;
    const groupValue =
      groupColumn && row[groupColumn] !== undefined && row[groupColumn] !== null
        ? String(row[groupColumn])
        : undefined;
    const key = `${String(category)}__${groupValue ?? ""}`;
    const current = grouped.get(key) ?? {
      category: String(category),
      ...(groupValue ? { group: groupValue } : {}),
      total: 0,
      count: 0,
    };
    current.total += numericValue;
    current.count += 1;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).map((entry) => ({
    category: entry.category,
    value: reducer === "mean" ? entry.total / Math.max(entry.count, 1) : entry.total,
    ...(entry.group ? { group: entry.group } : {}),
  }));
}

export function getWaffleUnit(values: number[], columnName?: string) {
  const finiteValues = values.filter((value) => Number.isFinite(value) && value > 0);
  if (finiteValues.length === 0) return 1;
  const maxValue = Math.max(...finiteValues);
  if (isPercentageLikeColumnName(columnName) && maxValue <= 100) return 1;
  return Math.max(1, roundUpToNiceStep(maxValue / 80));
}

export function buildWaffleMark(
  Plot: typeof PlotModule,
  data: Record<string, unknown>[],
  options: { x: string; y: string; fill?: string; reducer?: "sum" | "mean" }
) {
  const reducer = options.reducer ?? getReducerForColumnName(options.y);
  const waffleData = aggregateCategoryValues(data, options.x, options.y, reducer, options.fill);
  const unit = getWaffleUnit(waffleData.map((entry) => entry.value), options.y);
  return Plot.waffleY(waffleData, {
    x: "category",
    y: "value",
    fill: options.fill ? "group" : BASE_CHART_COLOR,
    unit,
  } as Record<string, unknown>);
}
