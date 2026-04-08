import { describe, it, expect, beforeEach } from "vitest";
import { useLoadingStore } from "../../stores/loading-store";

describe("useLoadingStore", () => {
  beforeEach(() => {
    // Reset store state before each test
    useLoadingStore.setState({ loadingCount: 0, isLoading: false });
  });

  it("should start with initial state", () => {
    const state = useLoadingStore.getState();
    expect(state.loadingCount).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  it("should increment loadingCount and set isLoading to true when start is called", () => {
    useLoadingStore.getState().start();
    const state = useLoadingStore.getState();
    expect(state.loadingCount).toBe(1);
    expect(state.isLoading).toBe(true);
  });

  it("should decrement loadingCount when finish is called", () => {
    useLoadingStore.getState().start();
    useLoadingStore.getState().start();
    useLoadingStore.getState().finish();

    const state = useLoadingStore.getState();
    expect(state.loadingCount).toBe(1);
    expect(state.isLoading).toBe(true);
  });

  it("should set isLoading to false when loadingCount reaches 0", () => {
    useLoadingStore.getState().start();
    useLoadingStore.getState().finish();

    const state = useLoadingStore.getState();
    expect(state.loadingCount).toBe(0);
    expect(state.isLoading).toBe(false);
  });

  it("should not allow loadingCount to go below 0", () => {
    useLoadingStore.getState().finish();

    const state = useLoadingStore.getState();
    expect(state.loadingCount).toBe(0);
    expect(state.isLoading).toBe(false);
  });
});
