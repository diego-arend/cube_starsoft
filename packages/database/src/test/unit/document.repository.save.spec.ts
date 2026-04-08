import { describe, expect, it, vi } from "vitest";
import { DocumentRepository } from "../../repositories/document.repository";

// Use a fake repository to simulate a unique-constraint error on save and
// ensure the repository returns the existing row via `manager.query`.
describe("DocumentRepository save idempotency (unit)", () => {
  it("returns existing record when save throws unique-constraint", async () => {
    const fakeRepo: any = {
      save: vi.fn(async () => {
        await Promise.resolve();
        const err: any = new Error(
          "duplicate key value violates unique constraint"
        );
        err.code = "23505";
        throw err;
      }),
      manager: {
        query: vi.fn(() =>
          Promise.resolve([
            {
              id: "existing-id",
              key: "owner1/dup.pdf",
              owner_id: "owner1",
              original_filename: "dup.pdf",
              content_type: "application/pdf",
              size: 100,
              metadata: "{}",
              scan_status: "clean",
              created_at: new Date(),
            },
          ])
        ),
      },
    };

    const repo = new DocumentRepository(fakeRepo);
    const res = await repo.save({
      key: "owner1/dup.pdf",
      ownerId: "owner1",
    } as any);
    expect(res).toBeTruthy();
    expect(res.id).toBe("existing-id");
    expect(res.key).toBe("owner1/dup.pdf");
    expect(typeof res.size).toBe("number");
    expect(typeof res.createdAt).toBe("string");
    expect(fakeRepo.manager.query).toHaveBeenCalledWith(
      `SELECT * FROM documents WHERE key = $1 LIMIT 1`,
      ["owner1/dup.pdf"]
    );
  });
});
