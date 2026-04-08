"use client";

import type { Column } from "@turborepo/ui";
import { DocumentPublicDto } from "@turborepo/database";
import { Badge, Button } from "@turborepo/ui";
import { Database, Download, Trash2 } from "lucide-react";

export const getColumns = (
  onViewChunks: (doc: DocumentPublicDto) => void,
  onDownload: (doc: DocumentPublicDto) => void,
  onDelete: (doc: DocumentPublicDto) => void
): Column<DocumentPublicDto>[] => [
  {
    accessorKey: "originalFilename",
    header: "Nome do Arquivo",
  },
  {
    accessorKey: "ownerEmail",
    header: "Upload por",
    cell: (row) => {
      return row.ownerEmail ? (
        <span className="text-sm">{row.ownerEmail}</span>
      ) : (
        <span className="text-muted-foreground text-xs italic">—</span>
      );
    },
  },
  {
    accessorKey: "agentName",
    header: "Agente",
    cell: (row) => {
      return row.agentName ? (
        <Badge variant="secondary" className="font-medium">
          {row.agentName}
        </Badge>
      ) : (
        <span className="text-muted-foreground text-xs italic">Global</span>
      );
    },
  },
  {
    accessorKey: "size",
    header: "Tamanho",
    cell: (row) => {
      const size = parseFloat(String(row.size));
      return `${(size / 1024 / 1024).toFixed(2)} MB`;
    },
  },
  {
    accessorKey: "createdAt",
    header: "Data de Criação",
    cell: (row) => {
      return new Date(String(row.createdAt)).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
  },
  {
    accessorKey: "originalFilename", // Any key for the badge
    header: "Vetorizado",
    cell: () => {
      return (
        <Badge variant="outline" className="text-green-600 border-green-600">
          Sim
        </Badge>
      );
    },
  },
  {
    accessorKey: "id",
    header: "Ações",
    cell: (row) => {
      const doc = row;

      return (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onViewChunks(doc)}
            title="Ver Fragmentos (Chunks)"
          >
            <Database className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDownload(doc)}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive"
            onClick={() => onDelete(doc)}
            title="Excluir"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      );
    },
  },
];
