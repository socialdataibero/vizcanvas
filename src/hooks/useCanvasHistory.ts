"use client";

import { useCallback, useEffect, useRef } from "react";
import { clonePersistedAppState, PersistedAppState } from "@/lib/persistence";

const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_COMMIT_DELAY_MS = 180;

interface UseCanvasHistoryOptions {
  hydrated: boolean;
  buildHistoryState: () => PersistedAppState;
  applyHistoryState: (state: PersistedAppState) => void;
  onAfterRestore?: () => void | Promise<void>;
  limit?: number;
  commitDelayMs?: number;
}

export function useCanvasHistory({
  hydrated,
  buildHistoryState,
  applyHistoryState,
  onAfterRestore,
  limit = DEFAULT_HISTORY_LIMIT,
  commitDelayMs = DEFAULT_COMMIT_DELAY_MS,
}: UseCanvasHistoryOptions) {
  const historyEntriesRef = useRef<PersistedAppState[]>([]);
  const historyIndexRef = useRef(-1);
  const historyCommitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHistorySnapshotRef = useRef<PersistedAppState | null>(null);
  const isRestoringHistoryRef = useRef(false);
  const lastHistorySignatureRef = useRef<string | null>(null);

  const commitHistoryState = useCallback((snapshot?: PersistedAppState) => {
    const nextSnapshot = snapshot ?? buildHistoryState();
    const signature = JSON.stringify(nextSnapshot);
    if (signature === lastHistorySignatureRef.current) return;

    const nextHistory = historyEntriesRef.current
      .slice(0, historyIndexRef.current + 1)
      .concat([clonePersistedAppState(nextSnapshot)]);

    if (nextHistory.length > limit) {
      nextHistory.splice(0, nextHistory.length - limit);
    }

    historyEntriesRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    lastHistorySignatureRef.current = signature;
  }, [buildHistoryState, limit]);

  const restoreHistoryState = useCallback((entry: PersistedAppState, historyIndex: number) => {
    if (historyCommitTimerRef.current) {
      clearTimeout(historyCommitTimerRef.current);
      historyCommitTimerRef.current = null;
    }
    pendingHistorySnapshotRef.current = null;

    isRestoringHistoryRef.current = true;
    historyIndexRef.current = historyIndex;
    lastHistorySignatureRef.current = JSON.stringify(entry);
    applyHistoryState(entry);

    setTimeout(() => {
      void onAfterRestore?.();
    }, 0);
  }, [applyHistoryState, onAfterRestore]);

  const flushPendingHistoryCommit = useCallback(() => {
    if (!historyCommitTimerRef.current || !pendingHistorySnapshotRef.current) return;

    clearTimeout(historyCommitTimerRef.current);
    historyCommitTimerRef.current = null;
    commitHistoryState(pendingHistorySnapshotRef.current);
    pendingHistorySnapshotRef.current = null;
  }, [commitHistoryState]);

  const undoCanvas = useCallback(() => {
    flushPendingHistoryCommit();
    if (historyIndexRef.current <= 0) return;
    const nextIndex = historyIndexRef.current - 1;
    const entry = historyEntriesRef.current[nextIndex];
    if (!entry) return;
    restoreHistoryState(entry, nextIndex);
  }, [flushPendingHistoryCommit, restoreHistoryState]);

  const redoCanvas = useCallback(() => {
    flushPendingHistoryCommit();
    if (historyIndexRef.current >= historyEntriesRef.current.length - 1) return;
    const nextIndex = historyIndexRef.current + 1;
    const entry = historyEntriesRef.current[nextIndex];
    if (!entry) return;
    restoreHistoryState(entry, nextIndex);
  }, [flushPendingHistoryCommit, restoreHistoryState]);

  useEffect(() => {
    if (!hydrated) return;
    const snapshot = buildHistoryState();
    const signature = JSON.stringify(snapshot);

    if (isRestoringHistoryRef.current) {
      isRestoringHistoryRef.current = false;
      lastHistorySignatureRef.current = signature;
      return;
    }

    if (historyEntriesRef.current.length === 0) {
      historyEntriesRef.current = [clonePersistedAppState(snapshot)];
      historyIndexRef.current = 0;
      lastHistorySignatureRef.current = signature;
      return;
    }

    if (signature === lastHistorySignatureRef.current) return;

    if (historyCommitTimerRef.current) {
      clearTimeout(historyCommitTimerRef.current);
    }

    pendingHistorySnapshotRef.current = snapshot;
    historyCommitTimerRef.current = setTimeout(() => {
      commitHistoryState(snapshot);
      historyCommitTimerRef.current = null;
      pendingHistorySnapshotRef.current = null;
    }, commitDelayMs);

    return () => {
      if (historyCommitTimerRef.current) {
        clearTimeout(historyCommitTimerRef.current);
        historyCommitTimerRef.current = null;
      }
      pendingHistorySnapshotRef.current = null;
    };
  }, [buildHistoryState, commitDelayMs, commitHistoryState, hydrated]);

  return {
    undoCanvas,
    redoCanvas,
  };
}
