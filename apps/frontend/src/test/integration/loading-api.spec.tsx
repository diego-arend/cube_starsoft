import React, { act } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { LoadingProvider } from "../../components/loading-provider";
import { apiFetch, setApiFetchHooks } from "../../lib/api-fetch";
import { useLoadingStore } from "../../stores/loading-store";

// We need a real-ish setup for the hooks to work
import { useInitializeApiFetch } from "../../hooks/use-api-fetch";

const TestComponent = () => {
  useInitializeApiFetch();
  return null;
};

describe("Loading Integration (Provider + apiFetch)", () => {
  beforeEach(() => {
    useLoadingStore.setState({ loadingCount: 0, isLoading: false });
    vi.clearAllMocks();
  });

  afterEach(() => {
    setApiFetchHooks({});
  });

  it("should show loader during apiFetch and hide after completion", async () => {
    // We need to render the provider which uses the store
    render(
      <LoadingProvider>
        <TestComponent />
        <div data-testid="content">App Content</div>
      </LoadingProvider>
    );

    // Mock a delayed fetch
    let resolveFetch: (value: Response | PromiseLike<Response>) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });

    vi.mocked(fetch).mockReturnValue(fetchPromise);

    // Start fetch
    let apiPromise: Promise<Response>;
    await act(async () => {
      apiPromise = apiFetch("https://api.example.com/data");
    });

    // Loader should be visible
    expect(await screen.findByRole("status")).toBeInTheDocument();

    // Resolve fetch
    await act(async () => {
      resolveFetch!({ ok: true, json: async () => ({}) } as Response);
      await apiPromise;
    });

    // Loader should be gone
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("should handle multiple concurrent fetches", async () => {
    render(
      <LoadingProvider>
        <TestComponent />
      </LoadingProvider>
    );

    let resolve1: (v: Response | PromiseLike<Response>) => void;
    let resolve2: (v: Response | PromiseLike<Response>) => void;

    const p1 = new Promise<Response>((r) => (resolve1 = r));
    const p2 = new Promise<Response>((r) => (resolve2 = r));

    vi.mocked(fetch).mockReturnValueOnce(p1).mockReturnValueOnce(p2);

    let call1: Promise<Response>;
    let call2: Promise<Response>;

    await act(async () => {
      call1 = apiFetch("/1");
      call2 = apiFetch("/2");
    });

    expect(await screen.findByRole("status")).toBeInTheDocument();

    // Resolve first call
    await act(async () => {
      resolve1!({ ok: true } as Response);
      await call1;
    });

    // Loader should STILL be visible because of call2
    expect(screen.getByRole("status")).toBeInTheDocument();

    // Resolve second call
    await act(async () => {
      resolve2!({ ok: true } as Response);
      await call2;
    });

    // Loader should be gone
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
