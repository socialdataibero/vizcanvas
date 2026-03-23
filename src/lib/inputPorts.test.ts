import { describe, expect, it } from "vitest";
import { resolveTargetInputIndex } from "@/lib/inputPorts";

describe("resolveTargetInputIndex", () => {
  it("assigns the second connection to the second join input", () => {
    expect(
      resolveTargetInputIndex({
        targetNodeId: "join-1",
        targetNodeType: "join",
        edges: [
          { id: "e1", fromNodeId: "a", toNodeId: "join-1", toInputIndex: 0 },
        ],
      })
    ).toBe(1);
  });

  it("uses the explicit port index when dropping over a join port", () => {
    expect(
      resolveTargetInputIndex({
        targetNodeId: "join-1",
        targetNodeType: "join",
        edges: [],
        explicitInputIndex: 1,
      })
    ).toBe(1);
  });

  it("falls back to the closest input when both join inputs are occupied", () => {
    expect(
      resolveTargetInputIndex({
        targetNodeId: "join-1",
        targetNodeType: "join",
        edges: [
          { id: "e1", fromNodeId: "a", toNodeId: "join-1", toInputIndex: 0 },
          { id: "e2", fromNodeId: "b", toNodeId: "join-1", toInputIndex: 1 },
        ],
        dropClientY: 180,
        targetRect: {
          top: 100,
          height: 120,
        } as DOMRect,
      })
    ).toBe(1);
  });
});
