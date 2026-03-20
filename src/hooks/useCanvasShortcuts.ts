import { useEffect, type RefObject } from "react";
import { NodeType } from "@/types/nodes";

interface UseCanvasShortcutsParams {
  canvasRef: RefObject<HTMLDivElement | null>;
  presentationMode: boolean;
  pan: { x: number; y: number };
  zoom: number;
  selectedFrameId: string | null;
  getSelectionScope: (nodeId?: string) => string[];
  handleCopySelection: (nodeIds: string[]) => Promise<void>;
  handleDuplicateSelection: (nodeIds: string[]) => void;
  handlePasteSelection: () => void;
  handleDeleteNodes: (nodeIds: string[]) => void;
  onDeleteFrame: (frameId: string) => void;
  setSelectedFrameId: (frameId: string | null) => void;
  onAddNode: (type: NodeType, position?: { x: number; y: number }) => string;
  closeMenus: () => void;
  setActiveTool: (tool: "select" | "hand") => void;
  isEditingTarget: (target: HTMLElement | null) => boolean;
  setSpacePressed: (value: boolean) => void;
  setZoom: (value: number) => void;
  setPan: (value: { x: number; y: number }) => void;
  undoCanvas: () => void;
  redoCanvas: () => void;
  toggleFocusMode: () => void;
  toggleShortcutsModal: () => void;
  nodeShortcuts: Partial<Record<string, NodeType>>;
}

export function useCanvasShortcuts({
  canvasRef,
  presentationMode,
  pan,
  zoom,
  selectedFrameId,
  getSelectionScope,
  handleCopySelection,
  handleDuplicateSelection,
  handlePasteSelection,
  handleDeleteNodes,
  onDeleteFrame,
  setSelectedFrameId,
  onAddNode,
  closeMenus,
  setActiveTool,
  isEditingTarget,
  setSpacePressed,
  setZoom,
  setPan,
  undoCanvas,
  redoCanvas,
  toggleFocusMode,
  toggleShortcutsModal,
  nodeShortcuts,
}: UseCanvasShortcutsParams) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = isEditingTarget(target);

      if (e.code === "Space" && !isEditing) {
        e.preventDefault();
        setSpacePressed(true);
        return;
      }

      if (e.key === "Escape") {
        closeMenus();
        return;
      }

      if (presentationMode) {
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ".") {
        e.preventDefault();
        toggleFocusMode();
        return;
      }

      if (e.key === "?" && e.shiftKey) {
        e.preventDefault();
        toggleShortcutsModal();
        return;
      }

      if ((e.metaKey || e.ctrlKey) && !e.altKey) {
        const normalizedKey = e.key.toLowerCase();
        if (normalizedKey === "z" && !isEditing) {
          e.preventDefault();
          if (e.shiftKey) {
            redoCanvas();
          } else {
            undoCanvas();
          }
          return;
        }

        if (normalizedKey === "y" && !isEditing) {
          e.preventDefault();
          redoCanvas();
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        const scope = getSelectionScope();
        if (scope.length > 0 && !isEditing) {
          e.preventDefault();
          handleDeleteNodes(scope);
        } else if (selectedFrameId && !isEditing) {
          e.preventDefault();
          onDeleteFrame(selectedFrameId);
          setSelectedFrameId(null);
        }
      }

      if (!isEditing && (e.metaKey || e.ctrlKey) && !e.altKey) {
        const key = e.key.toLowerCase();
        const scope = getSelectionScope();

        if (key === "c" && scope.length > 0) {
          e.preventDefault();
          void handleCopySelection(scope);
          return;
        }

        if (key === "d" && scope.length > 0) {
          e.preventDefault();
          handleDuplicateSelection(scope);
          return;
        }

        if (key === "v") {
          e.preventDefault();
          handlePasteSelection();
          return;
        }
      }

      if (e.shiftKey && e.code === "Digit0") {
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }

      if (!isEditing && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const key = e.key.toLowerCase();
        if (key === "v") {
          e.preventDefault();
          setActiveTool("select");
          return;
        }

        if (key === "h") {
          e.preventDefault();
          setActiveTool("hand");
          return;
        }

        const nodeType = nodeShortcuts[key];
        if (nodeType) {
          e.preventDefault();
          const rect = canvasRef.current?.getBoundingClientRect();
          const centerX = rect ? (rect.width / 2 - pan.x) / zoom : 400;
          const centerY = rect ? (rect.height / 2 - pan.y) / zoom : 300;
          onAddNode(nodeType, { x: centerX - 160, y: centerY - 100 });
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };

    const handleWindowBlur = () => {
      setSpacePressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, [
    canvasRef,
    closeMenus,
    getSelectionScope,
    handleCopySelection,
    handleDeleteNodes,
    handleDuplicateSelection,
    handlePasteSelection,
    isEditingTarget,
    nodeShortcuts,
    onAddNode,
    onDeleteFrame,
    pan,
    presentationMode,
    redoCanvas,
    selectedFrameId,
    setActiveTool,
    setPan,
    setSelectedFrameId,
    setSpacePressed,
    setZoom,
    toggleFocusMode,
    toggleShortcutsModal,
    undoCanvas,
    zoom,
  ]);
}
