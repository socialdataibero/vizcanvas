import { CHART_CATALOG } from "@/lib/chartCatalog";
import { ChartConfig, ColumnInfo } from "@/types/nodes";

function isNumericColumn(column: ColumnInfo): boolean {
  return /int|decimal|double|float|real|numeric|number|hugeint|bigint|smallint|tinyint/i.test(column.type);
}

function isTemporalColumn(column: ColumnInfo): boolean {
  return /date|time|timestamp/i.test(column.type);
}

function isSpatialColumn(column: ColumnInfo): boolean {
  return column.role === "geometry" || column.role === "latitude" || column.role === "longitude";
}

function isIdentifierLikeColumn(column: ColumnInfo): boolean {
  return (
    column.role === "join_key" ||
    /(^|_| )(id|key|code|cve|clave|ent|mun|geoid|fips|iso)(_| |$)/i.test(column.name)
  );
}

function isCategoricalColumn(column: ColumnInfo): boolean {
  if (isSpatialColumn(column)) return false;
  return /char|text|string|uuid/i.test(column.type) || isTemporalColumn(column);
}

function chooseMetricColumn(columns: ColumnInfo[], excludedColumns: string[]): ColumnInfo | undefined {
  return (
    columns.find(
      (column) =>
        !excludedColumns.includes(column.name) &&
        !isSpatialColumn(column) &&
        !isIdentifierLikeColumn(column) &&
        isNumericColumn(column)
    ) ??
    columns.find((column) => !excludedColumns.includes(column.name) && !isSpatialColumn(column) && isNumericColumn(column)) ??
    columns.find((column) => !excludedColumns.includes(column.name) && !isSpatialColumn(column))
  );
}

function chooseMapLabelColumn(columns: ColumnInfo[], excludedColumns: string[]): ColumnInfo | undefined {
  return (
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column) &&
      !isNumericColumn(column) &&
      /name|nom|label|region|state|country|province|geo/i.test(column.name)
    ) ??
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column) &&
      !isNumericColumn(column) &&
      column.role === "join_key"
    ) ??
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column) &&
      isCategoricalColumn(column)
    ) ??
    columns.find((column) =>
      !excludedColumns.includes(column.name) &&
      !isSpatialColumn(column)
    )
  );
}

function chooseGridAxisColumn(
  columns: ColumnInfo[],
  axis: "x" | "y",
  excludedColumns: string[]
): ColumnInfo | undefined {
  const pattern = axis === "x"
    ? /(^|_| )(x|col|column|gridx)(_| |$)/i
    : /(^|_| )(y|row|gridy)(_| |$)/i;

  return (
    columns.find((column) => !excludedColumns.includes(column.name) && isNumericColumn(column) && pattern.test(column.name)) ??
    columns.find((column) => !excludedColumns.includes(column.name) && isNumericColumn(column))
  );
}

export function inferChartConfigDefaults(config: ChartConfig, columns: ColumnInfo[]): Partial<ChartConfig> {
  const normalizedColumns = columns;

  if (normalizedColumns.length === 0 || !config.chartType) {
    return {};
  }

  if (config.chartType === "choropleth") {
    const patch: Partial<ChartConfig> = {};
    const labelColumn = config.xColumn
      ? normalizedColumns.find((column) => column.name === config.xColumn)
      : chooseMapLabelColumn(normalizedColumns, []);
    const metricColumn = config.yColumn
      ? normalizedColumns.find((column) => column.name === config.yColumn)
      : chooseMetricColumn(normalizedColumns, labelColumn ? [labelColumn.name] : []);

    if (!config.chartCatalogId) patch.chartCatalogId = "world-choropleth";
    if (!config.xColumn && labelColumn) patch.xColumn = labelColumn.name;
    if (!config.yColumn && metricColumn) patch.yColumn = metricColumn.name;

    return patch;
  }

  if (config.chartType === "grid") {
    const patch: Partial<ChartConfig> = {};
    const xColumn = config.xColumn
      ? normalizedColumns.find((column) => column.name === config.xColumn)
      : chooseGridAxisColumn(normalizedColumns, "x", []);
    const yColumn = config.yColumn
      ? normalizedColumns.find((column) => column.name === config.yColumn)
      : chooseGridAxisColumn(normalizedColumns, "y", xColumn ? [xColumn.name] : []);
    const excluded = [xColumn?.name, yColumn?.name].filter((value): value is string => Boolean(value));
    const metricColumn = config.colorColumn
      ? normalizedColumns.find((column) => column.name === config.colorColumn)
      : chooseMetricColumn(normalizedColumns, excluded);
    const labelColumn = config.labelColumn
      ? normalizedColumns.find((column) => column.name === config.labelColumn)
      : chooseMapLabelColumn(normalizedColumns, [
          ...excluded,
          ...(metricColumn ? [metricColumn.name] : []),
        ]);

    if (!config.chartCatalogId) patch.chartCatalogId = "grid-cartogram";
    if (!config.xColumn && xColumn) patch.xColumn = xColumn.name;
    if (!config.yColumn && yColumn) patch.yColumn = yColumn.name;
    if (!config.colorColumn && metricColumn) patch.colorColumn = metricColumn.name;
    if (!config.labelColumn && labelColumn) patch.labelColumn = labelColumn.name;

    return patch;
  }

  if (config.chartType === "geoPoint") {
    const patch: Partial<ChartConfig> = {};
    const labelColumn = config.xColumn
      ? normalizedColumns.find((column) => column.name === config.xColumn)
      : chooseMapLabelColumn(normalizedColumns, []);
    const metricColumn = config.sizeColumn
      ? normalizedColumns.find((column) => column.name === config.sizeColumn)
      : chooseMetricColumn(normalizedColumns, labelColumn ? [labelColumn.name] : []);

    if (!config.chartCatalogId) patch.chartCatalogId = "dot-map";
    if (!config.xColumn && labelColumn) patch.xColumn = labelColumn.name;
    if (!config.sizeColumn && metricColumn) patch.sizeColumn = metricColumn.name;

    return patch;
  }

  if (config.chartType === "spike") {
    const patch: Partial<ChartConfig> = {};
    const labelColumn = config.xColumn
      ? normalizedColumns.find((column) => column.name === config.xColumn)
      : chooseMapLabelColumn(normalizedColumns, []);
    const metricColumn = config.lengthColumn
      ? normalizedColumns.find((column) => column.name === config.lengthColumn)
      : chooseMetricColumn(normalizedColumns, labelColumn ? [labelColumn.name] : []);

    if (!config.chartCatalogId) patch.chartCatalogId = "spike-map";
    if (!config.xColumn && labelColumn) patch.xColumn = labelColumn.name;
    if (!config.lengthColumn && metricColumn) patch.lengthColumn = metricColumn.name;

    return patch;
  }

  // Generic fallback for common chart types (bar, dot, line, area, etc.)
  const patch: Partial<ChartConfig> = {};

  // Look up catalog entry to know which fields this chart variant supports
  const catalogEntry = config.chartCatalogId
    ? CHART_CATALOG.find((e) => e.id === config.chartCatalogId)
    : undefined;
  const supportedFields = catalogEntry?.fields;

  const categoricalColumns = normalizedColumns.filter(
    (c) => isCategoricalColumn(c) && !isSpatialColumn(c) && !isIdentifierLikeColumn(c)
  );
  const numericColumns = normalizedColumns.filter(
    (c) => isNumericColumn(c) && !isSpatialColumn(c) && !isIdentifierLikeColumn(c)
  );

  const hasField = (field: string) => !supportedFields || field in supportedFields;

  if (!config.xColumn && hasField("x")) {
    // For charts needing a category on X (bar, dot, stackedBar): prefer categorical
    // For charts needing a value on X (histogram, beeswarm): prefer numeric
    const needsNumericX = config.chartType === "dot" || config.chartType === "histogram";
    const xCandidate = needsNumericX
      ? numericColumns[0] ?? categoricalColumns[0]
      : categoricalColumns[0] ?? numericColumns[0];
    if (xCandidate) patch.xColumn = xCandidate.name;
  }

  if (!config.yColumn && hasField("y")) {
    const excluded = patch.xColumn ?? config.xColumn ?? "";
    const yCandidate = numericColumns.find((c) => c.name !== excluded)
      ?? normalizedColumns.find((c) => c.name !== excluded && !isSpatialColumn(c));
    if (yCandidate) patch.yColumn = yCandidate.name;
  }

  return patch;
}
