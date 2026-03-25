export type NodeType =
  | "from"
  | "sql"
  | "group"
  | "join"
  | "chart"
  | "table"
  | "distinct"
  | "javascript"
  | "controls";

export interface ColumnInfo {
  name: string;
  type: string; // DuckDB type string
  nullable: boolean;
  role?: "geometry" | "latitude" | "longitude" | "join_key";
}

export interface TableSchema {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
}

export interface QueryResult {
  columns: ColumnInfo[];
  rows: Record<string, unknown>[];
  totalRows: number;
  sql: string;
}

// Node-specific configs

export interface FromConfig {
  tableName: string;
  filters: ColumnFilter[];
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  selectedColumns?: string[];
}

export interface SQLConfig {
  query: string;
  autoRun: boolean;
}

export interface GroupConfig {
  groupByColumns: string[];
  aggregations: AggregationConfig[];
  configVersion?: number;
  lastRunVersion?: number;
}

export interface AggregationConfig {
  column?: string;
  function?: "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";
  alias?: string;
}

export interface JoinConfig {
  joinType: "INNER" | "LEFT" | "RIGHT" | "FULL";
  leftColumn: string;
  rightColumn: string;
  configVersion?: number;
  lastRunVersion?: number;
}

export interface ChartConfig {
  chartType?: ChartType;
  chartCatalogId?: string;
  xColumn?: string;
  yColumn?: string;
  x2Column?: string;
  y2Column?: string;
  colorColumn?: string;
  sizeColumn?: string;
  lengthColumn?: string;
  labelColumn?: string;
  facetColumn?: string;
  beeswarmAnchor?: "top" | "middle" | "bottom";
  title?: string;
  caption?: string;
  brushSelection?: BrushSelection;
  customCode?: string;
  customEnabled?: boolean;
  customBaseChartId?: string;
}

export type ChartType =
  | "bar"
  | "line"
  | "scatter"
  | "area"
  | "pie"
  | "histogram"
  | "heatmap"
  | "box"
  | "dot"
  | "barY"
  | "barX"
  | "stackedBar"
  | "waffle"
  | "waterfall"
  | "treemap"
  | "grid"
  | "link"
  | "choropleth"
  | "geoPoint"
  | "spike"
  | "arc"
  | "sankey";

export interface BrushSelection {
  x?: [number, number];
  y?: [number, number];
}

export interface TableDisplayConfig {
  sortColumn?: string;
  sortDirection?: "asc" | "desc";
  hiddenColumns: string[];
  columnOrder?: string[];
  columnWidths?: Record<string, number>;
}

export interface DistinctConfig {
  columns: string[];
}

export interface JavaScriptConfig {
  code: string;
}

export interface ControlsConfig {
  controls: ControlDefinition[];
}

export interface ControlDefinition {
  id: string;
  type: "dropdown" | "slider" | "date" | "text";
  column: string;
  value?: unknown;
  options?: string[];
  min?: number;
  max?: number;
}

export interface ColumnFilter {
  column: string;
  operator: "=" | "!=" | ">" | "<" | ">=" | "<=" | "IN" | "NOT IN" | "LIKE" | "BETWEEN";
  value: unknown;
}

export type NodeConfig =
  | FromConfig
  | SQLConfig
  | GroupConfig
  | JoinConfig
  | ChartConfig
  | TableDisplayConfig
  | DistinctConfig
  | JavaScriptConfig
  | ControlsConfig;
