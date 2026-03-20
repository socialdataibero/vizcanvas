import type { IconType } from "react-icons";
import {
  LuBraces,
  LuChartColumnBig,
  LuCopy,
  LuCopyMinus,
  LuCopyPlus,
  LuDatabase,
  LuDatabaseZap,
  LuFileCode2,
  LuFilter,
  LuFrame,
  LuLink2,
  LuMerge,
  LuMonitorPlay,
  LuPalette,
  LuPencil,
  LuSigma,
  LuSparkles,
  LuTableProperties,
  LuTrash2,
} from "react-icons/lu";
import type { NodeType } from "@/types/nodes";

const NODE_TYPE_ICONS: Record<NodeType, IconType> = {
  from: LuDatabase,
  sql: LuFileCode2,
  group: LuSigma,
  join: LuMerge,
  chart: LuChartColumnBig,
  table: LuTableProperties,
  distinct: LuCopyMinus,
  javascript: LuBraces,
  controls: LuFilter,
};

export const APP_ICONS = {
  dataPanel: LuDatabaseZap,
  stylePanel: LuPalette,
  aiAssistant: LuSparkles,
  copy: LuCopy,
  duplicate: LuCopyPlus,
  delete: LuTrash2,
  link: LuLink2,
  presentationLink: LuMonitorPlay,
  frame: LuFrame,
  rename: LuPencil,
};

export function getNodeTypeIcon(type: string): IconType {
  return NODE_TYPE_ICONS[type as NodeType] ?? LuDatabase;
}
