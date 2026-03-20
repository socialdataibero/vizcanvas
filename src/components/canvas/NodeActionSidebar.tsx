"use client";

import React from "react";
import { NodeType } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";

interface Action {
  icon: string;
  label: string;
  nodeType?: NodeType;
  onClick?: () => void;
  separator?: boolean;
}

const ACTIONS_BY_TYPE: Record<string, Action[]> = {
  from: [
    { icon: "📈", label: "Make chart",             nodeType: "chart" },
    { icon: "📋", label: "View table",             nodeType: "table" },
    { icon: "🎛️", label: "Interactive filter",    nodeType: "controls" },
    { icon: "🧮", label: "Group by + Summarize",   nodeType: "group" },
    { icon: "🧹", label: "Remove duplicates",      nodeType: "distinct" },
    { icon: "🔗", label: "Join tables",            nodeType: "join" },
    { icon: "🔍", label: "Custom SQL",             nodeType: "sql" },
    { icon: "⋯", label: "More", separator: true },
  ],
  table: [
    { icon: "📈", label: "Make chart",             nodeType: "chart" },
    { icon: "🎛️", label: "Interactive filter",    nodeType: "controls" },
    { icon: "🔗", label: "Join tables",            nodeType: "join" },
    { icon: "🧮", label: "Group by + Summarize",   nodeType: "group" },
    { icon: "🧹", label: "Remove duplicates",      nodeType: "distinct" },
    { icon: "🔍", label: "Custom SQL",             nodeType: "sql" },
  ],
  sql: [
    { icon: "📈", label: "Make chart",             nodeType: "chart" },
    { icon: "📋", label: "View table",             nodeType: "table" },
    { icon: "🎛️", label: "Interactive filter",    nodeType: "controls" },
    { icon: "🔗", label: "Join tables",            nodeType: "join" },
    { icon: "🧮", label: "Group by + Summarize",   nodeType: "group" },
  ],
  group: [
    { icon: "📈", label: "Make chart",          nodeType: "chart" },
    { icon: "📋", label: "View table",          nodeType: "table" },
    { icon: "🧹", label: "Remove duplicates",   nodeType: "distinct" },
    { icon: "🔍", label: "Custom SQL",          nodeType: "sql" },
  ],
  join: [
    { icon: "📈", label: "Make chart",             nodeType: "chart" },
    { icon: "📋", label: "View table",             nodeType: "table" },
    { icon: "🎛️", label: "Interactive filter",    nodeType: "controls" },
    { icon: "🧮", label: "Group by + Summarize",   nodeType: "group" },
    { icon: "🔍", label: "Custom SQL",             nodeType: "sql" },
  ],
  chart: [
    { icon: "📋", label: "View table",    nodeType: "table" },
    { icon: "🔍", label: "Custom SQL",    nodeType: "sql" },
  ],
  distinct: [
    { icon: "📈", label: "Make chart",    nodeType: "chart" },
    { icon: "📋", label: "View table",    nodeType: "table" },
  ],
  controls: [
    { icon: "📋", label: "View table",             nodeType: "table" },
    { icon: "📈", label: "Make chart",             nodeType: "chart" },
    { icon: "🧮", label: "Group by + Summarize",   nodeType: "group" },
  ],
};

interface Props {
  nodeId: string;
  nodeType: string;
  position: { x: number; y: number };
  nodeWidth: number;
  onAddNode: (type: NodeType, position?: { x: number; y: number }) => string;
}

export default function NodeActionSidebar({ nodeId, nodeType, position, nodeWidth, onAddNode }: Props) {
  const addEdge = useDagStore((s) => s.addEdge);

  const actions = ACTIONS_BY_TYPE[nodeType] || ACTIONS_BY_TYPE.table;

  const handleAction = (action: Action) => {
    if (!action.nodeType) return;
    // Position new node to the right and slightly below
    const newPos = {
      x: position.x + nodeWidth + 60,
      y: position.y,
    };
    const newNodeId = onAddNode(action.nodeType, newPos);
    if (newNodeId) {
      setTimeout(() => addEdge(nodeId, newNodeId), 50);
    }
  };

  return (
    <div
      className="node-action-sidebar absolute z-50"
      style={{
        left: position.x + nodeWidth + 10,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, i) => (
        action.separator ? (
          <div key={i} className="context-menu-separator my-1" />
        ) : (
          <button
            key={i}
            className="node-action-btn"
            onClick={() => handleAction(action)}
            title={action.label}
          >
            <span>{action.icon}</span>
            <span className="tooltip">{action.label}</span>
          </button>
        )
      ))}
    </div>
  );
}
