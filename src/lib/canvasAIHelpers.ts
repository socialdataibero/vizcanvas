import { DAGNode } from "@/engine/types";
import { DataTable } from "@/types/data";
import { ColumnInfo, FromConfig, NodeType } from "@/types/nodes";

export const AI_SOURCE_NODE_TYPES: NodeType[] = [
  "from",
  "sql",
  "group",
  "join",
  "table",
  "distinct",
  "javascript",
  "controls",
];

export function isReusableAISourceNode(node: DAGNode): boolean {
  return AI_SOURCE_NODE_TYPES.includes(node.type) && node.status !== "error";
}

export function describeAINode(node: DAGNode): string {
  if (node.type === "from") {
    return `el nodo Source "${(node.config as FromConfig).tableName}"`;
  }
  return `el nodo ${node.type}`;
}

export function isNumericColumn(column: ColumnInfo): boolean {
  return /int|decimal|double|float|real|numeric|number|hugeint|bigint|smallint|tinyint/i.test(column.type);
}

export function isTemporalColumn(column: ColumnInfo): boolean {
  return /date|time|timestamp/i.test(column.type);
}

export function isSpatialColumn(column: ColumnInfo): boolean {
  return column.role === "geometry" || column.role === "latitude" || column.role === "longitude";
}

export function isCategoricalColumn(column: ColumnInfo): boolean {
  if (isSpatialColumn(column)) return false;
  return /char|text|string|uuid/i.test(column.type) || isTemporalColumn(column);
}

export function chooseGroupByColumn(columns: ColumnInfo[]): string | undefined {
  return (
    columns.find((c) => isCategoricalColumn(c))?.name ??
    columns.find((c) => !isNumericColumn(c))?.name ??
    columns[0]?.name
  );
}

export function chooseMetricColumn(columns: ColumnInfo[], excludedColumns: string[]): ColumnInfo | undefined {
  return (
    columns.find((c) => !excludedColumns.includes(c.name) && !isSpatialColumn(c) && isNumericColumn(c)) ??
    columns.find((c) => !excludedColumns.includes(c.name) && !isSpatialColumn(c))
  );
}

export function chooseMapLabelColumn(columns: ColumnInfo[], excludedColumns: string[]): ColumnInfo | undefined {
  return (
    columns.find((c) =>
      !excludedColumns.includes(c.name) && !isSpatialColumn(c) && !isNumericColumn(c) &&
      /name|nom|label|region|state|country|province|geo/i.test(c.name)
    ) ??
    columns.find((c) => !excludedColumns.includes(c.name) && !isSpatialColumn(c) && !isNumericColumn(c) && c.role === "join_key") ??
    columns.find((c) => !excludedColumns.includes(c.name) && !isSpatialColumn(c) && isCategoricalColumn(c)) ??
    columns.find((c) => !excludedColumns.includes(c.name) && !isSpatialColumn(c))
  );
}

export function getAvailableColumnsForNode(node: DAGNode | undefined, tables: DataTable[]): ColumnInfo[] {
  if (!node) return [];
  if (node.result?.columns?.length) return node.result.columns;
  if (node.type === "from") {
    const tableName = (node.config as FromConfig).tableName;
    return tables.find((t) => t.name === tableName)?.columns ?? [];
  }
  return [];
}

export function clearHydratedNodeExecution(nodes: Record<string, DAGNode>): Record<string, DAGNode> {
  return Object.fromEntries(
    Object.entries(nodes).map(([id, node]) => [
      id,
      { ...node, status: "idle" as const, error: undefined, result: null },
    ]),
  );
}

export function hasReferencedSampleData(nodes: Record<string, DAGNode>): boolean {
  return Object.values(nodes).some(
    (node) =>
      node.type === "from" &&
      (node.config as FromConfig).tableName?.trim().toLowerCase() === "sample_data",
  );
}

export function pickAIAutoConnectSource(
  nodes: Record<string, DAGNode>,
  currentPageId: string,
  createdNodeIds: Set<string>,
  selectedNodeId: string | null,
): DAGNode | null {
  const candidates = Object.values(nodes).filter(
    (node) => node.pageId === currentPageId && !createdNodeIds.has(node.id) && isReusableAISourceNode(node),
  );

  if (selectedNodeId) {
    const sel = candidates.find((node) => node.id === selectedNodeId);
    if (sel) return sel;
  }

  const fromCandidates = candidates.filter((node) => node.type === "from");
  if (fromCandidates.length === 1) return fromCandidates[0];

  const successCandidates = candidates.filter((node) => node.status === "success" && node.result);
  if (successCandidates.length === 1) return successCandidates[0];

  if (candidates.length === 1) return candidates[0];
  return null;
}
