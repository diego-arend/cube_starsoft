"use client";

import type { Column } from "@turborepo/ui";
import { AgentDto } from "@turborepo/database/client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Badge,
} from "@turborepo/ui";
import { MoreHorizontal, Pencil } from "lucide-react";

interface ColumnsProps {
  onEditAction: (agent: AgentDto) => void;
}

export const getColumns = ({
  onEditAction,
}: ColumnsProps): Column<AgentDto>[] => [
  {
    accessorKey: "name",
    header: "Nome",
  },
  {
    accessorKey: "specialty",
    header: "Especialidade",
    cell: (agent) => {
      return (
        <div
          className="max-w-[200px] truncate cursor-help"
          title={agent.specialty}
        >
          {agent.specialty}
        </div>
      );
    },
  },
  {
    accessorKey: "description",
    header: "Descrição",
    cell: (agent) => {
      return (
        <div
          className="max-w-[200px] truncate cursor-help text-muted-foreground"
          title={agent.description || ""}
        >
          {agent.description || "-"}
        </div>
      );
    },
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: (agent) => {
      return (
        <Badge variant={agent.isActive ? "default" : "secondary"}>
          {agent.isActive ? "Ativo" : "Inativo"}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: "Criado em",
    cell: (agent) => {
      return new Date(agent.createdAt).toLocaleDateString("pt-BR");
    },
  },
  {
    accessorKey: "id", // Use id as accessor for the action column
    header: "Ações",
    cell: (agent: AgentDto) => {
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
            <DropdownMenuItem onClick={() => onEditAction(agent)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
