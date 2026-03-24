import type { ChartCatalogEntry, ChartFieldKey } from "@/lib/chartCatalog";
import type { ChartConfig, ChartType, ColumnInfo } from "@/types/nodes";

const FIELD_TO_CONFIG_KEY: Record<ChartFieldKey, keyof ChartConfig> = {
  x: "xColumn",
  y: "yColumn",
  x2: "x2Column",
  y2: "y2Column",
  color: "colorColumn",
  size: "sizeColumn",
  length: "lengthColumn",
  label: "labelColumn",
  facet: "facetColumn",
};

function isNumericType(type: string): boolean {
  return /int|decimal|double|float|real|numeric|number|hugeint|bigint|smallint|tinyint|uinteger|ubigint|usmallint|utinyint/i.test(type);
}

export function getFieldOrder(
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined
): ChartFieldKey[] {
  if (entry?.fields) {
    return Object.keys(entry.fields) as ChartFieldKey[];
  }

  switch (entry?.id ?? chartType) {
    case "world-choropleth":
    case "choropleth":
      return ["x", "y"];
    case "dot-map":
    case "geoPoint":
      return ["x", "size", "color"];
    case "spike-map":
    case "spike":
      return ["x", "length", "color"];
    case "arc-map":
    case "arc":
      return ["x", "y", "x2", "y2", "length", "color"];
    case "grid-cartogram":
    case "grid":
      return ["x", "y", "color", "label"];
    case "link-chart":
    case "link":
      return ["x", "y", "x2", "y2", "label", "color"];
    case "sankey-diagram":
      return ["x", "y", "size", "color"];
    default:
      return ["y", "x", "color", "size", "facet"];
  }
}

export function getColumnOptions(
  field: ChartFieldKey,
  entry: ChartCatalogEntry | null,
  chartType: ChartType | undefined,
  allColumns: ColumnInfo[],
  numericColumns: ColumnInfo[]
) {
  const numericOrAll = numericColumns.length > 0 ? numericColumns : allColumns;
  const categoricalColumns = allColumns.filter(
    (column) =>
      !isNumericType(column.type) &&
      column.role !== "geometry" &&
      column.role !== "latitude" &&
      column.role !== "longitude"
  );
  const categoricalOrAll = categoricalColumns.length > 0 ? categoricalColumns : allColumns;
  const temporalColumns = allColumns.filter(
    (column) => /date|time|timestamp/i.test(column.type) || /date|time|year|month|day/i.test(column.name)
  );
  const temporalOrAll = temporalColumns.length > 0 ? temporalColumns : allColumns;
  const geoLongitudeColumns = allColumns.filter((column) => column.role === "longitude");
  const geoLatitudeColumns = allColumns.filter((column) => column.role === "latitude");
  const geoXColumns = geoLongitudeColumns.length > 0 ? geoLongitudeColumns : numericOrAll;
  const geoYColumns = geoLatitudeColumns.length > 0 ? geoLatitudeColumns : numericOrAll;

  switch (entry?.id ?? chartType) {
    case "world-choropleth":
      return field === "y" ? numericOrAll : allColumns;
    case "dot-map":
      if (field === "x") return allColumns;
      if (field === "size") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return [];
    case "spike-map":
    case "spike":
      if (field === "x") return allColumns;
      if (field === "length") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return [];
    case "arc-map":
    case "arc":
      if (field === "x" || field === "x2") return geoXColumns;
      if (field === "y" || field === "y2") return geoYColumns;
      if (field === "length") return numericOrAll;
      return allColumns;
    case "sankey-diagram":
      if (field === "size") return numericOrAll;
      return allColumns;
    case "stacked-bar":
      if (field === "y") return numericOrAll;
      if (field === "x" || field === "color") return categoricalOrAll;
      return allColumns;
    case "waffle-chart":
      if (field === "y") return numericOrAll;
      if (field === "x" || field === "color") return categoricalOrAll;
      return allColumns;
    case "waterfall-chart":
      if (field === "y") return numericOrAll;
      if (field === "x" || field === "color") return categoricalOrAll;
      return allColumns;
    case "treemap":
      if (field === "y") return numericOrAll;
      if (field === "x" || field === "color") return categoricalOrAll;
      return allColumns;
    case "grid-cartogram":
      if (field === "x" || field === "y" || field === "color") return numericOrAll;
      if (field === "label") return allColumns;
      return [];
    case "link-chart":
    case "link":
      if (field === "x" || field === "y" || field === "x2" || field === "y2") {
        return numericOrAll;
      }
      return allColumns;
    case "vertical-bar":
    case "bar":
    case "barY":
      if (field === "x") return categoricalOrAll;
      if (field === "y") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return allColumns;
    case "horizontal-bar":
    case "barX":
      if (field === "x") return numericOrAll;
      if (field === "y") return categoricalOrAll;
      if (field === "color") return categoricalOrAll;
      return allColumns;
    case "grouped-bar":
      if (field === "y") return numericOrAll;
      if (field === "color" || field === "facet") return categoricalOrAll;
      return allColumns;
    case "dot-comparison":
      if (field === "x") return categoricalOrAll;
      if (field === "y") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return allColumns;
    case "histogram":
      return field === "x" ? allColumns : [];
    case "temporal-histogram":
      return field === "x" ? temporalOrAll : [];
    case "faceted-histogram":
      if (field === "x") return numericOrAll;
      if (field === "facet" || field === "color") return allColumns;
      return [];
    case "line-chart":
    case "line":
    case "area-chart":
    case "area":
      if (field === "x") return temporalOrAll;
      if (field === "y") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return allColumns;
    case "multi-series-line":
      if (field === "x") return temporalOrAll;
      if (field === "y") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return allColumns;
    case "bubble-chart":
      if (field === "size" || field === "x" || field === "y") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return allColumns;
    case "scatter":
    case "scatterplot":
    case "color-scatterplot":
      if (field === "x" || field === "y") return numericOrAll;
      if (field === "color") return categoricalOrAll;
      return allColumns;
    case "box":
    case "box-plot":
      if (field === "y") return numericOrAll;
      if (field === "x") return categoricalOrAll;
      return allColumns;
    case "barcode-strip-plot":
    case "beeswarm":
      return field === "x" ? numericOrAll : allColumns;
    case "heatmap":
      if (field === "color") return numericOrAll;
      return allColumns;
    default:
      if (field === "y" || field === "size") return numericOrAll;
      return allColumns;
  }
}

export function getIncompatibleChartConfigPatch(
  config: ChartConfig,
  entry: ChartCatalogEntry | null,
  allColumns: ColumnInfo[]
): Partial<ChartConfig> {
  if (!config.chartType || allColumns.length === 0) {
    return {};
  }

  const numericColumns = allColumns.filter((column) => isNumericType(column.type));
  const activeFields = new Set(getFieldOrder(entry, config.chartType));
  const patch: Partial<ChartConfig> = {};

  (Object.keys(FIELD_TO_CONFIG_KEY) as ChartFieldKey[]).forEach((field) => {
    const configKey = FIELD_TO_CONFIG_KEY[field];
    const value = config[configKey];

    if (!value) return;

    if (!activeFields.has(field)) {
      patch[configKey] = undefined;
      return;
    }

    const options = getColumnOptions(field, entry, config.chartType, allColumns, numericColumns);
    const isCompatible = options.some((column) => column.name === value);

    if (!isCompatible) {
      patch[configKey] = undefined;
    }
  });

  return patch;
}
