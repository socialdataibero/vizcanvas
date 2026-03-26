"use client";

import React, { useState } from "react";
import { DAGNode } from "@/engine/types";
import { SQLConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import { INITIAL_TABLE_VISIBLE_ROWS } from "@/lib/canvasLayout";
import TablePreview from "./shared/TablePreview";

interface Props {
  node: DAGNode;
  expandTablePreview?: boolean;
}

export default function SQLNodeBody({ node, expandTablePreview = false }: Props) {
  const config = node.config as SQLConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);
  const [query, setQuery] = useState(config.query || "SELECT * FROM input");

  const handleRun = () => {
    updateNodeConfig(node.id, { query } as Partial<SQLConfig>);
  };

  return (
    <div className={`flex min-h-0 flex-col gap-2 no-drag ${expandTablePreview ? "h-full" : ""}`}>
      {/* SQL Editor */}
      <div className="flex-shrink-0">
        <label className="text-[10px] font-medium text-gray-500 uppercase">SQL Query</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handleRun();
            }
          }}
          placeholder="SELECT * FROM input"
          rows={4}
          className="mt-0.5 w-full rounded-md border border-gray-200 px-2 py-1.5 text-xs font-mono outline-none focus:border-indigo-400 resize-y"
          spellCheck={false}
        />
      </div>

      {/* Run button */}
      <div className="flex flex-shrink-0 items-center gap-2">
        <button
          onClick={handleRun}
          disabled={node.status === "running"}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {node.status === "running" ? "Running..." : "▶ Run"}
        </button>
        <span className="text-[10px] text-gray-400">⌘+Enter</span>
      </div>

      {/* Results preview */}
      {node.result && (
        <TablePreview
          result={node.result}
          maxRows={expandTablePreview ? 20 : INITIAL_TABLE_VISIBLE_ROWS}
          fillAvailableHeight={expandTablePreview}
        />
      )}

      {node.result && (
        <div className="flex-shrink-0 text-[10px] text-gray-400 text-center">
          {node.result.totalRows.toLocaleString()} rows
        </div>
      )}
    </div>
  );
}
