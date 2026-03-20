"use client";

import React from "react";

interface CanvasSurfaceProps {
  pan: { x: number; y: number };
  zoom: number;
  children: React.ReactNode;
}

export default function CanvasSurface({
  pan,
  zoom,
  children,
}: CanvasSurfaceProps) {
  return (
    <div
      className="canvas-surface absolute inset-0"
      style={{
        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
        transformOrigin: "0 0",
        willChange: "transform",
        pointerEvents: "none",
      }}
    >
      {children}
    </div>
  );
}
