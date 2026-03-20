import { describe, expect, it, vi } from "vitest";
import {
  buildPersistedAppState,
  buildSafeVizCanvasTitle,
  buildVizCanvasFile,
  parsePersistedAppState,
  parseVizCanvasFile,
  readPersistedUploadedTables,
  writePersistedUploadedTables,
} from "@/lib/persistence";
import type { PersistedAppState, VizCanvasExportedTable } from "@/lib/persistence";

function createPersistedState(): PersistedAppState {
  return {
    version: 1,
    savedAt: "2025-01-01T00:00:00.000Z",
    nodePositions: {
      node1: { x: 10, y: 20 },
    },
    nodeSizes: {
      node1: { width: 320, height: 220 },
    },
    frames: [
      {
        id: "frame-1",
        pageId: "page-1",
        name: "Frame",
        x: 0,
        y: 0,
        width: 300,
        height: 200,
        nodeIds: ["node1"],
      },
    ],
    canvas: {
      id: "canvas-1",
      title: "VizCanvas",
      pages: [{ id: "page-1", name: "Page 1", order: 0 }],
      currentPageId: "page-1",
      focusMode: false,
    },
    dag: {
      nodes: {},
      edges: [],
    },
  };
}

describe("parsePersistedAppState", () => {
  it("normalizes legacy state without nodeIds on frames", () => {
    const legacy = JSON.stringify({
      nodePositions: { node1: { x: 10, y: 20 } },
      canvas: {
        id: "canvas-1",
        title: "Legacy",
        pages: [{ id: "page-1", name: "Page 1", order: 0 }],
        currentPageId: "page-1",
        focusMode: false,
      },
      dag: {
        nodes: {},
        edges: [],
      },
      frames: [
        {
          id: "frame-1",
          pageId: "page-1",
          name: "Frame",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
        },
      ],
    });

    expect(parsePersistedAppState(legacy)).toMatchObject({
      version: 1,
      frames: [
        {
          id: "frame-1",
          nodeIds: [],
        },
      ],
    });
  });
});

describe("buildPersistedAppState", () => {
  it("stamps the current time and normalizes frames", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-02-03T04:05:06.000Z"));

    const state = buildPersistedAppState({
      nodePositions: {},
      canvas: {
        id: "canvas-1",
        title: "New",
        pages: [{ id: "page-1", name: "Page 1", order: 0 }],
        currentPageId: "page-1",
        focusMode: false,
      },
      dag: {
        nodes: {},
        edges: [],
      },
      frames: [
        {
          id: "frame-1",
          pageId: "page-1",
          name: "Frame",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          nodeIds: ["node1"],
        },
      ],
    });

    expect(state.savedAt).toBe("2025-02-03T04:05:06.000Z");
    expect(state.version).toBe(1);
    expect(state.frames?.[0]?.nodeIds).toEqual(["node1"]);

    vi.useRealTimers();
  });
});

describe("vizcanvas file helpers", () => {
  it("sanitizes exported titles into safe filenames", () => {
    expect(buildSafeVizCanvasTitle("  Sales Dashboard 2025 / LATAM  ")).toBe(
      "sales-dashboard-2025-latam"
    );
  });

  it("round-trips the modern file format", () => {
    const appState = createPersistedState();
    const tables: VizCanvasExportedTable[] = [
      {
        name: "orders",
        columns: [{ name: "amount", type: "INTEGER", nullable: false }],
        rowCount: 1,
        rows: [{ amount: 10 }],
      },
    ];

    const parsed = parseVizCanvasFile(JSON.stringify(buildVizCanvasFile(appState, tables)));

    expect(parsed).toMatchObject({
      format: "vizcanvas",
      appState: {
        canvas: { title: "VizCanvas" },
      },
      data: {
        tables: [{ name: "orders", rowCount: 1 }],
      },
    });
  });
});

describe("uploaded tables persistence", () => {
  it("filters invalid rows when reading uploaded tables", () => {
    writePersistedUploadedTables([
      {
        name: "valid_table",
        columns: [{ name: "id", type: "INTEGER", nullable: false }],
        rowCount: 1,
        rows: [{ id: 1 }],
      },
    ]);

    localStorage.setItem(
      "vizcanvas-uploaded-tables",
      JSON.stringify([
        ...readPersistedUploadedTables(),
        { invalid: true },
      ])
    );

    expect(readPersistedUploadedTables()).toEqual([
      {
        name: "valid_table",
        columns: [{ name: "id", type: "INTEGER", nullable: false }],
        rowCount: 1,
        rows: [{ id: 1 }],
      },
    ]);
  });
});
