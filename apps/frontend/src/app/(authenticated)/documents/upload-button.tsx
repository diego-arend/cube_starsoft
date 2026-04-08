"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { AgentDto } from "@turborepo/database";
import { apiFetch } from "@/lib/api-fetch";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  toast,
  cn,
} from "@turborepo/ui";
import { Upload, Loader2, Info } from "lucide-react";

interface UploadButtonProps {
  onUploadSuccess: () => void;
  isKb?: boolean;
  agentId?: string | null;
  initialAgents?: AgentDto[];
}

export function UploadButton({
  onUploadSuccess,
  isKb = false,
  agentId = null,
  initialAgents = [],
}: UploadButtonProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<string>(agentId || "");
  const [agents, setAgents] = useState<AgentDto[]>(initialAgents);
  const { data: session } = useSession();

  // Sync with prop when it changes (e.g. from filter)
  useEffect(() => {
    setSelectedAgent(agentId || "");
  }, [agentId]);

  // Sync with initialAgents
  useEffect(() => {
    if (initialAgents.length > 0) {
      setAgents(initialAgents);
    }
  }, [initialAgents]);

  // Fetch agents if not provided and in KB mode
  useEffect(() => {
    const fetchAgents = async () => {
      if (!open || !isKb || agents.length > 0 || !session?.accessToken) return;
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
      } catch (err) {
        console.error("Failed to fetch agents in upload modal", err);
      }
    };
    fetchAgents();
  }, [open, isKb, agents.length, session?.accessToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];

      if (selectedFile.type !== "application/pdf") {
        toast.error("Apenas arquivos PDF são permitidos.");
        e.target.value = "";
        setFile(null);
        return;
      }

      if (selectedFile.size > 5 * 1024 * 1024) {
        toast.error("O arquivo deve ter no máximo 5MB.");
        e.target.value = "";
        setFile(null);
        return;
      }

      // Sanitize filename immediately upon selection
      const sanitizeFilename = (name: string) => {
        return name
          .replace(/\s+/g, "_") // Replace spaces with underscores
          .replace(/[^a-zA-Z0-9._-]/g, "") // Remove non-alphanumeric chars except . _ -
          .replace(/\.{2,}/g, "."); // Prevent directory traversal (..)
      };

      const sanitizedName = sanitizeFilename(selectedFile.name);

      // Create a new File object with the sanitized name
      const sanitizedFile = new File([selectedFile], sanitizedName, {
        type: selectedFile.type,
        lastModified: selectedFile.lastModified,
      });

      setFile(sanitizedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !session?.accessToken) return;

    setUploading(true);

    // Security check for empty name or suspicious patterns (already sanitized but good to keep check)
    if (!file.name || file.name.length > 255) {
      toast.error("Nome do arquivo inválido ou muito longo.");
      setUploading(false);
      return;
    }

    const formData = new FormData();
    formData.append("isKb", isKb ? "true" : "false");

    const finalAgentId =
      selectedAgent && selectedAgent !== "" ? selectedAgent : null;
    if (finalAgentId) {
      formData.append("agentId", finalAgentId);
    }
    formData.append("file", file);

    try {
      const queryParams = new URLSearchParams({
        isKb: isKb ? "true" : "false",
      });
      if (finalAgentId) {
        queryParams.append("agentId", finalAgentId);
      }

      const response = await apiFetch(
        `${process.env.NEXT_PUBLIC_API_URL}/documents/upload?${queryParams.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        throw new Error("Falha no upload");
      }

      toast.success("Documento enviado com sucesso.");
      setOpen(false);
      setFile(null);
      onUploadSuccess();
    } catch {
      toast.error("Não foi possível enviar o documento.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Novo Documento
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Enviar Documento</DialogTitle>
          <DialogDescription>
            {isKb
              ? "Selecione um arquivo PDF e o agente associado para a Base de Conhecimento."
              : "Selecione um arquivo PDF para enviar. Tamanho máximo: 5MB."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid w-full items-center gap-1.5">
            <Label htmlFor="file">Arquivo</Label>
            <Input
              id="file"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className={cn(file && "file:text-transparent!")}
            />
            {file && (
              <p className="text-sm text-muted-foreground truncate">
                Será salvo como:{" "}
                <span className="font-medium">{file.name}</span>
              </p>
            )}
          </div>

          {isKb && (
            <div className="grid w-full items-center gap-1.5">
              <Label htmlFor="agent">Agente (Opcional)</Label>
              <div className="relative">
                <select
                  id="agent"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none pointer-events-auto"
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                >
                  <option value="" disabled>
                    Selecione um agente
                  </option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none">
                  <svg
                    className="h-4 w-4 text-muted-foreground"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
              {agents.length === 0 && (
                <p className="text-[12px] text-destructive flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Nenhum agente encontrado. Crie um agente antes de fazer
                  upload.
                </p>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button
            onClick={handleUpload}
            disabled={
              !file ||
              uploading ||
              (isKb && (!selectedAgent || agents.length === 0))
            }
          >
            {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
