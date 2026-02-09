// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock router.refresh for error components
const mockRefresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: mockRefresh,
  }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
  }: {
    href: string;
    children: React.ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import { ErrorBoundary } from "@/components/error-boundary";
import { TraceDetailError } from "@/app/trace/[traceId]/trace-detail-error";
import { TraceTableError } from "@/components/traces/trace-table-error";

// Component that throws an error for testing ErrorBoundary
function ThrowingComponent(): React.ReactElement {
  throw new Error("Test error");
}

describe("ErrorBoundary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Suppress console.error for expected errors
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("renders children when no error is thrown", () => {
    render(
      <ErrorBoundary fallback={<div>Error fallback</div>}>
        <div>Child content</div>
      </ErrorBoundary>,
    );

    expect(screen.getByText("Child content")).toBeDefined();
    expect(screen.queryByText("Error fallback")).toBeNull();
  });

  it("renders fallback when a child component throws an error", () => {
    render(
      <ErrorBoundary fallback={<div>Error fallback</div>}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Error fallback")).toBeDefined();
    expect(screen.queryByText("Child content")).toBeNull();
  });

  it("renders null fallback when specified", () => {
    const { container } = render(
      <ErrorBoundary fallback={null}>
        <ThrowingComponent />
      </ErrorBoundary>,
    );

    expect(container.innerHTML).toBe("");
  });
});

describe("TraceDetailError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error message correctly", () => {
    render(<TraceDetailError />);

    expect(screen.getByText("Failed to Load Trace")).toBeDefined();
    expect(
      screen.getByText("Something went wrong while loading the trace details."),
    ).toBeDefined();
  });

  it("renders Try again button", () => {
    render(<TraceDetailError />);

    expect(screen.getByText("Try again")).toBeDefined();
  });

  it("renders Back to traces link", () => {
    render(<TraceDetailError />);

    const link = screen.getByText("← Back to traces");
    expect(link.closest("a")).toHaveProperty(
      "href",
      expect.stringContaining("/"),
    );
  });

  it("calls router.refresh when Try again button is clicked", () => {
    render(<TraceDetailError />);

    const tryAgainButton = screen.getByText("Try again");
    fireEvent.click(tryAgainButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});

describe("TraceTableError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders error message correctly", () => {
    render(<TraceTableError />);

    expect(screen.getByText("Failed to load traces")).toBeDefined();
    expect(
      screen.getByText("Something went wrong while fetching trace data."),
    ).toBeDefined();
  });

  it("renders table headers", () => {
    render(<TraceTableError />);

    expect(screen.getByText("Trace")).toBeDefined();
    expect(screen.getByText("Process")).toBeDefined();
    expect(screen.getByText("Account")).toBeDefined();
    expect(screen.getByText("Events")).toBeDefined();
    expect(screen.getByText("Status")).toBeDefined();
    expect(screen.getByText("Duration")).toBeDefined();
    expect(screen.getByText("Last Activity")).toBeDefined();
  });

  it("renders Try again button", () => {
    render(<TraceTableError />);

    expect(screen.getByText("Try again")).toBeDefined();
  });

  it("calls router.refresh when Try again button is clicked", () => {
    render(<TraceTableError />);

    const tryAgainButton = screen.getByText("Try again");
    fireEvent.click(tryAgainButton);

    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });
});
