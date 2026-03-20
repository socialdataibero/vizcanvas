import { ChartConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";

export const executeChart: NodeExecutor = async (
  node: DAGNode,
  context: ExecutionContext
): Promise<string> => {
  const config = node.config as ChartConfig;
  const upstreamIds = context.getUpstreamNodes(node.id);

  if (upstreamIds.length === 0) {
    throw new Error("Chart node requires an input connection");
  }

  const upstreamResult = context.getNodeResult(upstreamIds[0]);
  if (!upstreamResult) {
    throw new Error("Upstream node has no results");
  }

  // Chart node passes through data, optionally with brush filtering
  let sql = `SELECT * FROM "_node_${upstreamIds[0]}"`;

  if (config.brushSelection) {
    const conditions: string[] = [];
    if (config.brushSelection.x && config.xColumn) {
      conditions.push(
        `"${config.xColumn}" BETWEEN ${Number(config.brushSelection.x[0])} AND ${Number(config.brushSelection.x[1])}`
      );
    }
    if (config.brushSelection.y && config.yColumn) {
      conditions.push(
        `"${config.yColumn}" BETWEEN ${Number(config.brushSelection.y[0])} AND ${Number(config.brushSelection.y[1])}`
      );
    }
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(" AND ")}`;
    }
  }

  return sql;
};
