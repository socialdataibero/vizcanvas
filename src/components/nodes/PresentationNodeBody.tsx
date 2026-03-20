"use client";

import React from "react";
import { DAGNode } from "@/engine/types";
import { useDagStore } from "@/stores/dagStore";
import { ControlsConfig, DistinctConfig, FromConfig, GroupConfig } from "@/types/nodes";
import TablePreview from "./shared/TablePreview";

interface Props {
  node: DAGNode;
}

function getPresentationSummary(node: DAGNode): string | null {
  switch (node.type) {
    case "from": {
      const tableName = (node.config as FromConfig).tableName?.trim();
      return tableName ? `Source: ${tableName}` : "Source preview";
    }
    case "group": {
      const config = node.config as GroupConfig;
      const groups = config.groupByColumns ?? [];
      const metrics = (config.aggregations ?? [])
        .filter((aggregation) => aggregation.function && aggregation.column)
        .map((aggregation) => `${aggregation.function}(${aggregation.column})`);

      if (groups.length === 0 && metrics.length === 0) {
        return "Grouped result";
      }

      const parts: string[] = [];
      if (groups.length > 0) {
        parts.push(`By ${groups.join(", ")}`);
      }
      if (metrics.length > 0) {
        parts.push(metrics.join(" · "));
      }
      return parts.join(" • ");
    }
    case "controls": {
      const activeControls = (node.config as ControlsConfig).controls?.length ?? 0;
      return activeControls > 0 ? `${activeControls} interactive filter${activeControls === 1 ? "" : "s"}` : "Filtered result";
    }
    case "distinct": {
      const columns = (node.config as DistinctConfig).columns ?? [];
      return columns.length > 0 ? `Unique by ${columns.join(", ")}` : "Unique rows";
    }
    case "table":
      return "Table preview";
    case "join":
      return "Joined result";
    case "sql":
      return "Query result";
    case "javascript":
      return "Script result";
    default:
      return null;
  }
}

export default function PresentationNodeBody({ node }: Props) {
  const upstreamIds = useDagStore((state) => state.getUpstreamNodeIds(node.id));
  const upstreamNode = useDagStore((state) => (upstreamIds[0] ? state.nodes[upstreamIds[0]] : undefined));
  const previewResult = node.result ?? upstreamNode?.result ?? null;
  const summary = getPresentationSummary(node);

  if (!previewResult) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        No result to present
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {summary && (
        <div className="px-1 text-[11px] font-medium text-slate-500">
          {summary}
        </div>
      )}
      <div className="min-h-0 rounded-xl border border-slate-100 bg-white/95 shadow-sm">
        <TablePreview result={previewResult} maxRows={20} readOnly presentation />
      </div>
    </div>
  );
}
