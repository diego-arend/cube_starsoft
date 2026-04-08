import { describe, it, expect, vi } from "vitest";
import { getColumns } from "./columns";
import type { DocumentPublicDto } from "@turborepo/database";

describe("Embeddings columns", () => {
  const mockOnViewChunks = vi.fn();
  const mockOnDownload = vi.fn();
  const mockOnDelete = vi.fn();

  const columns = getColumns(mockOnViewChunks, mockOnDownload, mockOnDelete);

  it("should have correct number of columns", () => {
    expect(columns).toHaveLength(7);
  });

  it("should format size correctly", () => {
    const sizeColumn = columns.find((c) => c.header === "Tamanho");
    if (!sizeColumn || typeof sizeColumn.cell !== "function") {
      throw new Error("Size column not found or has no cell renderer");
    }

    const mockRow = { size: 1024 * 1024 } as DocumentPublicDto;
    const result = (sizeColumn.cell as (row: DocumentPublicDto) => string)(
      mockRow
    );
    expect(result).toBe("1.00 MB");
  });

  it("should format date correctly", () => {
    const dateColumn = columns.find((c) => c.header === "Data de Criação");
    if (!dateColumn || typeof dateColumn.cell !== "function") {
      throw new Error("Date column not found or has no cell renderer");
    }

    const dateStr = "2023-01-01T12:00:00Z";
    const mockRow = { createdAt: dateStr } as DocumentPublicDto;
    const result = (dateColumn.cell as (row: DocumentPublicDto) => string)(
      mockRow
    );

    // pt-BR locale check
    expect(result).toMatch(/01\/01\/2023/);
  });
});
