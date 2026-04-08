import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { LoadingProvider } from "../../components/loading-provider";
import { useLoadingStore } from "../../stores/loading-store";
import { act } from "react";

// Mock useInitializeApiFetch since it's tested elsewhere or has side effects we don't need here
vi.mock("../../hooks/use-api-fetch", () => ({
  useInitializeApiFetch: vi.fn(),
}));

describe("LoadingProvider", () => {
  beforeEach(() => {
    useLoadingStore.setState({ loadingCount: 0, isLoading: false });
  });

  it("should render children", () => {
    render(
      <LoadingProvider>
        <div data-testid="child">Child Content</div>
      </LoadingProvider>
    );

    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("should show the loader when isLoading is true", async () => {
    render(
      <LoadingProvider>
        <div>Content</div>
      </LoadingProvider>
    );

    act(() => {
      useLoadingStore.getState().start();
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should hide the loader when isLoading becomes false", async () => {
    render(
      <LoadingProvider>
        <div>Content</div>
      </LoadingProvider>
    );

    act(() => {
      useLoadingStore.getState().start();
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    act(() => {
      useLoadingStore.getState().finish();
    });

    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
