// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

let mockPathname = '/';

vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

const mockSetTheme = vi.fn();
let mockResolvedTheme = 'light';

vi.mock('next-themes', () => ({
  useTheme: () => ({
    resolvedTheme: mockResolvedTheme,
    setTheme: mockSetTheme,
  }),
}));

import { AppHeader } from '@/components/layout/app-header';

describe('AppHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  it('renders brand name', () => {
    render(<AppHeader />);

    expect(screen.getByText('Event Log API')).toBeDefined();
  });

  it('renders subtitle', () => {
    render(<AppHeader />);

    expect(screen.getByText('Customer Journey Visibility')).toBeDefined();
  });

  it('renders logo link to home', () => {
    render(<AppHeader />);

    const links = screen.getAllByRole('link');
    const homeLink = links.find(l => l.getAttribute('href') === '/');
    expect(homeLink).toBeDefined();
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/';
    mockResolvedTheme = 'light';
  });

  it('renders toggle button', () => {
    render(<AppHeader />);

    expect(screen.getByText('Toggle theme')).toBeDefined();
  });

  it('calls setTheme with dark when current theme is light', () => {
    mockResolvedTheme = 'light';
    render(<AppHeader />);

    const toggleButton = screen.getByText('Toggle theme').closest('button')!;
    fireEvent.click(toggleButton);

    expect(mockSetTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme with light when current theme is dark', () => {
    mockResolvedTheme = 'dark';
    render(<AppHeader />);

    const toggleButton = screen.getByText('Toggle theme').closest('button')!;
    fireEvent.click(toggleButton);

    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});

describe('Breadcrumbs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null on "/" pathname', () => {
    mockPathname = '/';
    const { container } = render(<AppHeader />);

    // Should not have breadcrumb nav (only Dashboard link would appear if breadcrumbs were shown)
    const navs = container.querySelectorAll('nav');
    expect(navs.length).toBe(0);
  });

  it('renders segments for /trace/abc-123', () => {
    mockPathname = '/trace/abc-123';
    render(<AppHeader />);

    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Trace')).toBeDefined();
    expect(screen.getByText('abc-123')).toBeDefined();
  });

  it('truncates long labels (>20 chars)', () => {
    mockPathname = '/trace/this-is-a-very-long-trace-id-that-exceeds-twenty';
    render(<AppHeader />);

    expect(screen.getByText('this-is-a-very-long-...')).toBeDefined();
  });

  it('decodes URI-encoded segments', () => {
    mockPathname = '/trace/hello%20world';
    render(<AppHeader />);

    expect(screen.getByText('hello world')).toBeDefined();
  });
});
