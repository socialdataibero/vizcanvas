"use client";

import React, { useLayoutEffect, useState } from "react";
import { DAGEdge } from "@/engine/types";
import { getInputPortOffsetPercent } from "@/lib/inputPorts";

interface Props {
  edges: DAGEdge[];
  nodes: Record<string, { type: string }>;
  nodePositions: Record<string, { x: number; y: number }>;
  connectingFrom: string | null;
  connectingMouse: { x: number; y: number };
  pan: { x: number; y: number };
  zoom: number;
}

const NODE_WIDTH = 300;
const NODE_HEIGHT = 60;

interface NodeAnchorMetrics {
  inputs: Array<{ x: number; y: number }>;
  output: { x: number; y: number };
}

export default function EdgeRenderer({ edges, nodes, nodePositions, connectingFrom, connectingMouse, pan, zoom }: Props) {
  const [nodeAnchors, setNodeAnchors] = useState<Record<string, NodeAnchorMetrics>>({});

  useLayoutEffect(() => {
    if (typeof document === "undefined") return;

    let frameId = 0;

    const measure = () => {
      const nextAnchors: Record<string, NodeAnchorMetrics> = {};
      const surfaceElement = document.querySelector(".canvas-surface") as HTMLElement | null;
      const surfaceRect = surfaceElement?.getBoundingClientRect();

      if (!surfaceRect) return;

      for (const nodeId of Object.keys(nodePositions)) {
        const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
        if (!nodeElement) continue;

        const inputPorts = Array.from(nodeElement.querySelectorAll(".port.input")) as HTMLElement[];
        const outputPort = nodeElement.querySelector(".port.output") as HTMLElement | null;
        const nodeRect = nodeElement.getBoundingClientRect();
        const defaultInputX = (nodeRect.left - surfaceRect.left) / zoom;
        const defaultOutputX = (nodeRect.right - surfaceRect.left) / zoom;
        const defaultCenterY = (nodeRect.top + nodeRect.height / 2 - surfaceRect.top) / zoom;
        const outputRect = outputPort?.getBoundingClientRect();
        const sortedInputPorts = inputPorts.sort((left, right) => {
          const leftIndex = Number(left.dataset.inputIndex ?? 0);
          const rightIndex = Number(right.dataset.inputIndex ?? 0);
          return leftIndex - rightIndex;
        });
        const inputs = sortedInputPorts.length > 0
          ? sortedInputPorts.map((inputPort) => {
              const inputRect = inputPort.getBoundingClientRect();
              return {
                x: (inputRect.left + inputRect.width / 2 - surfaceRect.left) / zoom,
                y: (inputRect.top + inputRect.height / 2 - surfaceRect.top) / zoom,
              };
            })
          : [{
              x: defaultInputX,
              y: defaultCenterY,
            }];

        nextAnchors[nodeId] = {
          inputs,
          output: {
            x: outputRect
              ? (outputRect.left + outputRect.width / 2 - surfaceRect.left) / zoom
              : defaultOutputX,
            y: outputRect
              ? (outputRect.top + outputRect.height / 2 - surfaceRect.top) / zoom
              : defaultCenterY,
          },
        };
      }

      setNodeAnchors((previous) => {
        const previousKeys = Object.keys(previous);
        const nextKeys = Object.keys(nextAnchors);

        const isSame =
          previousKeys.length === nextKeys.length &&
          nextKeys.every((nodeId) => {
            const prevAnchor = previous[nodeId];
            const nextAnchor = nextAnchors[nodeId];
            return (
              prevAnchor &&
              prevAnchor.inputs.length === nextAnchor.inputs.length &&
              prevAnchor.inputs.every((input, index) =>
                input.x === nextAnchor.inputs[index]?.x &&
                input.y === nextAnchor.inputs[index]?.y
              ) &&
              prevAnchor.output.x === nextAnchor.output.x &&
              prevAnchor.output.y === nextAnchor.output.y
            );
          });

        return isSame ? previous : nextAnchors;
      });
    };

    const scheduleMeasure = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    };

    scheduleMeasure();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleMeasure) : null;

    for (const nodeId of Object.keys(nodePositions)) {
      const nodeElement = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement | null;
      if (nodeElement) {
        resizeObserver?.observe(nodeElement);
      }
    }

    window.addEventListener("resize", scheduleMeasure);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [edges, nodePositions, connectingFrom, zoom]);

  const getNodeAnchor = (nodeId: string, side: "left" | "right", inputIndex = 0) => {
    const anchor = nodeAnchors[nodeId];
    if (anchor) {
      if (side === "right") return anchor.output;
      return anchor.inputs[inputIndex] ?? anchor.inputs[0] ?? anchor.output;
    }

    const pos = nodePositions[nodeId];
    if (!pos) return { x: 0, y: 0 };

    const fallbackNodeType = nodes[nodeId]?.type;
    const fallbackInputCount = fallbackNodeType === "join" ? 2 : 1;
    const fallbackInputY =
      pos.y + (NODE_HEIGHT * getInputPortOffsetPercent(fallbackInputCount, inputIndex)) / 100;

    return {
      x: side === "right" ? pos.x + NODE_WIDTH : pos.x,
      y: side === "right" ? pos.y + NODE_HEIGHT / 2 : fallbackInputY,
    };
  };

  const makePath = (x1: number, y1: number, x2: number, y2: number) => {
    const dx = Math.abs(x2 - x1) * 0.5;
    return `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <svg
      className="pointer-events-none absolute"
      style={{
        left: -5000,
        top: -5000,
        width: 10000,
        height: 10000,
        overflow: "visible",
      }}
    >
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="7"
          refX="10"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="#94a3b8" />
        </marker>
      </defs>

      {/* Existing edges */}
      {edges.map((edge) => {
        const from = getNodeAnchor(edge.fromNodeId, "right");
        const to = getNodeAnchor(edge.toNodeId, "left", edge.toInputIndex);
        return (
          <g key={edge.id}>
            <path
              d={makePath(from.x + 5000, from.y + 5000, to.x + 5000, to.y + 5000)}
              stroke="#94a3b8"
              strokeWidth={2}
              fill="none"
              markerEnd="url(#arrowhead)"
            />
          </g>
        );
      })}

      {/* Active connection being drawn */}
      {connectingFrom && nodePositions[connectingFrom] && (
        <path
          d={makePath(
            getNodeAnchor(connectingFrom, "right").x + 5000,
            getNodeAnchor(connectingFrom, "right").y + 5000,
            (connectingMouse.x - pan.x) / zoom + 5000,
            (connectingMouse.y - pan.y) / zoom + 5000
          )}
          stroke="#6366f1"
          strokeWidth={2}
          strokeDasharray="6,3"
          fill="none"
        />
      )}
    </svg>
  );
}
