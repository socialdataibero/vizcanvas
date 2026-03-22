"use client";

import React from "react";
import { DAGNode } from "@/engine/types";
import { DistinctConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import { INITIAL_TABLE_VISIBLE_ROWS } from "@/lib/canvasLayout";
import TablePreview from "./shared/TablePreview";
import NodeInfoTooltip from "./shared/NodeInfoTooltip";

interface Props {
  node: DAGNode;
  expandTablePreview?: boolean;
}

export default function DistinctNodeBody({ node, expandTablePreview = false }: Props) {
  const config = node.config as DistinctConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const executeDirty = useDagStore((s) => s.executeDirty);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const availableColumns = upstreamNode?.result?.columns || [];

  const handleColumnToggle = (col: string, checked: boolean) => {
    const newCols = checked
      ? [...(config.columns || []), col]
      : (config.columns || []).filter((c) => c !== col);
    updateNodeConfig(node.id, { columns: newCols } as Partial<DistinctConfig>);
  };

  if (availableColumns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-xs text-gray-400">
        <span className="text-2xl">🎯</span>
        Connect an input first
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col gap-3 no-drag ${expandTablePreview ? "h-full" : ""}`}>
      <div className="flex-shrink-0 rounded-lg border border-cyan-100 bg-cyan-50/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold text-cyan-900">Keep unique rows</div>
          <NodeInfoTooltip
            title="Keep unique rows"
            description="Choose the columns that define what counts as a duplicate. Leave empty to compare the whole row."
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {availableColumns.map((col) => (
            <label key={col.name} className="flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={(config.columns || []).includes(col.name)}
                onChange={(e) => handleColumnToggle(col.name, e.target.checked)}
                className="accent-indigo-500"
              />
              {col.name}
            </label>
          ))}
        </div>
      </div>

      <button
        onClick={() => void executeDirty(node.id)}
        className="w-full flex-shrink-0 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
      >
        ▶ Remove duplicates
      </button>

      {node.result && (
        <TablePreview
          result={node.result}
          maxRows={expandTablePreview ? 20 : INITIAL_TABLE_VISIBLE_ROWS}
          fillAvailableHeight={expandTablePreview}
        />
      )}
    </div>
  );
}
