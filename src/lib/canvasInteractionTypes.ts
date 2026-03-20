"use client";

export type ResizeDirection = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type CanvasPoint = { x: number; y: number };
export type NodePosition = { x: number; y: number };
export type NodeSize = { width: number; height: number };
export type SelectionRect = { x: number; y: number; width: number; height: number };

export type CanvasContextMenuState = {
  x: number;
  y: number;
  canvasX: number;
  canvasY: number;
};

export type NodeContextMenuState = {
  x: number;
  y: number;
  nodeId: string;
};

export type FrameContextMenuState = {
  x: number;
  y: number;
  frameId: string;
};
