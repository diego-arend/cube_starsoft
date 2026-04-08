import { Metadata } from "next";
import { EmbeddingsTable } from "./embeddings-table";
import { Database } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Embeddings",
  description: "Visualização de fragmentos e vetores.",
};

export default async function EmbeddingsPage() {
  const session = await auth();

  if (session?.user?.role !== "ADMIN") {
    redirect("/assistant");
  }

  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <div className="flex items-center gap-2">
          <Database className="h-6 w-6 text-primary" />
          <h2 className="text-3xl font-bold tracking-tight">
            Kbase Embeddings
          </h2>
        </div>
      </div>
      <div className="rounded-xl border bg-card text-card-foreground shadow p-3 md:p-6">
        <div className="mb-4">
          <h3 className="text-lg font-medium">Dashboard de Conhecimento</h3>
          <p className="text-sm text-muted-foreground">
            Gerencie e visualize como seus documentos são fragmentados e
            convertidos em vetores para o assistente.
          </p>
        </div>
        <EmbeddingsTable />
      </div>
    </div>
  );
}
