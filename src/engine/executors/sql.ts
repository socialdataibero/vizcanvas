import { SQLConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";

export const executeSql: NodeExecutor = async (
  node: DAGNode,
  context: ExecutionContext
): Promise<string> => {
  const config = node.config as SQLConfig;
  if (!config.query || config.query.trim() === "") {
    throw new Error("No SQL query provided");
  }

  let query = config.query;
  const upstreamIds = context.getUpstreamNodes(node.id);

  // Replace friendly aliases: "input" → first upstream CTE, "input1"/"input2" → by index
  if (upstreamIds.length > 0) {
    // "input" or "input1" → first upstream node
    query = query.replace(/\binput1?\b/gi, `"_node_${upstreamIds[0]}"`);
    // "input2", "input3", etc.
    for (let i = 1; i < upstreamIds.length; i++) {
      query = query.replace(
        new RegExp(`\\binput${i + 1}\\b`, "gi"),
        `"_node_${upstreamIds[i]}"`
      );
    }
  }

  // Also replace raw node UUIDs (for backwards compat)
  for (const upId of upstreamIds) {
    query = query.replace(
      new RegExp(`\\b${upId}\\b`, "g"),
      `"_node_${upId}"`
    );
  }

  return query;
};
