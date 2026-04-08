"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DocumentPublicDto } from "@turborepo/database";
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
import { UploadButton } from "./upload-button";

export function DocumentsTable() {
  const { data: session } = useSession();
  const [data, setData] = useState<DocumentPublicDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentPublicDto | null>(null);

  useEffect(() => {
    if (search === debouncedSearch) return;

    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [search, debouncedSearch]);

  const fetchDocuments = useCallback(async () => {
    if (!session?.user?.id || !session?.accessToken) return;

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        isKb: "false",
      });
      if (debouncedSearch) {
        queryParams.append("q", debouncedSearch);
      }

      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/list_by_user/${session.user.id}?${queryParams.toString()}`,
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
          description: "Falha ao carregar documentos.",
        });
      }
    } catch {
      toast.error("Erro", {
        description: "Erro de conexão.",
      });
    }
  }, [session?.user?.id, session?.accessToken, page, limit, debouncedSearch]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleDownload = async (doc: DocumentPublicDto) => {
    if (!session?.accessToken) return;

    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${doc.id}/download`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error("Falha no download");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.originalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch {
      toast.error("Erro", {
        description: "Não foi possível baixar o documento.",
      });
    }
  };

  const handleDeleteAction = (doc: DocumentPublicDto) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!session?.accessToken || !documentToDelete) return;

    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${documentToDelete.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (!response.ok) throw new Error("Falha ao excluir");

      toast.success("Sucesso", {
        description: "Documento excluído.",
      });
      fetchDocuments();
    } catch {
      toast.error("Erro", {
        description: "Não foi possível excluir o documento.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const columns = getColumns({
    onDownloadAction: handleDownload,
    onDeleteAction: handleDeleteAction,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Input
          placeholder="Filtrar documentos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full md:max-w-sm"
        />
        <UploadButton
          onUploadSuccess={() => {
            if (page === 1) {
              fetchDocuments();
            } else {
              setPage(1);
            }
          }}
        />
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
              Tem certeza que deseja excluir o documento &quot;
              {documentToDelete?.originalFilename}&quot;? Esta ação não pode ser
              desfeita.
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
