// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';

import { TraceDetailSkeleton } from '@/components/trace-detail/trace-detail-skeleton';

describe('TraceDetailSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<TraceDetailSkeleton />);
    expect(container.firstChild).toBeDefined();
  });

  it('contains skeleton pulse elements', () => {
    const { container } = render(<TraceDetailSkeleton />);
    // Skeleton component renders with data-slot="skeleton" or the Skeleton class
    const skeletons = container.querySelectorAll('[data-slot="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
