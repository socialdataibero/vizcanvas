import { NodeType } from "@/types/nodes";
import { NodeExecutor } from "./types";
import { executeFrom } from "./executors/from";
import { executeSql } from "./executors/sql";
import { executeGroup } from "./executors/group";
import { executeJoin } from "./executors/join";
import { executeDistinct } from "./executors/distinct";
import { executeTable } from "./executors/table";
import { executeChart } from "./executors/chart";
import { executeControls } from "./executors/controls";

const executorRegistry: Record<NodeType, NodeExecutor> = {
  from: executeFrom,
  sql: executeSql,
  group: executeGroup,
  join: executeJoin,
  distinct: executeDistinct,
  table: executeTable,
  chart: executeChart,
  controls: executeControls,
  javascript: async () => "", // JS node doesn't produce SQL
};

export function getExecutor(nodeType: NodeType): NodeExecutor {
  return executorRegistry[nodeType];
}
