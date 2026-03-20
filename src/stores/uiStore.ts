import { createStore, useStore } from "@/lib/createStore";

export type ActiveTool =
  | "select"
  | "hand";

interface UIState {
  dataPanelOpen: boolean;
  stylePanelOpen: boolean;
  aiPanelOpen: boolean;
  activeTool: ActiveTool;
  selectedNodeId: string | null;
  shortcutsModalOpen: boolean;

  toggleDataPanel: () => void;
  toggleStylePanel: () => void;
  toggleAIPanel: () => void;
  setActiveTool: (tool: ActiveTool) => void;
  setSelectedNode: (nodeId: string | null) => void;
  toggleShortcutsModal: () => void;
}

const uiStore = createStore<UIState>((set) => ({
  dataPanelOpen: true,
  stylePanelOpen: false,
  aiPanelOpen: false,
  activeTool: "select",
  selectedNodeId: null,
  shortcutsModalOpen: false,

  toggleDataPanel: () =>
    set((state) => ({ dataPanelOpen: !state.dataPanelOpen })),
  toggleStylePanel: () =>
    set((state) => ({ stylePanelOpen: !state.stylePanelOpen })),
  toggleAIPanel: () =>
    set((state) => ({ aiPanelOpen: !state.aiPanelOpen })),
  setActiveTool: (tool) => set({ activeTool: tool }),
  setSelectedNode: (nodeId) => set({ selectedNodeId: nodeId }),
  toggleShortcutsModal: () =>
    set((state) => ({ shortcutsModalOpen: !state.shortcutsModalOpen })),
}));

export function useUIStore<S>(selector: (state: UIState) => S): S {
  return useStore(uiStore, selector);
}
