import { FromConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";
import { escapeSqlString } from "../sqlUtils";

export const executeFrom: NodeExecutor = async (
  node: DAGNode,
  _context: ExecutionContext
): Promise<string> => {
  const config = node.config as FromConfig;
  if (!config.tableName) {
    throw new Error("No table selected");
  }

  let sql = `SELECT ${
    config.selectedColumns && config.selectedColumns.length > 0
      ? config.selectedColumns.map((c) => `"${c}"`).join(", ")
      : "*"
  } FROM "${config.tableName}"`;

  if (config.filters && config.filters.length > 0) {
    const conditions = config.filters.map((f) => {
      switch (f.operator) {
        case "IN":
          return `"${f.column}" IN (${(f.value as string[])
            .map((v) => `'${escapeSqlString(v)}'`)
            .join(", ")})`;
        case "NOT IN":
          return `"${f.column}" NOT IN (${(f.value as string[])
            .map((v) => `'${escapeSqlString(v)}'`)
            .join(", ")})`;
        case "BETWEEN":
          return `"${f.column}" BETWEEN ${(f.value as [number, number])[0]} AND ${
            (f.value as [number, number])[1]
          }`;
        case "LIKE":
          return `"${f.column}" LIKE '${escapeSqlString(String(f.value))}'`;
        default:
          return typeof f.value === "string"
            ? `"${f.column}" ${f.operator} '${escapeSqlString(f.value)}'`
            : `"${f.column}" ${f.operator} ${f.value}`;
      }
    });
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  if (config.sortColumn) {
    sql += ` ORDER BY "${config.sortColumn}" ${config.sortDirection || "asc"}`;
  }

  return sql;
};
