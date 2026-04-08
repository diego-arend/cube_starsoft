"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { AgentDto } from "@turborepo/database/client";
import { apiFetch } from "@/lib/api-fetch";
import { DataTable, toast, Input } from "@turborepo/ui";
import { getColumns } from "./columns";
import { CreateAgentDialog } from "./create-agent-dialog";
import { EditAgentDialog } from "./edit-agent-dialog";

export function AgentsTable() {
  const { data: session } = useSession();
  const [data, setData] = useState<AgentDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [agentToEdit, setAgentToEdit] = useState<AgentDto | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchAgents = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (debouncedSearch) queryParams.append("q", debouncedSearch);

      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agents?${queryParams.toString()}`,
        {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setData(result.data);
        setTotal(result.meta.total);
      } else {
        toast.error("Erro", {
          description: "Falha ao carregar agentes.",
        });
      }
    } catch {
      toast.error("Erro", {
        description: "Erro de conexão.",
      });
    }
  }, [session?.accessToken, page, limit, debouncedSearch]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  const handleEditAction = (agent: AgentDto) => {
    setAgentToEdit(agent);
    setEditDialogOpen(true);
  };

  const columns = getColumns({
    onEditAction: handleEditAction,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Filtrar agentes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-sm"
        />
        <CreateAgentDialog onSuccess={fetchAgents} />
      </div>

      <DataTable
        columns={columns}
        data={data}
        headerClassName="bg-muted/50"
        pagination={{
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }}
        onPageChange={setPage}
      />

      <EditAgentDialog
        agent={agentToEdit}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchAgents}
      />
    </div>
  );
}
