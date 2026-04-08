"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { UserPublicDto } from "@turborepo/database/client";
import { apiFetch } from "@/lib/api-fetch";
import {
  DataTable,
  toast,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Button,
  Input,
} from "@turborepo/ui";
import { getColumns } from "./columns";
import { CreateUserDialog } from "./create-user-dialog";

export function UsersTable() {
  const { data: session } = useSession();
  const [data, setData] = useState<UserPublicDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<UserPublicDto | null>(null);

  useEffect(() => {
    if (search === debouncedSearch) return;

    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const fetchUsers = useCallback(async () => {
    if (!session?.accessToken) return;

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (debouncedSearch) {
        queryParams.append("q", debouncedSearch);
      }

      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users?${queryParams.toString()}`,
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
          description: "Falha ao carregar usuários.",
        });
      }
    } catch {
      toast.error("Erro", {
        description: "Erro de conexão.",
      });
    }
  }, [session?.accessToken, page, limit, debouncedSearch]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEditAction = (user: UserPublicDto) => {
    toast.info("Em breve", {
      description: `Editar usuário ${user.email}`,
    });
  };

  const handleDeleteAction = (user: UserPublicDto) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!session?.accessToken || !userToDelete) return;

    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/users/${userToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error("Falha ao excluir");

      toast.success("Sucesso", {
        description: "Usuário excluído.",
      });
      fetchUsers();
    } catch {
      toast.error("Erro", {
        description: "Não foi possível excluir o usuário.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };

  const columns = getColumns({
    onEditAction: handleEditAction,
    onDeleteAction: handleDeleteAction,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Filtrar usuários..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-sm"
        />
        <CreateUserDialog onSuccess={fetchUsers} />
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

      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o usuário &quot;
              {userToDelete?.email}&quot;? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
