"use client";

import React from "react";
import { LuTableProperties } from "react-icons/lu";
import { DAGNode } from "@/engine/types";
import { TableDisplayConfig } from "@/types/nodes";
import { useDagStore } from "@/stores/dagStore";
import TablePreview from "./shared/TablePreview";

interface Props {
  node: DAGNode;
}

export default function TableNodeBody({ node }: Props) {
  const config = node.config as TableDisplayConfig;
  const updateNodeConfig = useDagStore((s) => s.updateNodeConfig);

  const handleSort = (column: string) => {
    const newDir =
      config.sortColumn === column && config.sortDirection === "asc"
        ? "desc"
        : "asc";
    updateNodeConfig(node.id, {
      sortColumn: column,
      sortDirection: newDir,
    } as Partial<TableDisplayConfig>);
  };

  if (!node.result) {
    return (
      <div className="flex flex-col items-center gap-2 py-4 text-xs text-gray-400">
        <LuTableProperties className="h-7 w-7" />
        Connect an input to display data
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col no-drag">
      <TablePreview
        result={node.result}
        maxRows={50}
        fillAvailableHeight
        onSort={handleSort}
        sortColumn={config.sortColumn}
        sortDirection={config.sortDirection}
      />
    </div>
  );
}
