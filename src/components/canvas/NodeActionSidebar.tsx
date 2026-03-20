"use client";

import React from "react";
import { NodeType } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import { getNodeTypeIcon } from "@/lib/iconography";

interface Action {
  label: string;
  nodeType?: NodeType;
  onClick?: () => void;
  separator?: boolean;
}

const ACTIONS_BY_TYPE: Record<string, Action[]> = {
  from: [
    { label: "Make chart",             nodeType: "chart" },
    { label: "View table",             nodeType: "table" },
    { label: "Interactive filter",     nodeType: "controls" },
    { label: "Group by + Summarize",   nodeType: "group" },
    { label: "Remove duplicates",      nodeType: "distinct" },
    { label: "Join tables",            nodeType: "join" },
    { label: "Custom SQL",             nodeType: "sql" },
    { label: "More", separator: true },
  ],
  table: [
    { label: "Make chart",             nodeType: "chart" },
    { label: "Interactive filter",     nodeType: "controls" },
    { label: "Join tables",            nodeType: "join" },
    { label: "Group by + Summarize",   nodeType: "group" },
    { label: "Remove duplicates",      nodeType: "distinct" },
    { label: "Custom SQL",             nodeType: "sql" },
  ],
  sql: [
    { label: "Make chart",             nodeType: "chart" },
    { label: "View table",             nodeType: "table" },
    { label: "Interactive filter",     nodeType: "controls" },
    { label: "Join tables",            nodeType: "join" },
    { label: "Group by + Summarize",   nodeType: "group" },
  ],
  group: [
    { label: "Make chart",          nodeType: "chart" },
    { label: "View table",          nodeType: "table" },
    { label: "Remove duplicates",   nodeType: "distinct" },
    { label: "Custom SQL",          nodeType: "sql" },
  ],
  join: [
    { label: "Make chart",             nodeType: "chart" },
    { label: "View table",             nodeType: "table" },
    { label: "Interactive filter",     nodeType: "controls" },
    { label: "Group by + Summarize",   nodeType: "group" },
    { label: "Custom SQL",             nodeType: "sql" },
  ],
  chart: [
    { label: "View table",    nodeType: "table" },
    { label: "Custom SQL",    nodeType: "sql" },
  ],
  distinct: [
    { label: "Make chart",    nodeType: "chart" },
    { label: "View table",    nodeType: "table" },
  ],
  controls: [
    { label: "View table",             nodeType: "table" },
    { label: "Make chart",             nodeType: "chart" },
    { label: "Group by + Summarize",   nodeType: "group" },
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
          (() => {
            const Icon = action.nodeType ? getNodeTypeIcon(action.nodeType) : null;
            return (
              <button
                key={i}
                className="node-action-btn"
                onClick={() => handleAction(action)}
                title={action.label}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                <span className="tooltip">{action.label}</span>
              </button>
            );
          })()
        )
      ))}
    </div>
  );
}
