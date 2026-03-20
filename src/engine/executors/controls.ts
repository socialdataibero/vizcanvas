import { ControlsConfig } from "@/types/nodes";
import { DAGNode, ExecutionContext, NodeExecutor } from "../types";
import { escapeSqlString } from "../sqlUtils";

export const executeControls: NodeExecutor = async (
  node: DAGNode,
  context: ExecutionContext
): Promise<string> => {
  const config = node.config as ControlsConfig;
  const upstreamIds = context.getUpstreamNodes(node.id);

  if (upstreamIds.length === 0) {
    throw new Error("Controls node requires an input connection");
  }

  let sql = `SELECT * FROM "_node_${upstreamIds[0]}"`;
  const conditions: string[] = [];

  for (const control of config.controls || []) {
    if (control.value === undefined || control.value === null || control.value === "") continue;

    switch (control.type) {
      case "dropdown":
        conditions.push(`"${control.column}" = '${escapeSqlString(String(control.value))}'`);
        break;
      case "slider":
        if (Array.isArray(control.value)) {
          conditions.push(
            `"${control.column}" BETWEEN ${Number(control.value[0])} AND ${Number(control.value[1])}`
          );
        } else {
          conditions.push(`"${control.column}" <= ${Number(control.value)}`);
        }
        break;
      case "text":
        conditions.push(`"${control.column}" LIKE '%${escapeSqlString(String(control.value))}%'`);
        break;
      case "date":
        if (Array.isArray(control.value)) {
          conditions.push(
            `"${control.column}" BETWEEN '${escapeSqlString(String(control.value[0]))}' AND '${escapeSqlString(String(control.value[1]))}'`
          );
        } else {
          conditions.push(`"${control.column}" = '${escapeSqlString(String(control.value))}'`);
        }
        break;
    }
  }

  if (conditions.length > 0) {
    sql += ` WHERE ${conditions.join(" AND ")}`;
  }

  return sql;
};
