import { JoinConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";

export const executeJoin: NodeExecutor = async (
  node: DAGNode,
  context: ExecutionContext
): Promise<string> => {
  const config = node.config as JoinConfig;
  const upstreamIds = context.getUpstreamNodes(node.id);

  if (upstreamIds.length < 2) {
    throw new Error("Join node requires two input connections");
  }

  const leftResult = context.getNodeResult(upstreamIds[0]);
  const rightResult = context.getNodeResult(upstreamIds[1]);

  if (!leftResult || !rightResult) {
    throw new Error("Both upstream nodes must have results");
  }

  if (!config.leftColumn || !config.rightColumn) {
    throw new Error("Join columns must be specified");
  }

  const joinType = config.joinType || "INNER";
  const leftAlias = `"_node_${upstreamIds[0]}"`;
  const rightAlias = `"_node_${upstreamIds[1]}"`;

  return `SELECT * FROM ${leftAlias} ${joinType} JOIN ${rightAlias} ON ${leftAlias}."${config.leftColumn}" = ${rightAlias}."${config.rightColumn}"`;
};
