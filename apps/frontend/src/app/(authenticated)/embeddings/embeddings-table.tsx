"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { DocumentPublicDto, AgentDto } from "@turborepo/database";
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
  Badge,
} from "@turborepo/ui";
import { getColumns } from "./columns";
import { FileText, Loader2 } from "lucide-react";
import { UploadButton } from "../documents/upload-button";

export function EmbeddingsTable() {
  const { data: session } = useSession();
  const [data, setData] = useState<DocumentPublicDto[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [agents, setAgents] = useState<AgentDto[]>([]);

  // Chunks Dialog
  const [chunksDialogOpen, setChunksDialogOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<DocumentPublicDto | null>(
    null
  );
  const [chunks, setChunks] = useState<{ id: string; content: string }[]>([]);
  const [chunksLoading, setChunksLoading] = useState(false);

  // Delete Dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] =
    useState<DocumentPublicDto | null>(null);

  const fetchAgents = useCallback(async () => {
    if (!session?.accessToken) return;
    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/agents`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );
      if (response.ok) {
        const result = await response.json();
        setAgents(result.data);
      }
    } catch {
      console.error("Failed to fetch agents");
    }
  }, [session?.accessToken]);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

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
        isKb: "true",
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
      }
    } catch {
      toast.error("Erro", { description: "Falha ao carregar documentos." });
    }
  }, [session?.user?.id, session?.accessToken, page, limit, debouncedSearch]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const fetchChunks = async (doc: DocumentPublicDto) => {
    if (!session?.accessToken) return;

    setSelectedDoc(doc);
    setChunksDialogOpen(true);
    setChunksLoading(true);
    setChunks([]);

    try {
      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/${doc.id}/chunks`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        setChunks(result);
      } else {
        toast.error("Erro", { description: "Falha ao carregar fragmentos." });
      }
    } catch {
      toast.error("Erro", { description: "Erro de conexão." });
    } finally {
      setChunksLoading(false);
    }
  };

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
    } catch {
      toast.error("Erro", { description: "Falha ao baixar arquivo." });
    }
  };

  const handleDelete = async () => {
    if (!documentToDelete || !session?.accessToken) return;

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

      if (response.ok) {
        toast.success("Sucesso", { description: "Documento excluído." });
        fetchDocuments();
      } else {
        toast.error("Erro", { description: "Falha ao excluir documento." });
      }
    } catch {
      toast.error("Erro", { description: "Erro de conexão." });
    } finally {
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const columns = getColumns(
    (doc) => fetchChunks(doc),
    handleDownload,
    (doc) => {
      setDocumentToDelete(doc);
      setDeleteDialogOpen(true);
    }
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-1 items-center gap-2 max-w-sm">
          <Input
            placeholder="Filtrar por nome, agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2">
          <UploadButton
            onUploadSuccess={fetchDocuments}
            isKb={true}
            agentId={null}
            initialAgents={agents}
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={data}
        pagination={{
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        }}
        onPageChange={(p) => setPage(p)}
      />

      {/* Chunks Dialog */}
      <Dialog open={chunksDialogOpen} onOpenChange={setChunksDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Fragmentos de Documento</DialogTitle>
            <DialogDescription>
              {selectedDoc?.originalFilename} - {chunks.length} fragmentos
              encontrados.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 mt-4 border rounded-md p-4 overflow-y-auto">
            {chunksLoading ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-2">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Carregando embeddings...
                </p>
              </div>
            ) : chunks.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Nenhum fragmento encontrado para este documento.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {chunks.map((chunk, idx) => (
                  <div key={chunk.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary">Fragmento #{idx + 1}</Badge>
                      <span className="text-xs text-muted-foreground italic">
                        ID: {chunk.id.substring(0, 8)}...
                      </span>
                    </div>
                    <p className="text-sm leading-relaxed bg-muted/50 p-3 rounded-md border">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setChunksDialogOpen(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Documento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o documento &quot;
              {documentToDelete?.originalFilename}&quot;? Isso também removerá
              todos os seus embeddings. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
