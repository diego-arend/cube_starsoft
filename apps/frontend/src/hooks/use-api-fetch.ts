"use client";

import { useEffect } from "react";
import { useLoadingStore } from "../stores/loading-store";
import { setApiFetchHooks } from "../lib/api-fetch";

/**
 * Hook to initialize apiFetch with the loading store.
 * Should be called once in a top-level client component (e.g., a provider).
 */
export function useInitializeApiFetch() {
  const { start, finish } = useLoadingStore();

  useEffect(() => {
    setApiFetchHooks({
      onStart: () => start(),
      onEnd: () => finish(),
    });
  }, [start, finish]);
}
