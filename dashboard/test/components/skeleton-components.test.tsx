// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TraceDetailSkeleton } from '@/components/trace-detail/trace-detail-skeleton';
import { TraceTableSkeleton } from '@/components/traces/trace-table-skeleton';
import { Skeleton } from '@/components/ui/skeleton';

describe('TraceDetailSkeleton', () => {
  it('renders without error', () => {
    const { container } = render(<TraceDetailSkeleton />);

    expect(container.firstChild).toBeDefined();
  });

  it('contains skeleton elements', () => {
    const { container } = render(<TraceDetailSkeleton />);

    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('TraceTableSkeleton', () => {
  it('renders without error', () => {
    const { container } = render(<TraceTableSkeleton />);

    expect(container.firstChild).toBeDefined();
  });

  it('renders table headers', () => {
    render(<TraceTableSkeleton />);

    expect(screen.getByText('Trace ID')).toBeDefined();
    expect(screen.getByText('Process Name')).toBeDefined();
    expect(screen.getByText('Account ID')).toBeDefined();
    expect(screen.getByText('Events')).toBeDefined();
    expect(screen.getByText('Status')).toBeDefined();
    expect(screen.getByText('Duration')).toBeDefined();
    expect(screen.getByText('Last Event')).toBeDefined();
  });

  it('renders 10 skeleton rows', () => {
    const { container } = render(<TraceTableSkeleton />);

    // Each row has 7 cells, there should be 10 rows in the body
    const rows = container.querySelectorAll('tbody tr');
    expect(rows.length).toBe(10);
  });

  it('contains skeleton elements in rows', () => {
    const { container } = render(<TraceTableSkeleton />);

    const skeletons = container.querySelectorAll('tbody [data-slot="skeleton"]');
    expect(skeletons.length).toBe(70); // 10 rows * 7 columns
  });
});

describe('Skeleton base component', () => {
  it('renders with default classes', () => {
    const { container } = render(<Skeleton />);

    const el = container.firstElementChild!;
    expect(el.getAttribute('data-slot')).toBe('skeleton');
    expect(el.classList.contains('animate-pulse')).toBe(true);
  });

  it('renders with custom className', () => {
    const { container } = render(<Skeleton className="h-4 w-40" />);

    const el = container.firstElementChild!;
    expect(el.classList.contains('h-4')).toBe(true);
    expect(el.classList.contains('w-40')).toBe(true);
  });
});
