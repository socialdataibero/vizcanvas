import {
  ChartConfig,
  ControlsConfig,
  DistinctConfig,
  FromConfig,
  GroupConfig,
  JavaScriptConfig,
  JoinConfig,
  NodeConfig,
  NodeType,
  SQLConfig,
  TableDisplayConfig,
} from "@/types/nodes";

export interface NodePaletteItem {
  type: NodeType;
  icon: string;
  label: string;
  shortcut?: string;
}

export interface NodePaletteGroup {
  id: string;
  label: string;
  items: NodePaletteItem[];
}

const NODE_PALETTE_ITEMS: Record<NodeType, NodePaletteItem> = {
  from: { type: "from", icon: "🗂️", label: "Source", shortcut: "F" },
  sql: { type: "sql", icon: "🔍", label: "Custom SQL", shortcut: "S" },
  table: { type: "table", icon: "📋", label: "View table", shortcut: "T" },
  group: { type: "group", icon: "🧮", label: "Group by + Summarize", shortcut: "G" },
  join: { type: "join", icon: "🔗", label: "Join tables", shortcut: "J" },
  chart: { type: "chart", icon: "📈", label: "Make chart", shortcut: "C" },
  distinct: { type: "distinct", icon: "🧹", label: "Remove duplicates", shortcut: "D" },
  controls: { type: "controls", icon: "🎛️", label: "Interactive filter" },
  javascript: { type: "javascript", icon: "⚡", label: "JavaScript" },
};

export const NODE_SHORTCUTS: Partial<Record<string, NodeType>> = {
  f: "from",
  s: "sql",
  t: "table",
  g: "group",
  j: "join",
  c: "chart",
  d: "distinct",
};

export const TOOLBAR_NODE_GROUPS: NodePaletteGroup[] = [
  {
    id: "data",
    label: "Data",
    items: [NODE_PALETTE_ITEMS.from, NODE_PALETTE_ITEMS.join],
  },
  {
    id: "prepare",
    label: "Prepare",
    items: [NODE_PALETTE_ITEMS.group, NODE_PALETTE_ITEMS.distinct, NODE_PALETTE_ITEMS.controls],
  },
  {
    id: "explore",
    label: "Explore",
    items: [NODE_PALETTE_ITEMS.table, NODE_PALETTE_ITEMS.chart],
  },
  {
    id: "advanced",
    label: "Advanced",
    items: [NODE_PALETTE_ITEMS.sql, NODE_PALETTE_ITEMS.javascript],
  },
];

export const TOOLBAR_NODE_TYPES: NodePaletteItem[] = Object.values(NODE_PALETTE_ITEMS);

export const CONTEXT_MENU_NODE_GROUPS: NodePaletteGroup[] = TOOLBAR_NODE_GROUPS;

export const CONTEXT_MENU_NODE_TYPES: NodeType[] = CONTEXT_MENU_NODE_GROUPS.flatMap((group) =>
  group.items.map((item) => item.type)
);

export function getNodePaletteItem(type: NodeType): NodePaletteItem {
  return NODE_PALETTE_ITEMS[type];
}

export function getDefaultNodeConfig(type: NodeType): NodeConfig {
  switch (type) {
    case "from":
      return { tableName: "", filters: [] } as FromConfig;
    case "sql":
      return { query: "SELECT * FROM input", autoRun: false } as SQLConfig;
    case "group":
      return { groupByColumns: [], aggregations: [], configVersion: 0, lastRunVersion: 0 } as GroupConfig;
    case "join":
      return { joinType: "INNER", leftColumn: "", rightColumn: "" } as JoinConfig;
    case "chart":
      return {} as ChartConfig;
    case "table":
      return { hiddenColumns: [] } as TableDisplayConfig;
    case "distinct":
      return { columns: [] } as DistinctConfig;
    case "javascript":
      return { code: "// input is available\nreturn input;" } as JavaScriptConfig;
    case "controls":
      return { controls: [] } as ControlsConfig;
  }
}
