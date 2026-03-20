"use client";

import { useEffect, useRef } from "react";
import { PersistedAppState, writePersistedAppState } from "@/lib/persistence";

const SAVE_DEBOUNCE_MS = 2000;

export function useAutoSave(state: PersistedAppState | null) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!state) return;
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      writePersistedAppState(state);
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [state]);
}
