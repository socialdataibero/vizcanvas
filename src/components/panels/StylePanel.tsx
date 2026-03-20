"use client";

import React from "react";
import { useUIStore } from "@/stores/uiStore";

export default function StylePanel() {
  const toggleStylePanel = useUIStore((s) => s.toggleStylePanel);

  return (
    <div className="panel w-56">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Style</span>
        <button onClick={toggleStylePanel} className="text-gray-400 hover:text-gray-600 text-sm">✕</button>
      </div>
      <div className="p-3 flex flex-col items-center justify-center gap-2 text-center py-8">
        <span className="text-2xl">🎨</span>
        <p className="text-xs text-gray-500">Style controls coming soon</p>
        <p className="text-[10px] text-gray-400">Select a node to customize its appearance</p>
      </div>
    </div>
  );
}
