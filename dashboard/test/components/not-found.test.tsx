// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import TraceNotFound from '@/app/trace/[traceId]/not-found';

describe('TraceNotFound', () => {
  it('renders "Trace Not Found" heading', () => {
    const { getByRole } = render(<TraceNotFound />);

    expect(getByRole('heading', { level: 1 }).textContent).toBe('Trace Not Found');
  });

  it('renders link back to home', () => {
    const { container } = render(<TraceNotFound />);

    const link = container.querySelector('a[href="/"]');
    expect(link).not.toBeNull();
  });
});
