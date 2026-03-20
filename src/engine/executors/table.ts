import { TableDisplayConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";

export const executeTable: NodeExecutor = async (
  node: DAGNode,
  context: ExecutionContext
): Promise<string> => {
  const config = node.config as TableDisplayConfig;
  const upstreamIds = context.getUpstreamNodes(node.id);

  if (upstreamIds.length === 0) {
    throw new Error("Table node requires an input connection");
  }

  const upstreamResult = context.getNodeResult(upstreamIds[0]);
  if (!upstreamResult) {
    throw new Error("Upstream node has no results");
  }

  const visibleColumns = upstreamResult.columns
    .filter((c) => !config.hiddenColumns?.includes(c.name))
    .map((c) => c.name);

  const orderedColumns = config.columnOrder
    ? config.columnOrder.filter((c) => visibleColumns.includes(c))
    : visibleColumns;

  const selectCols =
    orderedColumns.length > 0
      ? orderedColumns.map((c) => `"${c}"`).join(", ")
      : "*";

  let sql = `SELECT ${selectCols} FROM "_node_${upstreamIds[0]}"`;

  if (config.sortColumn) {
    sql += ` ORDER BY "${config.sortColumn}" ${config.sortDirection || "asc"}`;
  }

  return sql;
};
