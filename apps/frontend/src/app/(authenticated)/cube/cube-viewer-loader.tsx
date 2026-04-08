"use client";

import dynamic from "next/dynamic";

const CubeViewer = dynamic(
  () => import("./cube-viewer").then((mod) => ({ default: mod.CubeViewer })),
  { ssr: false }
);

export function CubeViewerLoader() {
  return <CubeViewer />;
}
