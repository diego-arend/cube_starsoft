import { vi } from "vitest";

/**
 * Utility type to turn all methods of T into vitest mocks.
 */
export type MockType<T> = {
  [P in keyof T]?: T[P] extends (...args: any[]) => any
    ? ReturnType<typeof vi.fn>
    : T[P];
};

/**
 * Creates a mock object for a given repository or service using a Proxy.
 * Any property access that hasn't been defined will return a vitest mock function.
 *
 * @param defaults - Optional initial values or mock implementations for specific methods.
 * @returns A mocked version of the requested type.
 *
 * @example
 * const mockUserRepo = createMock<UserRepository>({
 *   findByEmail: vi.fn().mockResolvedValue(user)
 * });
 */
export const createMock = <T extends object>(
  defaults: Partial<T> = {}
): MockType<T> => {
  // We use a internal cache to ensure we return the same mock function for the same property
  const mockCache = new Map<string | symbol, unknown>();

  return new Proxy(defaults, {
    get(target, prop) {
      // Return predefined values/mocks if they exist in the defaults object
      if (prop in target) {
        return (target as Record<string | symbol, unknown>)[prop];
      }

      // Check cache for dynamically created mocks
      if (mockCache.has(prop)) {
        return mockCache.get(prop);
      }

      // Create a new vitest mock for any other property access
      // Note: We assume that any property accessed on a repository/service that isn't
      // defined is a method.
      const newMock = vi.fn();
      mockCache.set(prop, newMock);
      return newMock;
    },
  }) as MockType<T>;
};
