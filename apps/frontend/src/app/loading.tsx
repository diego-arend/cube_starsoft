import React from "react";
import { GlobalLoader } from "../components/ui/loading-spinner";

export default function Loading() {
  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="rounded-lg bg-background p-4 shadow-lg">
        <GlobalLoader size={32} />
      </div>
    </div>
  );
}
