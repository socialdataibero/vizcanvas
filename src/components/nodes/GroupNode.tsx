"use client";

import React, { useEffect } from "react";
import { DAGNode } from "@/engine/types";
import { GroupConfig, AggregationConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import TablePreview from "./shared/TablePreview";
import NodeInfoTooltip from "./shared/NodeInfoTooltip";

interface Props {
  node: DAGNode;
}

function isNumericType(type: string): boolean {
  return /int|float|double|decimal|numeric|real|bigint|smallint|tinyint/i.test(type);
}

function requiresNumericColumn(fn?: AggregationConfig["function"]): boolean {
  return Boolean(fn && fn !== "COUNT");
}

export default function GroupNodeBody({ node }: Props) {
  const config = node.config as GroupConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const executeDirty = useDagStore((s) => s.executeDirty);
  const upstreamIds = useDagStore((s) => s.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((s) => upstreamIds[0] ? s.nodes[upstreamIds[0]] : undefined);
  const availableColumns = upstreamNode?.result?.columns || [];
  const previewResult = node.result ?? upstreamNode?.result ?? null;
  const columnTypeByName = new Map(availableColumns.map((column) => [column.name, column.type]));
  const groupByColumns = config.groupByColumns || [];
  const aggregations = config.aggregations || [];
  const validAggregationCount = aggregations.filter((agg) => agg.function && agg.column).length;
  const hasPartialAggregation = aggregations.some(
    (agg) => Boolean(agg.function || agg.column) && !(agg.function && agg.column)
  );
  const displayAggregations = aggregations.length > 0 ? aggregations : [{}];
  const hasOperation = groupByColumns.length > 0 || validAggregationCount > 0;
  const currentVersion = config.configVersion ?? 0;
  const lastRunVersion = config.lastRunVersion ?? 0;
  const hasPendingChanges = hasOperation && lastRunVersion < currentVersion;

  useEffect(() => {
    if (aggregations.length === 0 || availableColumns.length === 0) return;

    const normalizedAggregations = aggregations.map((aggregation) => {
      if (
        aggregation.column &&
        requiresNumericColumn(aggregation.function) &&
        !isNumericType(columnTypeByName.get(aggregation.column) || "")
      ) {
        return {
          ...aggregation,
          function: undefined,
        };
      }

      return aggregation;
    });

    const changed = normalizedAggregations.some(
      (aggregation, index) =>
        aggregation.function !== aggregations[index]?.function ||
        aggregation.column !== aggregations[index]?.column ||
        aggregation.alias !== aggregations[index]?.alias
    );

    if (changed) {
      updateGroupConfig({ aggregations: normalizedAggregations });
    }
  }, [aggregations, availableColumns.length]);

  useEffect(() => {
    if (!hasOperation || currentVersion === lastRunVersion) return;
    updateNodeConfig(
      node.id,
      { lastRunVersion: currentVersion } as Partial<GroupConfig>,
      { autoExecute: false }
    );
    void executeDirty(node.id);
  }, [currentVersion, executeDirty, hasOperation, lastRunVersion, node.id, updateNodeConfig]);

  const updateGroupConfig = (patch: Partial<GroupConfig>) => {
    updateNodeConfig(
      node.id,
      {
        ...patch,
        configVersion: currentVersion + 1,
      } as Partial<GroupConfig>,
      { autoExecute: false }
    );
  };

  const handleGroupByChange = (col: string, checked: boolean) => {
    const newCols = checked
      ? [...groupByColumns, col]
      : groupByColumns.filter((c) => c !== col);
    updateGroupConfig({ groupByColumns: newCols });
  };

  const handleAddAggregation = () => {
    const aggs = [...aggregations];
    aggs.push({});
    updateGroupConfig({ aggregations: aggs });
  };

  const handleUpdateAgg = (index: number, patch: Partial<AggregationConfig>) => {
    const aggs = aggregations.length > 0 ? [...aggregations] : [{}];
    const nextAgg = { ...aggs[index], ...patch };

    if (
      nextAgg.column &&
      requiresNumericColumn(nextAgg.function) &&
      !isNumericType(columnTypeByName.get(nextAgg.column) || "")
    ) {
      nextAgg.function = undefined;
    }

    aggs[index] = nextAgg;
    updateGroupConfig({ aggregations: aggs });
  };

  const handleRemoveAgg = (index: number) => {
    const aggs = aggregations.filter((_, i) => i !== index);
    updateGroupConfig({ aggregations: aggs });
  };

  if (availableColumns.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-xs text-gray-400">
        <span className="text-2xl">📊</span>
        Connect an input first
      </div>
    );
  }

  return (
    <div className="space-y-3 no-drag">
      <div className="rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">1</span>
            <span className="text-[11px] font-semibold text-indigo-900">Group by</span>
            <NodeInfoTooltip
              title="Group by"
              description="Choose the columns that define each group of rows before calculating summaries."
            />
          </div>
          <span className="text-[10px] text-indigo-700/80">
            {groupByColumns.length > 0 ? `${groupByColumns.length} selected` : "Optional"}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {availableColumns.map((col) => (
            <label key={col.name} className="flex items-center gap-1 rounded bg-gray-50 px-2 py-1 text-xs cursor-pointer hover:bg-gray-100">
              <input
                type="checkbox"
                checked={groupByColumns.includes(col.name)}
                onChange={(e) => handleGroupByChange(col.name, e.target.checked)}
                className="accent-indigo-500"
              />
              {col.name}
            </label>
          ))}
        </div>
        {groupByColumns.length === 0 && (
          <div className="mt-2 text-[10px] text-indigo-700/75">
            Whole table
          </div>
        )}
      </div>

      <div className="rounded-lg border border-fuchsia-100 bg-fuchsia-50/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-fuchsia-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">2</span>
            <span className="text-[11px] font-semibold text-fuchsia-900">Summarize</span>
            <NodeInfoTooltip
              title="Summarize"
              description="Add metrics such as totals, averages, counts, minimums, or maximums for each group."
            />
          </div>
          <span className="text-[10px] text-fuchsia-700/80">
            {validAggregationCount > 0 ? `${validAggregationCount} summary${validAggregationCount === 1 ? "" : "ies"}` : "Optional"}
          </span>
        </div>
        {displayAggregations.map((agg, i) => (
          <div key={i} className="mt-1 flex items-center gap-1">
            {(() => {
              const selectedColumnType = agg.column ? columnTypeByName.get(agg.column) || "" : "";
              const selectedFunctionNeedsNumber = requiresNumericColumn(agg.function);
              const numericOnly = agg.column ? !isNumericType(selectedColumnType) : false;

              return (
                <>
            <select
              value={agg.function || ""}
              onChange={(e) => handleUpdateAgg(i, {
                function: e.target.value ? (e.target.value as AggregationConfig["function"]) : undefined,
              })}
              className="rounded border border-gray-200 px-1.5 py-1 text-xs"
            >
              <option value="">Select</option>
              {["COUNT", "SUM", "AVG", "MIN", "MAX"].map((fn) => (
                <option
                  key={fn}
                  value={fn}
                  disabled={numericOnly && fn !== "COUNT"}
                >
                  {fn}
                </option>
              ))}
            </select>
            <select
              value={agg.column || ""}
              onChange={(e) => handleUpdateAgg(i, { column: e.target.value || undefined })}
              className="flex-1 rounded border border-gray-200 px-1.5 py-1 text-xs"
            >
              <option value="">Select column</option>
              {availableColumns.map((col) => (
                <option
                  key={col.name}
                  value={col.name}
                  disabled={selectedFunctionNeedsNumber && !isNumericType(col.type)}
                >
                  {col.name}
                </option>
              ))}
            </select>
            <button onClick={() => handleRemoveAgg(i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </>
              );
            })()}
          </div>
        ))}
        <button onClick={handleAddAggregation} className="mt-2 text-xs font-medium text-fuchsia-700 hover:text-fuchsia-900">
          + Add summary
        </button>
      </div>

      <div className="text-[10px] text-gray-400">
        {!hasOperation
          ? hasPartialAggregation
            ? "Complete the summary to apply it. Showing input rows."
            : "Showing input rows. Select groups or summaries."
          : hasPendingChanges
            ? "Applying automatically..."
            : hasPartialAggregation
              ? "Applied current setup. Complete the pending summary to include it."
            : node.status === "success"
              ? "Upstream changes will keep propagating."
              : "Ready."}
      </div>

      {previewResult && <TablePreview result={previewResult} maxRows={20} />}
    </div>
  );
}
