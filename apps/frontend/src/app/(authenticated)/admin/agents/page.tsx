import { Metadata } from "next";
import { AgentsTable } from "./agents-table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@turborepo/ui";

export const metadata: Metadata = {
  title: "Gestão de Agentes de IA | Crew Agents",
  description: "Gerencie os agentes de IA, suas especialidades e guard rails.",
};

export default function AgentsPage() {
  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Agentes de IA</h2>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Configuração de Agentes</CardTitle>
          <CardDescription>
            Crie e gerencie os perfis dos agentes de IA para diferentes setores
            da empresa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AgentsTable />
        </CardContent>
      </Card>
    </div>
  );
}
