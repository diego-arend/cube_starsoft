import { Metadata } from "next";
import { UsersTable } from "./users-table";

export const metadata: Metadata = {
  title: "Gestão de Usuários",
  description: "Administração de usuários do sistema.",
};

export default function AdminUsersPage() {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">
          Gestão de Usuários
        </h2>
      </div>
      <div className="rounded-xl border bg-card text-card-foreground shadow p-3 md:p-6">
        <UsersTable />
      </div>
    </div>
  );
}
