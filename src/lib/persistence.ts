import { DAGNode, DAGEdge } from "@/engine/types";
import { CanvasFrame, CanvasPage, VersionSnapshot } from "@/types/canvas";
import { ColumnInfo } from "@/types/nodes";

export const STORAGE_KEY = "vizcanvas-state";
export const SNAPSHOTS_STORAGE_KEY = "vizcanvas-snapshots";
export const UPLOADED_TABLES_STORAGE_KEY = "vizcanvas-uploaded-tables";
const STORAGE_VERSION = 1;
export const VIZCANVAS_FILE_EXTENSION = ".vzc";
const VIZCANVAS_FORMAT = "vizcanvas";
const VIZCANVAS_VERSION = 1;

export interface PersistedAppState {
  version: number;
  savedAt: string;
  nodePositions: Record<string, { x: number; y: number }>;
  nodeSizes?: Record<string, { width: number; height: number }>;
  frames?: CanvasFrame[];
  canvas: {
    id: string;
    title: string;
    pages: CanvasPage[];
    currentPageId: string;
    focusMode: boolean;
  };
  dag: {
    nodes: Record<string, DAGNode>;
    edges: DAGEdge[];
  };
}

export interface VizCanvasExportedTable {
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  rows: Record<string, unknown>[];
  fileSize?: number;
  fileType?: string;
}

export interface VizCanvasFile {
  format: typeof VIZCANVAS_FORMAT;
  version: number;
  exportedAt: string;
  appState: PersistedAppState;
  data: {
    tables: VizCanvasExportedTable[];
  };
}

function normalizeFrames(frames: CanvasFrame[] | undefined): CanvasFrame[] {
  return (frames ?? []).map((frame) => ({
    ...frame,
    nodeIds: Array.isArray(frame.nodeIds) ? frame.nodeIds : [],
  }));
}

function normalizePersistedAppState(parsed: unknown): PersistedAppState | null {
  if (!parsed || typeof parsed !== "object") return null;

  const version = typeof (parsed as { version?: unknown }).version === "number"
    ? (parsed as { version: number }).version
    : 0;

  // Version 0 or missing: try to use as-is if it has the expected shape
  if (version === 0 || version === undefined) {
    if ((parsed as Partial<PersistedAppState>).canvas && (parsed as Partial<PersistedAppState>).dag && (parsed as Partial<PersistedAppState>).nodePositions) {
      return {
        ...(parsed as PersistedAppState),
        version: STORAGE_VERSION,
        frames: normalizeFrames((parsed as PersistedAppState).frames),
      };
    }
    return null;
  }

  // Current version
  if (version === STORAGE_VERSION) {
    return {
      ...(parsed as PersistedAppState),
      frames: normalizeFrames((parsed as PersistedAppState).frames),
    };
  }

  // Future versions: attempt to load rather than discarding
  console.warn(`[Persistence] Unknown version ${version}, attempting to load`);
  return {
    ...(parsed as PersistedAppState),
    frames: normalizeFrames((parsed as PersistedAppState).frames),
  };
}

export function readPersistedAppState(): PersistedAppState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return parsePersistedAppState(raw);
  } catch {
    return null;
  }
}

export function writePersistedAppState(state: PersistedAppState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.warn("[Persistence] Failed to save app state:", err);
  }
}

export function parsePersistedAppState(raw: string): PersistedAppState | null {
  try {
    const parsed = JSON.parse(raw);
    return normalizePersistedAppState(parsed);
  } catch {
    return null;
  }
}

export function readPersistedSnapshots(): VersionSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SNAPSHOTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((snapshot): snapshot is VersionSnapshot => (
      Boolean(snapshot) &&
      typeof snapshot === "object" &&
      typeof snapshot.id === "string" &&
      typeof snapshot.timestamp === "string" &&
      typeof snapshot.data === "string"
    ));
  } catch {
    return [];
  }
}

export function writePersistedSnapshots(snapshots: VersionSnapshot[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(snapshots));
  } catch (err) {
    console.warn("[Persistence] Failed to save snapshots:", err);
  }
}

export function readPersistedUploadedTables(): VizCanvasExportedTable[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(UPLOADED_TABLES_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((table): table is VizCanvasExportedTable => (
      Boolean(table) &&
      typeof table === "object" &&
      typeof table.name === "string" &&
      Array.isArray(table.columns) &&
      Array.isArray(table.rows) &&
      typeof table.rowCount === "number"
    ));
  } catch {
    return [];
  }
}

export function writePersistedUploadedTables(tables: VizCanvasExportedTable[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(UPLOADED_TABLES_STORAGE_KEY, JSON.stringify(tables));
  } catch (err) {
    console.warn("[Persistence] Failed to save uploaded tables:", err);
  }
}

export function buildPersistedAppState(input: Omit<PersistedAppState, "version" | "savedAt">): PersistedAppState {
  return {
    version: STORAGE_VERSION,
    savedAt: new Date().toISOString(),
    ...input,
    frames: normalizeFrames(input.frames),
  };
}

export function clonePersistedAppState(state: PersistedAppState): PersistedAppState {
  return JSON.parse(JSON.stringify(state)) as PersistedAppState;
}

export function buildSafeVizCanvasTitle(title: string): string {
  return title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "") || "untitled-canvas";
}

export function buildVizCanvasFile(
  appState: PersistedAppState,
  tables: VizCanvasExportedTable[]
): VizCanvasFile {
  return {
    format: VIZCANVAS_FORMAT,
    version: VIZCANVAS_VERSION,
    exportedAt: new Date().toISOString(),
    appState,
    data: {
      tables,
    },
  };
}

export function parseVizCanvasFile(raw: string): VizCanvasFile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<VizCanvasFile & PersistedAppState>;

    if (parsed?.format === VIZCANVAS_FORMAT && parsed.appState) {
      const tables = Array.isArray(parsed.data?.tables) ? parsed.data.tables : [];
      return {
        format: VIZCANVAS_FORMAT,
        version: typeof parsed.version === "number" ? parsed.version : VIZCANVAS_VERSION,
        exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
        appState: {
          ...parsed.appState,
          frames: normalizeFrames(parsed.appState.frames),
        },
        data: {
          tables,
        },
      };
    }

    if (parsed && typeof parsed.version === "number" && parsed.canvas && parsed.dag) {
        return {
          format: VIZCANVAS_FORMAT,
          version: VIZCANVAS_VERSION,
          exportedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : new Date().toISOString(),
        appState: {
          ...(parsed as PersistedAppState),
          frames: normalizeFrames((parsed as PersistedAppState).frames),
        },
          data: {
            tables: [],
          },
      };
    }

    return null;
  } catch {
    return null;
  }
}
