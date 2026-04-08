import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GlobalLoader } from "../../components/ui/loading-spinner";

describe("GlobalLoader", () => {
  it("should render the loader with correct accessibility attributes", () => {
    render(<GlobalLoader />);

    const loader = screen.getByRole("status");
    expect(loader).toBeInTheDocument();
    expect(loader).toHaveAttribute("aria-live", "polite");
  });

  it("should contain the screen reader text", () => {
    render(<GlobalLoader />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("should render the spinner icon with animation class", () => {
    const { container } = render(<GlobalLoader />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveClass("animate-spin");
  });

  it("should apply custom className", () => {
    const customClass = "custom-test-class";
    render(<GlobalLoader className={customClass} />);
    const loader = screen.getByRole("status");
    expect(loader).toHaveClass(customClass);
  });
});
