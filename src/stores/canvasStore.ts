import { createStore, useStore } from "@/lib/createStore";
import { v4 as uuidv4 } from "uuid";
import { CanvasPage, VersionSnapshot } from "@/types/canvas";
import { readPersistedSnapshots, writePersistedSnapshots } from "@/lib/persistence";

interface CanvasState {
  id: string;
  title: string;
  pages: CanvasPage[];
  currentPageId: string;
  focusMode: boolean;
  snapshots: VersionSnapshot[];

  setTitle: (title: string) => void;
  toggleFocusMode: () => void;
  addPage: (name?: string) => string;
  renamePage: (pageId: string, name: string) => void;
  setCurrentPage: (pageId: string) => void;
  reorderPages: (pages: CanvasPage[]) => void;
  saveSnapshot: (data: string, label?: string) => void;
}

const defaultPageId = uuidv4();

const canvasStore = createStore<CanvasState>((set) => ({
  id: uuidv4(),
  title: "Untitled Canvas",
  pages: [{ id: defaultPageId, name: "Page 1", order: 0 }],
  currentPageId: defaultPageId,
  focusMode: false,
  snapshots: readPersistedSnapshots(),

  setTitle: (title) => set({ title }),

  toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),

  addPage: (name) => {
    const id = uuidv4();
    set((state) => ({
      pages: [
        ...state.pages,
        { id, name: name || `Page ${state.pages.length + 1}`, order: state.pages.length },
      ],
      currentPageId: id,
    }));
    return id;
  },

  renamePage: (pageId, name) => {
    set((state) => ({
      pages: state.pages.map((p) =>
        p.id === pageId ? { ...p, name } : p
      ),
    }));
  },

  setCurrentPage: (pageId) => set({ currentPageId: pageId }),

  reorderPages: (pages) => set({ pages }),

  saveSnapshot: (data, label) => {
    const snapshot: VersionSnapshot = {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      label,
      data,
    };
    set((s) => {
      const snapshots = [...s.snapshots, snapshot].slice(-20);
      writePersistedSnapshots(snapshots);
      return { snapshots };
    });
  },
}));

export function useCanvasStore<S>(selector: (state: CanvasState) => S): S {
  return useStore(canvasStore, selector);
}

export const canvasStoreApi = canvasStore;
