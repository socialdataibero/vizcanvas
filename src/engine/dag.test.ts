import { describe, expect, it, vi } from "vitest";
import { getDownstreamNodes, getUpstreamNodes, topologicalSortRecord } from "@/engine/dag";
import type { DAGEdge, DAGNode } from "@/engine/types";

function createNode(id: string): DAGNode {
  return {
    id,
    type: "chart",
    config: {},
    inputIds: [],
    result: null,
    status: "idle",
    pageId: "page-1",
  };
}

describe("topologicalSortRecord", () => {
  it("orders nodes from upstream to downstream", () => {
    const nodes = {
      source: createNode("source"),
      group: createNode("group"),
      chart: createNode("chart"),
    };

    const edges: DAGEdge[] = [
      { id: "e1", fromNodeId: "source", toNodeId: "group", toInputIndex: 0 },
      { id: "e2", fromNodeId: "group", toNodeId: "chart", toInputIndex: 0 },
    ];

    expect(topologicalSortRecord(nodes, edges)).toEqual(["source", "group", "chart"]);
  });

  it("warns and still returns all nodes when a cycle exists", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const nodes = {
      a: createNode("a"),
      b: createNode("b"),
      c: createNode("c"),
    };

    const edges: DAGEdge[] = [
      { id: "e1", fromNodeId: "a", toNodeId: "b", toInputIndex: 0 },
      { id: "e2", fromNodeId: "b", toNodeId: "c", toInputIndex: 0 },
      { id: "e3", fromNodeId: "c", toNodeId: "a", toInputIndex: 0 },
    ];

    const result = topologicalSortRecord(nodes, edges);

    expect(result).toHaveLength(3);
    expect(new Set(result)).toEqual(new Set(["a", "b", "c"]));
    expect(warnSpy).toHaveBeenCalledOnce();
  });
});

describe("DAG traversal helpers", () => {
  it("collects all transitive downstream nodes", () => {
    const edges: DAGEdge[] = [
      { id: "e1", fromNodeId: "source", toNodeId: "group", toInputIndex: 0 },
      { id: "e2", fromNodeId: "group", toNodeId: "chart", toInputIndex: 0 },
      { id: "e3", fromNodeId: "source", toNodeId: "table", toInputIndex: 0 },
    ];

    expect(getDownstreamNodes("source", edges)).toEqual(
      new Set(["group", "chart", "table"])
    );
  });

  it("returns upstream nodes sorted by input index", () => {
    const edges: DAGEdge[] = [
      { id: "e1", fromNodeId: "right", toNodeId: "join", toInputIndex: 1 },
      { id: "e2", fromNodeId: "left", toNodeId: "join", toInputIndex: 0 },
    ];

    expect(getUpstreamNodes("join", edges)).toEqual(["left", "right"]);
  });
});
