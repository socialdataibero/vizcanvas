import { useSyncExternalStore, useCallback, useEffect, useRef } from "react";

type SetState<T> = {
  (partial: Partial<T> | ((state: T) => Partial<T>)): void;
};
type GetState<T> = () => T;
type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: () => void) => () => void;
};

export function createStore<T extends object>(
  initializer: (set: SetState<T>, get: GetState<T>) => T
): StoreApi<T> {
  let state: T;
  const listeners = new Set<() => void>();

  const getState: GetState<T> = () => state;

  const setState: SetState<T> = (partial) => {
    const nextPartial =
      typeof partial === "function"
        ? (partial as (s: T) => Partial<T>)(state)
        : partial;
    const nextState = Object.assign({}, state, nextPartial);
    if (!Object.is(state, nextState)) {
      state = nextState;
      listeners.forEach((l) => l());
    }
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  state = initializer(setState, getState);

  return { getState, setState, subscribe };
}

export function useStore<T extends object, S>(
  store: StoreApi<T>,
  selector: (state: T) => S
): S {
  const selectorRef = useRef(selector);
  const resultRef = useRef<S | undefined>(undefined);
  const stateRef = useRef<T | undefined>(undefined);

  useEffect(() => {
    selectorRef.current = selector;
  }, [selector]);

  const getSnapshot = useCallback(() => {
    const currentState = store.getState();
    // If state hasn't changed, return cached result
    if (stateRef.current === currentState && resultRef.current !== undefined) {
      return resultRef.current;
    }
    const nextResult = selectorRef.current(currentState);
    stateRef.current = currentState;
    resultRef.current = nextResult;
    return nextResult;
  }, [store]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getSnapshot);
}
