"use client";

import React from "react";
import { DAGNode } from "@/engine/types";
import { FromConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import { useDataStore } from "@/stores/dataStore";
import TablePreview from "./shared/TablePreview";

interface Props {
  node: DAGNode;
}

export default function FromNodeBody({ node }: Props) {
  const config = node.config as FromConfig;
  const tables = useDataStore((s) => s.tables);
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);

  const handleTableChange = (tableName: string) => {
    updateNodeConfig(node.id, { tableName, filters: [] } as Partial<FromConfig>);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 no-drag">
      {/* Table selector */}
      <div className="flex-shrink-0">
        <label className="text-[10px] font-medium text-gray-500 uppercase">Source table</label>
        <select
          value={config.tableName || ""}
          onChange={(e) => handleTableChange(e.target.value)}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs outline-none focus:border-indigo-400"
        >
          <option value="">Select a table...</option>
          {tables.map((t) => (
            <option key={t.name} value={t.name}>{t.name}</option>
          ))}
        </select>
      </div>

      {/* Filters summary */}
      {config.filters && config.filters.length > 0 && (
        <div className="flex-shrink-0 rounded bg-indigo-50 px-2 py-1 text-[10px] text-indigo-700">
          {config.filters.length} filter{config.filters.length > 1 ? "s" : ""} applied
        </div>
      )}

      {/* Results preview */}
      {node.result && <TablePreview result={node.result} maxRows={20} fillAvailableHeight />}

      {/* Row count */}
      {node.result && (
        <div className="flex-shrink-0 text-[10px] text-gray-400 text-center">
          {node.result.totalRows.toLocaleString()} rows · {node.result.columns.length} columns
        </div>
      )}
    </div>
  );
}
