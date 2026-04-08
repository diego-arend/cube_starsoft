"use client";

import type { Column } from "@turborepo/ui";
import { UserPublicDto } from "@turborepo/database/client";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@turborepo/ui";
import { MoreHorizontal, Trash, Pencil } from "lucide-react";

interface ColumnsProps {
  onEditAction: (user: UserPublicDto) => void;
  onDeleteAction: (user: UserPublicDto) => void;
}

export const getColumns = ({
  onEditAction,
  onDeleteAction,
}: ColumnsProps): Column<UserPublicDto>[] => [
  {
    accessorKey: "name",
    header: "Nome",
  },
  {
    accessorKey: "email",
    header: "Email",
  },
  {
    accessorKey: "role",
    header: "Role",
  },
  {
    accessorKey: "createdAt",
    header: "Criado em",
    cell: (row) => {
      return new Date(row.createdAt).toLocaleDateString("pt-BR");
    },
  },
  {
    accessorKey: "createdAt", // Using a valid key even though we override cell
    header: "Ações",
    cell: (row) => {
      const user = row;

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
            <DropdownMenuItem onClick={() => onEditAction(user)}>
              <Pencil className="mr-2 h-4 w-4" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onDeleteAction(user)}
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
