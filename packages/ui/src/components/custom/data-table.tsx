import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface Column<T> {
  header: string;
  accessorKey: keyof T;
  cell?: (item: T) => React.ReactNode;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  pagination?: PaginationMeta;
  onPageChange?: (page: number) => void;
  headerClassName?: string;
  enableSearch?: boolean;
  searchPlaceholder?: string;
  onSearch?: (query: string) => void;
  initialSearch?: string;
}

export function DataTable<T>({
  data,
  columns,
  pagination,
  onPageChange,
  headerClassName,
  enableSearch = false,
  searchPlaceholder = "Filtrar...",
  onSearch,
  initialSearch = "",
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = React.useState(initialSearch);

  React.useEffect(() => {
    setSearchTerm(initialSearch);
  }, [initialSearch]);

  React.useEffect(() => {
    if (!enableSearch || !onSearch) return;

    const delayDebounceFn = setTimeout(() => {
      onSearch(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, enableSearch, onSearch]);

  return (
    <div className="space-y-4">
      {enableSearch && (
        <div className="flex items-center py-4">
          <Input
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="max-w-sm"
          />
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow className={headerClassName}>
              {columns.map((column, index) => (
                <TableHead key={index}>{column.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column, colIndex) => (
                    <TableCell key={colIndex}>
                      {column.cell
                        ? column.cell(row)
                        : (row[column.accessorKey] as React.ReactNode)}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  Nenhum resultado encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {pagination && onPageChange && (
        <div className="flex flex-col items-center gap-3 py-4 sm:flex-row sm:justify-end sm:gap-0 sm:space-x-4">
          <div className="text-xs text-muted-foreground sm:text-sm">
            Total: {pagination.total} | Página {pagination.page} de{" "}
            {pagination.pages || 1}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs sm:h-9 sm:text-sm"
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs sm:h-9 sm:text-sm"
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page >= (pagination.pages || 1)}
            >
              Próximo
              <ChevronRight className="ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
