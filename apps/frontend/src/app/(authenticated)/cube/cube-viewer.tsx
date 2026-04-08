"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@turborepo/ui";
import {
  SceneController,
  type SceneStats,
} from "@/components/cube/scene-controller";

export function CubeViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const [stats, setStats] = useState<SceneStats>({
    mode: "solid",
    activeFace: "+Z",
    fps: 0,
    hint: "Duplo clique em uma face para selecionar",
  });

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctrl = new SceneController(canvas);
    controllerRef.current = ctrl;

    ctrl.onStats(setStats);
    ctrl.startLoop();

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      ctrl.resize(width, height);
    });
    observer.observe(container);

    return () => {
      observer.disconnect();
      ctrl.dispose();
      controllerRef.current = null;
    };
  }, []);

  const modeBadgeColor: Record<string, string> = {
    solid: "bg-blue-600",
    face: "bg-amber-500",
    detail: "bg-emerald-600",
  };

  const modeLabel: Record<string, string> = {
    solid: "Cubo",
    face: "Face",
    detail: "Detalhe",
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#1a1a2e]">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Top-left HUD */}
      <div className="absolute top-4 left-4 flex flex-col gap-2 pointer-events-none">
        <div
          className={cn(
            "px-3 py-1 rounded-full text-xs font-semibold text-white shadow",
            modeBadgeColor[stats.mode] ?? "bg-gray-600"
          )}
        >
          {modeLabel[stats.mode] ?? stats.mode}
        </div>
        {stats.mode !== "solid" && (
          <div className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow bg-gray-800/80">
            Face: {stats.activeFace}
          </div>
        )}
        <div className="px-3 py-1 rounded-full text-xs font-semibold text-white shadow bg-gray-800/80">
          {stats.fps} fps
        </div>
      </div>

      {/* Bottom center hint */}
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/50 text-white/70 text-xs pointer-events-none text-center whitespace-nowrap">
        {stats.hint}
      </div>
    </div>
  );
}
