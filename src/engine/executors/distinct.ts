import { DistinctConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";

export const executeDistinct: NodeExecutor = async (
  node: DAGNode,
  context: ExecutionContext
): Promise<string> => {
  const config = node.config as DistinctConfig;
  const upstreamIds = context.getUpstreamNodes(node.id);

  if (upstreamIds.length === 0) {
    throw new Error("Distinct node requires an input connection");
  }

  if (config.columns && config.columns.length > 0) {
    const cols = config.columns.map((c) => `"${c}"`).join(", ");
    return `SELECT DISTINCT ON (${cols}) * FROM "_node_${upstreamIds[0]}"`;
  }

  return `SELECT DISTINCT * FROM "_node_${upstreamIds[0]}"`;
};
