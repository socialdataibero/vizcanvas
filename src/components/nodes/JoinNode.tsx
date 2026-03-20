"use client";

import React from "react";
import { LuMerge } from "react-icons/lu";
import { DAGNode } from "@/engine/types";
import { JoinConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import TablePreview from "./shared/TablePreview";
import NodeInfoTooltip from "./shared/NodeInfoTooltip";

interface Props {
  node: DAGNode;
}

export default function JoinNodeBody({ node }: Props) {
  const config = node.config as JoinConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const executeDirty = useDagStore((s) => s.executeDirty);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const leftNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const rightNode = useDagStore((s) => upstreamIds[1] ? s.nodes[upstreamIds[1]] : undefined);

  const leftColumns = leftNode?.result?.columns || [];
  const rightColumns = rightNode?.result?.columns || [];

  if (upstreamIds.length < 2) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-xs text-gray-400">
        <LuMerge className="h-7 w-7" />
        Connect two inputs to join
      </div>
    );
  }

  return (
    <div className="space-y-2 no-drag">
      <div className="rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold text-amber-900">Join two sources</div>
          <NodeInfoTooltip
            title="Join two sources"
            description="Match rows from the left and right inputs using the selected key columns."
          />
        </div>
      </div>

      {/* Join type */}
      <div>
        <label className="text-[10px] font-medium text-gray-500 uppercase">Join Type</label>
        <select
          value={config.joinType || "INNER"}
          onChange={(e) => updateNodeConfig(node.id, { joinType: e.target.value } as Partial<JoinConfig>)}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
        >
          {["INNER", "LEFT", "RIGHT", "FULL"].map((jt) => (
            <option key={jt} value={jt}>{jt} JOIN</option>
          ))}
        </select>
      </div>

      {/* Left column */}
      <div>
        <label className="text-[10px] font-medium text-gray-500 uppercase">Left Column</label>
        <select
          value={config.leftColumn || ""}
          onChange={(e) => updateNodeConfig(node.id, { leftColumn: e.target.value } as Partial<JoinConfig>)}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
        >
          <option value="">Select...</option>
          {leftColumns.map((col) => (
            <option key={col.name} value={col.name}>{col.name}</option>
          ))}
        </select>
      </div>

      {/* Right column */}
      <div>
        <label className="text-[10px] font-medium text-gray-500 uppercase">Right Column</label>
        <select
          value={config.rightColumn || ""}
          onChange={(e) => updateNodeConfig(node.id, { rightColumn: e.target.value } as Partial<JoinConfig>)}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
        >
          <option value="">Select...</option>
          {rightColumns.map((col) => (
            <option key={col.name} value={col.name}>{col.name}</option>
          ))}
        </select>
      </div>

      <button
        onClick={() => void executeDirty(node.id)}
        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 w-full"
      >
        ▶ Run join
      </button>

      {node.result && <TablePreview result={node.result} maxRows={20} />}
    </div>
  );
}
