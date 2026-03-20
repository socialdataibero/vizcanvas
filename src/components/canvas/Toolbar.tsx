"use client";

import React from "react";
import { useUIStore } from "@/stores/uiStore";
import { NodeType } from "@/types/nodes";
import { TOOLBAR_NODE_GROUPS } from "@/lib/nodeConfig";

interface Props {
  onAddNode: (type: NodeType, position?: { x: number; y: number }) => string;
}

export default function Toolbar({ onAddNode }: Props) {
  const toggleDataPanel = useUIStore((s) => s.toggleDataPanel);
  const toggleStylePanel = useUIStore((s) => s.toggleStylePanel);
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);
  const dataPanelOpen = useUIStore((s) => s.dataPanelOpen);

  return (
    <div className="panel flex items-stretch gap-2 px-2 py-2">
      <div className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50/80 px-2 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">Workspace</span>
        <div className="mt-1 flex items-center gap-1">
          <button
            onClick={toggleDataPanel}
            className={`toolbar-btn ${dataPanelOpen ? "active" : ""}`}
            title="Open data sources"
          >
            🗄️
          </button>
        </div>
      </div>

      {TOOLBAR_NODE_GROUPS.map((group) => (
        <div
          key={group.id}
          className="flex flex-col justify-between rounded-xl border border-gray-100 bg-white/90 px-2 py-1.5"
        >
          <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">
            {group.label}
          </span>
          <div className="mt-1 flex items-center gap-1">
            {group.items.map(({ type, icon, label, shortcut }) => (
              <button
                key={type}
                onClick={() => onAddNode(type, { x: 400 + Math.random() * 200, y: 300 + Math.random() * 200 })}
                className="toolbar-btn group relative"
                title={`${label}${shortcut ? ` (${shortcut})` : ""}`}
              >
                <span className="text-base">{icon}</span>
                <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                  {label}
                  {shortcut && <kbd className="ml-1 rounded bg-gray-600 px-1 text-[10px]">{shortcut}</kbd>}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}

      <div className="flex flex-col justify-between rounded-xl border border-gray-100 bg-gray-50/80 px-2 py-1.5">
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-400">Assist</span>
        <div className="mt-1 flex items-center gap-1">
          <button onClick={toggleStylePanel} className="toolbar-btn" title="Open style panel">
            🎨
          </button>
          <button onClick={toggleAIPanel} className="toolbar-btn" title="Open AI assistant">
            ✨
          </button>
        </div>
      </div>
    </div>
  );
}
