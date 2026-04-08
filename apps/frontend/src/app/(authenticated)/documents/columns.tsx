"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Column,
} from "@turborepo/ui";
import { DocumentPublicDto } from "@turborepo/database";
import { format } from "date-fns";
import { MoreHorizontal, Download, Trash, FileText } from "lucide-react";

type DocumentColumnActions = {
  onDownloadAction: (document: DocumentPublicDto) => void;
  onDeleteAction: (document: DocumentPublicDto) => void;
};

export const getColumns = ({
  onDownloadAction,
  onDeleteAction,
}: DocumentColumnActions): Column<DocumentPublicDto>[] => [
  {
    accessorKey: "originalFilename",
    header: "Nome do Arquivo",
    cell: (row) => {
      return (
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{row.originalFilename}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "size",
    header: "Tamanho",
    cell: (row) => {
      const size = row.size;
      const formattedSize =
        size < 1024
          ? `${size} B`
          : size < 1024 * 1024
            ? `${(size / 1024).toFixed(2)} KB`
            : `${(size / (1024 * 1024)).toFixed(2)} MB`;
      return <div>{formattedSize}</div>;
    },
  },
  {
    accessorKey: "contentType",
    header: "Tipo",
  },
  {
    accessorKey: "createdAt",
    header: "Data de Envio",
    cell: (row) => {
      return <div>{format(new Date(row.createdAt), "dd/MM/yyyy HH:mm")}</div>;
    },
  },
  {
    accessorKey: "id",
    header: "Ações",
    cell: (document) => {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Abrir menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Ações</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => onDownloadAction(document)}>
              <Download className="mr-2 h-4 w-4" />
              Baixar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => onDeleteAction(document)}
              className="text-destructive focus:text-destructive"
            >
              <Trash className="mr-2 h-4 w-4" />
              Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
