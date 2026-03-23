"use client";

import React, { useCallback, useEffect, useMemo } from "react";
import { LuMerge } from "react-icons/lu";
import { DAGNode } from "@/engine/types";
import { JoinConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import { INITIAL_TABLE_VISIBLE_ROWS } from "@/lib/canvasLayout";
import { formatColumnDisplayName, getJoinSuggestions } from "@/lib/columnSemantics";
import TablePreview from "./shared/TablePreview";
import NodeInfoTooltip from "./shared/NodeInfoTooltip";

interface Props {
  node: DAGNode;
  expandTablePreview?: boolean;
}

export default function JoinNodeBody({ node, expandTablePreview = false }: Props) {
  const config = node.config as JoinConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const executeDirty = useDagStore((s) => s.executeDirty);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const leftNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const rightNode = useDagStore((s) => upstreamIds[1] ? s.nodes[upstreamIds[1]] : undefined);

  const leftColumns = leftNode?.result?.columns || [];
  const rightColumns = rightNode?.result?.columns || [];
  const hasJoinColumns = Boolean(config.leftColumn?.trim() && config.rightColumn?.trim());
  const currentVersion = config.configVersion ?? 0;
  const lastRunVersion = config.lastRunVersion ?? 0;
  const hasPendingChanges = hasJoinColumns && lastRunVersion < currentVersion;
  const joinSuggestions = useMemo(
    () =>
      getJoinSuggestions(
        leftColumns,
        leftNode?.result?.rows,
        rightColumns,
        rightNode?.result?.rows
      ),
    [leftColumns, leftNode?.result?.rows, rightColumns, rightNode?.result?.rows]
  );

  const updateJoinConfig = useCallback((patch: Partial<JoinConfig>) => {
    updateNodeConfig(
      node.id,
      {
        ...patch,
        configVersion: currentVersion + 1,
      } as Partial<JoinConfig>,
      { autoExecute: false }
    );
  }, [currentVersion, node.id, updateNodeConfig]);

  useEffect(() => {
    if (!hasJoinColumns || currentVersion === lastRunVersion) return;
    updateNodeConfig(
      node.id,
      { lastRunVersion: currentVersion } as Partial<JoinConfig>,
      { autoExecute: false }
    );
    void executeDirty(node.id);
  }, [currentVersion, executeDirty, hasJoinColumns, lastRunVersion, node.id, updateNodeConfig]);

  if (upstreamIds.length < 2) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-xs text-gray-400">
        <LuMerge className="h-7 w-7" />
        {upstreamIds.length === 0 ? "Connect two inputs to join" : "Connect one more input to complete the join"}
      </div>
    );
  }

  return (
    <div className={`flex min-h-0 flex-col gap-2 no-drag ${expandTablePreview ? "h-full" : ""}`}>
      <div className="flex-shrink-0 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="text-[11px] font-semibold text-amber-900">Join two sources</div>
          <NodeInfoTooltip
            title="Join two sources"
            description="Match rows from the left and right inputs using the selected key columns."
          />
        </div>
        {joinSuggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {joinSuggestions.slice(0, 3).map((suggestion) => {
              const isActive =
                config.leftColumn === suggestion.leftColumn &&
                config.rightColumn === suggestion.rightColumn;

              return (
                <button
                  key={`${suggestion.leftColumn}:${suggestion.rightColumn}`}
                  onClick={() => updateJoinConfig({
                    leftColumn: suggestion.leftColumn,
                    rightColumn: suggestion.rightColumn,
                  })}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors ${
                    isActive
                      ? "border-amber-300 bg-amber-200 text-amber-950"
                      : "border-amber-200 bg-white text-amber-800 hover:bg-amber-100"
                  }`}
                  title={suggestion.reason}
                >
                  {suggestion.leftColumn} = {suggestion.rightColumn}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Join type */}
      <div className="flex-shrink-0">
        <label className="text-[10px] font-medium text-gray-500 uppercase">Join Type</label>
        <select
          value={config.joinType || "INNER"}
          onChange={(e) => updateJoinConfig({ joinType: e.target.value as JoinConfig["joinType"] })}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
        >
          {["INNER", "LEFT", "RIGHT", "FULL"].map((jt) => (
            <option key={jt} value={jt}>{jt} JOIN</option>
          ))}
        </select>
      </div>

      {/* Left column */}
      <div className="flex-shrink-0">
        <label className="text-[10px] font-medium text-gray-500 uppercase">Left Column</label>
        <select
          value={config.leftColumn || ""}
          onChange={(e) => updateJoinConfig({ leftColumn: e.target.value })}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
        >
          <option value="">Select...</option>
          {leftColumns.map((col) => (
            <option key={col.name} value={col.name}>{formatColumnDisplayName(col)}</option>
          ))}
        </select>
      </div>

      {/* Right column */}
      <div className="flex-shrink-0">
        <label className="text-[10px] font-medium text-gray-500 uppercase">Right Column</label>
        <select
          value={config.rightColumn || ""}
          onChange={(e) => updateJoinConfig({ rightColumn: e.target.value })}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs"
        >
          <option value="">Select...</option>
          {rightColumns.map((col) => (
            <option key={col.name} value={col.name}>{formatColumnDisplayName(col)}</option>
          ))}
        </select>
      </div>

      <div className="flex-shrink-0 text-[10px] text-gray-400">
        {!hasJoinColumns
          ? "Choose the left and right join columns to apply the join."
          : hasPendingChanges || node.status === "running"
            ? "Applying automatically..."
            : node.status === "success"
              ? "Upstream changes will keep propagating."
              : "Ready."}
      </div>

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
