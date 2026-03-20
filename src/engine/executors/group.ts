import { GroupConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";

type ValidAggregation = {
  function: NonNullable<GroupConfig["aggregations"][number]["function"]>;
  column: string;
  alias?: string;
};

function isNumericType(type: string): boolean {
  return /int|float|double|decimal|numeric|real|bigint|smallint|tinyint/i.test(type);
}

export const executeGroup: NodeExecutor = async (
  node: DAGNode,
  context: ExecutionContext
): Promise<string> => {
  const config = node.config as GroupConfig;
  const upstreamIds = context.getUpstreamNodes(node.id);

  if (upstreamIds.length === 0) {
    throw new Error("Group node requires an input connection");
  }

  const upstreamResult = context.getNodeResult(upstreamIds[0]);
  if (!upstreamResult) {
    throw new Error("Upstream node has no results");
  }

  const columnTypeByName = new Map(
    upstreamResult.columns.map((column) => [column.name, column.type])
  );

  const groupByColumns = config.groupByColumns || [];
  const groupCols = groupByColumns.map((c) => `"${c}"`).join(", ");

  const validAggregations = (config.aggregations || []).filter(
    (agg): agg is ValidAggregation => Boolean(agg.function && agg.column)
  );

  const invalidAggregation = validAggregations.find((agg) => {
    if (agg.function === "COUNT") return false;
    const columnType = columnTypeByName.get(agg.column) || "";
    return !isNumericType(columnType);
  });

  if (invalidAggregation) {
    throw new Error(
      `${invalidAggregation.function} requires a numeric column. "${invalidAggregation.column}" is not numeric.`
    );
  }

  const aggExprs = validAggregations.map((agg) => {
    const alias = agg.alias || `${agg.function.toLowerCase()}_${agg.column}`;
    if (agg.function === "COUNT") {
      return `COUNT("${agg.column}") AS "${alias}"`;
    }
    return `${agg.function}("${agg.column}") AS "${alias}"`;
  });

  if (groupByColumns.length === 0 && aggExprs.length === 0) {
    return `SELECT * FROM "_node_${upstreamIds[0]}"`;
  }

  if (groupByColumns.length > 0 && aggExprs.length === 0) {
    return `SELECT DISTINCT ${groupCols} FROM "_node_${upstreamIds[0]}"`;
  }

  if (groupByColumns.length === 0) {
    return `SELECT ${aggExprs.join(", ")} FROM "_node_${upstreamIds[0]}"`;
  }

  const selectCols = [groupCols, ...aggExprs].join(", ");
  return `SELECT ${selectCols} FROM "_node_${upstreamIds[0]}" GROUP BY ${groupCols}`;
};
