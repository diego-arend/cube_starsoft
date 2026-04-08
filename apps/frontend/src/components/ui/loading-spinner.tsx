"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@turborepo/ui";

interface GlobalLoaderProps {
  className?: string;
  size?: number;
}

export function GlobalLoader({ className, size = 32 }: GlobalLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex items-center justify-center", className)}
    >
      <Loader2 className="animate-spin text-primary" size={size} />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
