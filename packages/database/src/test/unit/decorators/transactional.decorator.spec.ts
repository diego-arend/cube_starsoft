import { describe, it, expect, beforeEach, vi } from "vitest";
import { EntityManager } from "typeorm";
import { Transactional } from "../../../decorators/transactional.decorator";

describe("Transactional decorator", () => {
  const mockManager = { isMockManager: true } as any;
  let transactionSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    transactionSpy = vi.fn().mockImplementation((cb: (mgr: any) => any) => {
      return cb(mockManager) as unknown;
    });

    // Spy on EntityManager.prototype.transaction to catch ALL transaction calls
    vi.spyOn(EntityManager.prototype, "transaction").mockImplementation(
      transactionSpy
    );
  });

  it("injects manager as last argument and preserves this", async () => {
    class TestSvc {
      public value = 1;
      @Transactional()
      async operate(a: number, manager?: any) {
        await Promise.resolve();
        // preserve 'this' and check manager injection
        this.value += a;
        return { value: this.value, managerProvided: !!manager };
      }
    }
    const svc = new TestSvc();
    const res = await svc.operate(2);
    expect(res).toEqual({ value: 3, managerProvided: true });
    expect(transactionSpy).toHaveBeenCalledOnce();
  });

  it("injects manager at a custom index", async () => {
    class TestSvc {
      @Transactional({ injectManagerIndex: 0 })
      async operate(manager: any, a: number) {
        await Promise.resolve();
        return { a, managerProvided: !!manager };
      }
    }
    const svc = new TestSvc();
    const res = await (svc as any).operate(5);
    expect(res).toEqual({ a: 5, managerProvided: true });
    expect(transactionSpy).toHaveBeenCalledOnce();
  });

  it("propagates errors (transaction rollback)", async () => {
    class TestSvc {
      @Transactional()
      async fail() {
        await Promise.resolve();
        throw new Error("oops");
      }
    }
    const svc = new TestSvc();
    await expect((svc as any).fail()).rejects.toThrow("oops");
    expect(transactionSpy).toHaveBeenCalledOnce();
  });
});
