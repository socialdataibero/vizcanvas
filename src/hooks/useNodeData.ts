"use client";

import { useDagStore } from "@/stores/dagStore";
import { QueryResult } from "@/types/nodes";

export function useNodeData(nodeId: string): {
  result: QueryResult | null;
  status: string;
  error?: string;
} {
  const node = useDagStore((s) => s.nodes[nodeId]);
  return {
    result: node?.result || null,
    status: node?.status || "idle",
    error: node?.error,
  };
}
