"use client";

import React from "react";

interface CanvasSelectionMarqueeProps {
  visible: boolean;
  left: number;
  top: number;
  width: number;
  height: number;
}

export default function CanvasSelectionMarquee({
  visible,
  left,
  top,
  width,
  height,
}: CanvasSelectionMarqueeProps) {
  if (!visible) {
    return null;
  }

  return (
    <div
      className="selection-marquee"
      style={{
        left,
        top,
        width,
        height,
      }}
    />
  );
}
