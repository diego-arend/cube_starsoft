"use client";

import React from "react";
import { useLoadingStore } from "../stores/loading-store";
import { useInitializeApiFetch } from "../hooks/use-api-fetch";
import { GlobalLoader } from "./ui/loading-spinner";

export function LoadingProvider({ children }: { children: React.ReactNode }) {
  // Initialize the isomorphic fetch wrapper with the store hooks
  useInitializeApiFetch();

  const isLoading = useLoadingStore((state) => state.isLoading);

  return (
    <>
      {children}
      {isLoading && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="rounded-lg bg-background p-4 shadow-lg">
            <GlobalLoader size={32} />
          </div>
        </div>
      )}
    </>
  );
}
