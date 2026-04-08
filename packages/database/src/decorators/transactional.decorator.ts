import type { EntityManager } from "typeorm";
import { AppDataSource } from "../data-source";

export interface TransactionalOptions {
  // If provided, insert the manager at this index (0-based) in the args list.
  injectManagerIndex?: number;
}

// Append to last arg by default; optional injection index supported
export function Transactional(opts?: TransactionalOptions): MethodDecorator {
  return function (
    target: unknown,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ) {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    if (typeof original !== "function") return;
    descriptor.value = async function (
      this: unknown,
      ...args: unknown[]
    ): Promise<unknown> {
      // Use AppDataSource to run a transaction and provide a manager param
      const res = await AppDataSource.manager.transaction<unknown>(
        async (manager: EntityManager) => {
          // clone arguments and inject manager as requested
          const callArgs = args.slice();
          if (typeof opts?.injectManagerIndex === "number") {
            const idx = Math.max(
              0,
              Math.min(opts.injectManagerIndex, callArgs.length)
            );
            callArgs.splice(idx, 0, manager);
          } else {
            callArgs.push(manager);
          }
          // ensure the 'this' context is preserved
          const result = (original as (...args: unknown[]) => unknown).apply(
            this,
            callArgs
          ) as unknown;
          if (result instanceof Promise) return (await result) as unknown;
          return result;
        }
      );
      return res;
    } as unknown as PropertyDescriptor["value"];
  } as MethodDecorator;
}
