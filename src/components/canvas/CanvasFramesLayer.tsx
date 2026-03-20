"use client";

import React from "react";
import { CanvasFrame } from "@/types/canvas";

interface CanvasFramesLayerProps {
  frames: CanvasFrame[];
  selectedFrameId: string | null;
  onFrameDragStart: (frameId: string) => (event: React.MouseEvent) => void;
  onFrameRightClick: (frameId: string) => (event: React.MouseEvent) => void;
  onFrameSelect: (frameId: string) => (event: React.MouseEvent) => void;
}

export default function CanvasFramesLayer({
  frames,
  selectedFrameId,
  onFrameDragStart,
  onFrameRightClick,
  onFrameSelect,
}: CanvasFramesLayerProps) {
  return (
    <>
      {frames.map((frame) => (
        <div
          key={frame.id}
          style={{ pointerEvents: "auto" }}
          onContextMenu={onFrameRightClick(frame.id)}
        >
          <div
            className={`canvas-frame ${selectedFrameId === frame.id ? "selected" : ""}`}
            style={{
              left: frame.x,
              top: frame.y,
              width: frame.width,
              height: frame.height,
            }}
            onMouseDown={onFrameDragStart(frame.id)}
            onClick={onFrameSelect(frame.id)}
          >
            <div className="canvas-frame-title">{frame.name}</div>
          </div>
        </div>
      ))}
    </>
  );
}
