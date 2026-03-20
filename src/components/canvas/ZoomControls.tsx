"use client";

import React from "react";

interface ZoomControlsProps {
  zoom: number;
  onZoomChange: (zoom: number) => void;
  onReset: () => void;
}

export default function ZoomControls({
  zoom,
  onZoomChange,
  onReset,
}: ZoomControlsProps) {
  return (
    <div className="absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-lg bg-white/90 px-3 py-1.5 text-xs text-gray-500 shadow-sm backdrop-blur">
      <button
        onClick={() => onZoomChange(Math.max(0.15, zoom - 0.1))}
        className="hover:text-gray-800 px-1 font-medium"
      >
        −
      </button>
      <span className="w-12 text-center font-medium">{Math.round(zoom * 100)}%</span>
      <button
        onClick={() => onZoomChange(Math.min(3, zoom + 0.1))}
        className="hover:text-gray-800 px-1 font-medium"
      >
        +
      </button>
      <span className="ml-2 text-gray-300">|</span>
      <button
        onClick={onReset}
        className="hover:text-gray-800 px-1 text-[10px]"
        title="Reset view (Shift+0)"
      >
        ⌖
      </button>
    </div>
  );
}
