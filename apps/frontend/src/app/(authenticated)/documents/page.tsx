import { Metadata } from "next";
import { DocumentsTable } from "./documents-table";

export const metadata: Metadata = {
  title: "Documentos",
  description: "Gestão de documentos.",
};

export default function DocumentsPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Documentos</h2>
      </div>
      <div className="rounded-xl border bg-card text-card-foreground shadow p-3 md:p-6">
        <DocumentsTable />
      </div>
    </div>
  );
}
