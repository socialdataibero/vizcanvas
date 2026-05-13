import { v4 as uuidv4 } from "uuid";
import { DAGNode } from "@/engine/types";
import { CHART_CATALOG } from "@/lib/chartCatalog";
import { DataTable } from "@/types/data";
import {
  AggregationConfig,
  ChartConfig,
  ChartType,
  ColumnFilter,
  ControlDefinition,
  ControlsConfig,
  DistinctConfig,
  FromConfig,
  GroupConfig,
  JavaScriptConfig,
  JoinConfig,
  NodeConfig,
  NodeType,
  SQLConfig,
  TableDisplayConfig,
} from "@/types/nodes";

export const AI_GRAPH_TOOL_NAME = "build_canvas_graph";

export interface AIGraphPlanInput {
  summary?: string;
  nodes?: Array<{ id: string; type: NodeType; config?: Record<string, unknown> }>;
  edges?: Array<{ from: string; to: string; toInputIndex?: number }>;
  focusNodeId?: string;
}

export interface AIGraphNode {
  id: string;
  type: NodeType;
  config: NodeConfig;
}

export interface AIGraphEdge {
  from: string;
  to: string;
  toInputIndex: number;
}

export interface AIGraphPlan {
  summary: string;
  nodes: AIGraphNode[];
  edges: AIGraphEdge[];
  focusNodeId?: string;
  warnings: string[];
}

export interface AIGraphContextNode {
  ref: string;
  nodeId: string;
  type: NodeType;
  status: DAGNode["status"];
  summary: string;
  columns: string[];
}

const SUPPORTED_NODE_TYPES: NodeType[] = [
  "from",
  "sql",
  "group",
  "join",
  "chart",
  "table",
  "distinct",
  "javascript",
  "controls",
];

const SUPPORTED_AGGREGATIONS: AggregationConfig["function"][] = ["COUNT", "SUM", "AVG", "MIN", "MAX"];
const SUPPORTED_JOIN_TYPES: JoinConfig["joinType"][] = ["INNER", "LEFT", "RIGHT", "FULL"];
const SUPPORTED_FILTER_OPERATORS: ColumnFilter["operator"][] = [
  "=",
  "!=",
  ">",
  "<",
  ">=",
  "<=",
  "IN",
  "NOT IN",
  "LIKE",
  "BETWEEN",
];
const SUPPORTED_CHART_TYPES: ChartType[] = [
  "bar",
  "line",
  "scatter",
  "area",
  "pie",
  "histogram",
  "heatmap",
  "box",
  "dot",
  "barY",
  "barX",
  "stackedBar",
  "waffle",
  "waterfall",
  "treemap",
  "grid",
  "link",
  "choropleth",
  "geoPoint",
  "spike",
  "sankey",
];
const SUPPORTED_CONTROL_TYPES: ControlDefinition["type"][] = ["dropdown", "slider", "date", "text"];
const SUPPORTED_AI_CHART_VARIANTS = new Map(
  CHART_CATALOG
    .filter((entry) => entry.supported && entry.chartType)
    .map((entry) => [entry.id, entry])
);

const CHART_TYPE_ALIASES: Record<string, ChartType> = {
  area: "area",
  areachart: "area",
  bar: "bar",
  bars: "barX",
  barx: "barX",
  bary: "barY",
  box: "box",
  boxplot: "box",
  bubble: "scatter",
  bubbles: "scatter",
  column: "bar",
  columns: "bar",
  dot: "dot",
  dotplot: "dot",
  heatmap: "heatmap",
  histogram: "histogram",
  line: "line",
  linechart: "line",
  pie: "pie",
  scatter: "scatter",
  scatterplot: "scatter",
  stacked: "stackedBar",
  stackedbar: "stackedBar",
  temporal: "line",
  treemap: "treemap",
  waffle: "waffle",
  waterfall: "waterfall",
  link: "link",
  linkchart: "link",
  cartogram: "grid",
  grid: "grid",
  gridcartogram: "grid",
  map: "geoPoint",
  geomap: "geoPoint",
  dotmap: "geoPoint",
  bubblemap: "geoPoint",
  spike: "spike",
  spikemap: "spike",
  choropleth: "choropleth",
  sankey: "sankey",
  sankeydiagram: "sankey",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function coerceString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function coerceNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return undefined;
}

function coerceStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(coerceString)
    .filter((entry): entry is string => Boolean(entry));
}

function normalizeNodeReference(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildContextNodeRefSegment(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return normalized || "node";
}

function summarizeExistingNode(node: DAGNode): string {
  switch (node.type) {
    case "from": {
      const config = node.config as FromConfig;
      return config.tableName ? `source ${config.tableName}` : "source node";
    }
    case "sql": {
      const config = node.config as SQLConfig;
      const firstLine = config.query.split("\n").find((line) => line.trim().length > 0)?.trim();
      return firstLine ? `custom sql: ${firstLine.slice(0, 80)}` : "custom sql node";
    }
    case "group": {
      const config = node.config as GroupConfig;
      return config.groupByColumns.length > 0
        ? `group by ${config.groupByColumns.join(", ")} with summaries`
        : "group by + summarize node";
    }
    case "join":
      return "join tables node";
    case "chart": {
      const config = node.config as ChartConfig;
      return config.chartType ? `${config.chartType} chart` : "chart node";
    }
    case "table":
      return "view table";
    case "distinct":
      return "remove duplicates node";
    case "controls":
      return "interactive filter node";
    case "javascript":
      return "javascript node";
  }
}

export function buildAIGraphContextNodes(
  nodes: Record<string, DAGNode>,
  currentPageId: string
): AIGraphContextNode[] {
  const counters = new Map<string, number>();

  return Object.values(nodes)
    .filter((node) => node.pageId === currentPageId)
    .map((node) => {
      const baseRef =
        node.type === "from"
          ? `from_${buildContextNodeRefSegment((node.config as FromConfig).tableName || "table")}`
          : buildContextNodeRefSegment(node.type);
      const nextCount = (counters.get(baseRef) ?? 0) + 1;
      counters.set(baseRef, nextCount);
      const ref = nextCount === 1 ? baseRef : `${baseRef}_${nextCount}`;

      return {
        ref,
        nodeId: node.id,
        type: node.type,
        status: node.status,
        summary: summarizeExistingNode(node),
        columns: node.result?.columns.map((column) => column.name).slice(0, 10) ?? [],
      };
    });
}

function normalizeTableName(rawName: unknown, tables: DataTable[]): string {
  const requested = coerceString(rawName);
  if (!requested) {
    return tables.length === 1 ? tables[0].name : "";
  }

  const exact = tables.find((table) => table.name === requested);
  if (exact) return exact.name;

  const lower = requested.toLowerCase();
  const caseInsensitive = tables.find((table) => table.name.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive.name;

  if (tables.length === 1) {
    return tables[0].name;
  }

  return "";
}

function resolvePlanNodeId(reference: unknown, nodes: AIGraphNode[]): string | null {
  const ref = coerceString(reference);
  if (!ref) return null;

  const exact = nodes.find((node) => node.id === ref);
  if (exact) return exact.id;

  const lower = ref.toLowerCase();
  const caseInsensitive = nodes.find((node) => node.id.toLowerCase() === lower);
  if (caseInsensitive) return caseInsensitive.id;

  const normalizedRef = normalizeNodeReference(ref);
  const normalizedMatches = nodes.filter((node) => normalizeNodeReference(node.id) === normalizedRef);
  if (normalizedMatches.length === 1) return normalizedMatches[0].id;

  const typeMatches = nodes.filter((node) => normalizeNodeReference(node.type) === normalizedRef);
  if (typeMatches.length === 1) return typeMatches[0].id;

  return null;
}

function resolveExistingNodeId(reference: unknown, existingNodes: AIGraphContextNode[]): string | null {
  const ref = coerceString(reference);
  if (!ref) return null;

  const exact = existingNodes.find((node) => node.ref === ref || node.nodeId === ref);
  if (exact) return exact.nodeId;

  const lower = ref.toLowerCase();
  const caseInsensitive = existingNodes.find(
    (node) => node.ref.toLowerCase() === lower || node.nodeId.toLowerCase() === lower
  );
  if (caseInsensitive) return caseInsensitive.nodeId;

  const normalizedRef = normalizeNodeReference(ref);
  const normalizedMatches = existingNodes.filter(
    (node) =>
      normalizeNodeReference(node.ref) === normalizedRef ||
      normalizeNodeReference(node.summary) === normalizedRef
  );
  if (normalizedMatches.length === 1) return normalizedMatches[0].nodeId;

  const fuzzyMatches = existingNodes.filter((node) => {
    const candidates = [node.ref, node.nodeId, node.summary, node.type]
      .map(normalizeNodeReference)
      .filter((candidate) => candidate.length > 0);

    return candidates.some(
      (candidate) => candidate.includes(normalizedRef) || normalizedRef.includes(candidate)
    );
  });
  if (fuzzyMatches.length === 1) return fuzzyMatches[0].nodeId;

  const typeMatches = existingNodes.filter((node) => normalizeNodeReference(node.type) === normalizedRef);
  if (typeMatches.length === 1) return typeMatches[0].nodeId;

  return null;
}

function addInferredEdge(
  edges: AIGraphEdge[],
  from: string,
  to: string,
  warnings: string[],
  toInputIndex = 0
): void {
  const exists = edges.some(
    (edge) => edge.from === from && edge.to === to && edge.toInputIndex === toInputIndex
  );

  if (exists || from === to) return;

  edges.push({ from, to, toInputIndex });
  warnings.push(`Se infirió una conexión faltante entre "${from}" y "${to}".`);
}

function inferMissingEdges(nodes: AIGraphNode[], edges: AIGraphEdge[], warnings: string[]): void {
  if (nodes.length < 2) return;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const incoming = edges.filter((edge) => edge.to === node.id);

    if (node.type === "from") continue;

    if (node.type === "join") {
      if (incoming.length === 0 && index >= 2) {
        addInferredEdge(edges, nodes[index - 2].id, node.id, warnings, 0);
        addInferredEdge(edges, nodes[index - 1].id, node.id, warnings, 1);
      } else if (incoming.length === 1 && index >= 1) {
        const missingInputIndex = incoming[0].toInputIndex === 0 ? 1 : 0;
        const fallbackSource = nodes
          .slice(0, index)
          .reverse()
          .find((candidate) => candidate.id !== incoming[0].from);
        if (fallbackSource) {
          addInferredEdge(edges, fallbackSource.id, node.id, warnings, missingInputIndex);
        }
      }
      continue;
    }

    if (incoming.length > 0) continue;

    const upstreamCandidate = nodes
      .slice(0, index)
      .reverse()
      .find((candidate) => candidate.type !== "chart");

    if (upstreamCandidate) {
      addInferredEdge(edges, upstreamCandidate.id, node.id, warnings);
    }
  }
}

function normalizeFilter(record: Record<string, unknown>): ColumnFilter | null {
  const column = coerceString(record.column);
  const operatorRaw = coerceString(record.operator)?.toUpperCase();
  if (!column || !operatorRaw) return null;

  const operator = SUPPORTED_FILTER_OPERATORS.find((candidate) => candidate === operatorRaw);
  if (!operator) return null;

  let value: unknown = record.value;
  if (operator === "IN" || operator === "NOT IN") {
    value = coerceStringArray(record.value);
  } else if (operator === "BETWEEN" && Array.isArray(record.value) && record.value.length >= 2) {
    const start = coerceNumber(record.value[0]);
    const end = coerceNumber(record.value[1]);
    if (start === undefined || end === undefined) return null;
    value = [start, end];
  } else if (typeof value === "string") {
    value = value.trim();
  }

  return { column, operator, value };
}

function normalizeFromConfig(
  rawConfig: Record<string, unknown>,
  tables: DataTable[],
  warnings: string[]
): FromConfig {
  const tableName = normalizeTableName(rawConfig.tableName, tables);
  const selectedColumns = coerceStringArray(rawConfig.selectedColumns);
  const sortColumn = coerceString(rawConfig.sortColumn);
  const sortDirection = coerceString(rawConfig.sortDirection)?.toLowerCase() === "desc" ? "desc" : "asc";
  const filters = Array.isArray(rawConfig.filters)
    ? rawConfig.filters
        .map((entry) => (isRecord(entry) ? normalizeFilter(entry) : null))
        .filter((entry): entry is ColumnFilter => entry !== null)
    : [];

  if (!tableName && tables.length > 0) {
    warnings.push("La IA no devolvió una tabla válida para un nodo From.");
  } else if (coerceString(rawConfig.tableName) && tableName && coerceString(rawConfig.tableName) !== tableName) {
    warnings.push(`Se reemplazó la tabla solicitada por "${tableName}" para el nodo From.`);
  }

  return {
    tableName,
    filters,
    selectedColumns: selectedColumns.length > 0 ? selectedColumns : undefined,
    sortColumn,
    sortDirection: sortColumn ? sortDirection : undefined,
  };
}

function normalizeSqlConfig(rawConfig: Record<string, unknown>): SQLConfig {
  return {
    query: coerceString(rawConfig.query) ?? "SELECT * FROM input",
    autoRun: coerceBoolean(rawConfig.autoRun) ?? false,
  };
}

function normalizeGroupConfig(rawConfig: Record<string, unknown>): GroupConfig {
  const groupByColumns =
    coerceStringArray(rawConfig.groupByColumns).length > 0
      ? coerceStringArray(rawConfig.groupByColumns)
      : coerceStringArray(rawConfig.groupBy ?? rawConfig.dimensions ?? rawConfig.columns);
  const aggregations: AggregationConfig[] = [];

  const rawAggregations = Array.isArray(rawConfig.aggregations)
    ? rawConfig.aggregations
    : Array.isArray(rawConfig.aggregation)
      ? rawConfig.aggregation
      : isRecord(rawConfig.aggregation)
        ? [rawConfig.aggregation]
        : Array.isArray(rawConfig.measures)
          ? rawConfig.measures
          : [];

  if (rawAggregations.length > 0) {
    for (const entry of rawAggregations) {
      if (!isRecord(entry)) continue;
      const column = coerceString(entry.column ?? entry.field ?? entry.measure);
      const fn = coerceString(entry.function)?.toUpperCase();
      if (!column || !fn) continue;
      const functionName = SUPPORTED_AGGREGATIONS.find((candidate) => candidate === fn);
      if (!functionName) continue;

      aggregations.push({
        column,
        function: functionName,
        alias: coerceString(entry.alias),
      });
    }
  }

  return { groupByColumns, aggregations };
}

function normalizeJoinConfig(rawConfig: Record<string, unknown>): JoinConfig {
  const requestedJoin = coerceString(rawConfig.joinType)?.toUpperCase();
  const joinType =
    SUPPORTED_JOIN_TYPES.find((candidate) => candidate === requestedJoin) ?? "INNER";

  return {
    joinType,
    leftColumn: coerceString(rawConfig.leftColumn) ?? "",
    rightColumn: coerceString(rawConfig.rightColumn) ?? "",
  };
}

function inferChartCatalogId(chartType: ChartType | undefined, rawConfig: Record<string, unknown>): string | undefined {
  if (!chartType) return undefined;

  switch (chartType) {
    case "bar":
      return coerceString(rawConfig.facetColumn ?? rawConfig.facet) ? "grouped-bar" : "vertical-bar";
    case "barX":
      return "horizontal-bar";
    case "line":
      return coerceString(rawConfig.colorColumn ?? rawConfig.color ?? rawConfig.seriesColumn)
        ? "multi-series-line"
        : "line-chart";
    case "area":
      return "area-chart";
    case "scatter":
      if (coerceString(rawConfig.sizeColumn ?? rawConfig.size)) return "bubble-chart";
      if (coerceString(rawConfig.colorColumn ?? rawConfig.color ?? rawConfig.seriesColumn)) return "color-scatterplot";
      return "scatterplot";
    case "dot":
      return "dot-comparison";
    case "histogram":
      return coerceString(rawConfig.facetColumn ?? rawConfig.facet) ? "faceted-dodge" : "histogram";
    case "box":
      return "box-plot";
    case "stackedBar":
      return "stacked-bar";
    case "waffle":
      return "waffle-chart";
    case "waterfall":
      return "waterfall-chart";
    case "treemap":
      return "treemap";
    case "grid":
      return "grid-cartogram";
    case "link":
      return "link-chart";
    case "choropleth":
      return "world-choropleth";
    case "geoPoint":
      return "dot-map";
    case "spike":
      return "spike-map";
    case "sankey":
      return "sankey-diagram";
    default:
      return undefined;
  }
}

function normalizeChartConfig(rawConfig: Record<string, unknown>, warnings: string[]): ChartConfig {
  const requestedChartType = coerceString(rawConfig.chartType);
  const normalizedChartKey = requestedChartType?.replace(/[\s_-]+/g, "").toLowerCase();
  const aliasedChartType = normalizedChartKey ? CHART_TYPE_ALIASES[normalizedChartKey] : undefined;
  const normalizedChartType =
    (requestedChartType && SUPPORTED_CHART_TYPES.find((candidate) => candidate === requestedChartType)) ||
    aliasedChartType;
  const requestedChartCatalogId = coerceString(rawConfig.chartCatalogId ?? rawConfig.chartVariant ?? rawConfig.variant);
  const requestedChartEntry = requestedChartCatalogId
    ? SUPPORTED_AI_CHART_VARIANTS.get(requestedChartCatalogId)
    : undefined;
  const chartType = requestedChartEntry?.chartType ?? normalizedChartType;
  const chartCatalogId = requestedChartEntry?.id ?? inferChartCatalogId(chartType, rawConfig);

  if (
    requestedChartType &&
    !SUPPORTED_CHART_TYPES.includes(requestedChartType as ChartType) &&
    !aliasedChartType
  ) {
    warnings.push(`La IA devolvió un chartType no soportado: "${requestedChartType}".`);
  }
  if (requestedChartCatalogId && !requestedChartEntry) {
    warnings.push(`La IA devolvió un chartCatalogId no soportado: "${requestedChartCatalogId}".`);
  }
  if (requestedChartEntry && normalizedChartType && requestedChartEntry.chartType !== normalizedChartType) {
    warnings.push(
      `Se ajustó el chartType a "${requestedChartEntry.chartType}" para coincidir con la variante "${requestedChartEntry.id}".`
    );
  }

  return {
    chartType,
    chartCatalogId,
    xColumn: coerceString(rawConfig.xColumn ?? rawConfig.x ?? rawConfig.categoryColumn),
    yColumn: coerceString(rawConfig.yColumn ?? rawConfig.y ?? rawConfig.valueColumn),
    x2Column: coerceString(rawConfig.x2Column ?? rawConfig.x2 ?? rawConfig.endXColumn ?? rawConfig.destinationXColumn),
    y2Column: coerceString(rawConfig.y2Column ?? rawConfig.y2 ?? rawConfig.endYColumn ?? rawConfig.destinationYColumn),
    colorColumn: coerceString(rawConfig.colorColumn ?? rawConfig.color ?? rawConfig.seriesColumn),
    sizeColumn: coerceString(rawConfig.sizeColumn ?? rawConfig.size),
    lengthColumn: coerceString(rawConfig.lengthColumn ?? rawConfig.length ?? rawConfig.weightColumn),
    labelColumn: coerceString(rawConfig.labelColumn ?? rawConfig.label),
    facetColumn: coerceString(rawConfig.facetColumn ?? rawConfig.facet),
    title: coerceString(rawConfig.title),
    caption: coerceString(rawConfig.caption),
  };
}

function normalizeTableConfig(rawConfig: Record<string, unknown>): TableDisplayConfig {
  const sortColumn = coerceString(rawConfig.sortColumn);
  const sortDirection = coerceString(rawConfig.sortDirection)?.toLowerCase() === "desc" ? "desc" : "asc";

  return {
    hiddenColumns: coerceStringArray(rawConfig.hiddenColumns),
    columnOrder: coerceStringArray(rawConfig.columnOrder),
    sortColumn,
    sortDirection: sortColumn ? sortDirection : undefined,
  };
}

function normalizeDistinctConfig(rawConfig: Record<string, unknown>): DistinctConfig {
  return {
    columns: coerceStringArray(rawConfig.columns),
  };
}

function normalizeJavaScriptConfig(rawConfig: Record<string, unknown>): JavaScriptConfig {
  return {
    code: coerceString(rawConfig.code) ?? "// input is available\nreturn input;",
  };
}

function normalizeControlsConfig(rawConfig: Record<string, unknown>): ControlsConfig {
  const controls = Array.isArray(rawConfig.controls)
    ? rawConfig.controls
        .map((entry) => {
          if (!isRecord(entry)) return null;
          const controlType = coerceString(entry.type);
          const type = SUPPORTED_CONTROL_TYPES.find((candidate) => candidate === controlType);
          const column = coerceString(entry.column);
          if (!type || !column) return null;

          const normalized: ControlDefinition = {
            id: coerceString(entry.id) ?? uuidv4(),
            type,
            column,
            value: entry.value,
          };

          if (Array.isArray(entry.options)) {
            normalized.options = coerceStringArray(entry.options);
          }

          const min = coerceNumber(entry.min);
          const max = coerceNumber(entry.max);
          if (min !== undefined) normalized.min = min;
          if (max !== undefined) normalized.max = max;

          return normalized;
        })
        .filter((entry): entry is ControlDefinition => entry !== null)
    : [];

  return { controls };
}

function normalizeNodeConfig(
  type: NodeType,
  rawConfig: Record<string, unknown>,
  tables: DataTable[],
  warnings: string[]
): NodeConfig {
  switch (type) {
    case "from":
      return normalizeFromConfig(rawConfig, tables, warnings);
    case "sql":
      return normalizeSqlConfig(rawConfig);
    case "group":
      return normalizeGroupConfig(rawConfig);
    case "join":
      return normalizeJoinConfig(rawConfig);
    case "chart":
      return normalizeChartConfig(rawConfig, warnings);
    case "table":
      return normalizeTableConfig(rawConfig);
    case "distinct":
      return normalizeDistinctConfig(rawConfig);
    case "javascript":
      return normalizeJavaScriptConfig(rawConfig);
    case "controls":
      return normalizeControlsConfig(rawConfig);
  }
}

function normalizeSummary(summary: unknown, nodeCount: number): string {
  const text = coerceString(summary);
  if (text) return text;
  if (nodeCount > 0) {
    return `Creé ${nodeCount} nodo${nodeCount === 1 ? "" : "s"} en el canvas.`;
  }
  return "Puedo ayudarte a diseñar el flujo, pero no hubo nodos nuevos para crear.";
}

export function normalizeAIGraphPlan(
  rawPlan: unknown,
  tables: DataTable[],
  existingNodes: AIGraphContextNode[] = []
): AIGraphPlan | null {
  if (!isRecord(rawPlan)) return null;

  const warnings: string[] = [];
  const rawNodes = Array.isArray(rawPlan.nodes) ? rawPlan.nodes : [];
  const seenIds = new Set<string>();
  const nodes: AIGraphNode[] = [];

  for (const entry of rawNodes) {
    if (!isRecord(entry)) continue;

    const type = coerceString(entry.type) as NodeType | undefined;
    if (!type || !SUPPORTED_NODE_TYPES.includes(type)) {
      warnings.push("La IA devolvió un tipo de nodo no soportado y se omitió.");
      continue;
    }

    const preferredId = coerceString(entry.id) ?? `${type}_${nodes.length + 1}`;
    let id = preferredId;
    let suffix = 2;
    while (seenIds.has(id)) {
      id = `${preferredId}_${suffix}`;
      suffix += 1;
    }

    seenIds.add(id);
    const rawConfig = isRecord(entry.config) ? entry.config : {};
    const config = normalizeNodeConfig(type, rawConfig, tables, warnings);
    nodes.push({ id, type, config });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const rawEdges = Array.isArray(rawPlan.edges) ? rawPlan.edges : [];
  const edges: AIGraphEdge[] = [];

  for (const entry of rawEdges) {
    if (!isRecord(entry)) continue;
    const from = resolvePlanNodeId(entry.from, nodes) ?? resolveExistingNodeId(entry.from, existingNodes);
    const to = resolvePlanNodeId(entry.to, nodes) ?? resolveExistingNodeId(entry.to, existingNodes);
    if (!from || !to || from === to) continue;
    const fromExists = nodeIds.has(from) || existingNodes.some((node) => node.nodeId === from);
    const toExists = nodeIds.has(to) || existingNodes.some((node) => node.nodeId === to);
    if (!fromExists || !toExists) {
      warnings.push("La IA devolvió una conexión entre nodos inexistentes y se omitió.");
      continue;
    }
    if (!nodeIds.has(from) && !nodeIds.has(to)) {
      warnings.push("La IA devolvió una conexión solo entre nodos existentes y se omitió.");
      continue;
    }

    const toInputIndex = Math.max(0, Math.trunc(coerceNumber(entry.toInputIndex) ?? 0));
    edges.push({ from, to, toInputIndex });
  }

  inferMissingEdges(nodes, edges, warnings);

  const focusNodeId = coerceString(rawPlan.focusNodeId);
  const fallbackFocusNodeId =
    nodes.findLast((node) => node.type === "chart")?.id ??
    nodes.at(-1)?.id;

  return {
    summary: normalizeSummary(rawPlan.summary, nodes.length),
    nodes,
    edges,
    focusNodeId: focusNodeId && nodeIds.has(focusNodeId) ? focusNodeId : fallbackFocusNodeId,
    warnings,
  };
}
