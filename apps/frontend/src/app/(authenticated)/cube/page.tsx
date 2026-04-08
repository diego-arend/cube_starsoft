import type { Metadata } from "next";
import { CubeViewerLoader } from "./cube-viewer-loader";

export const metadata: Metadata = {
  title: "Cube",
  description:
    "Visualizador tridimensional de cubo com detalhamento progressivo.",
};

export default function CubePage() {
  return (
    <div className="-mx-4 -mt-6 md:-mx-8 md:-mt-8 h-[calc(100dvh-64px)] flex flex-col overflow-hidden">
      <CubeViewerLoader />
    </div>
  );
}
