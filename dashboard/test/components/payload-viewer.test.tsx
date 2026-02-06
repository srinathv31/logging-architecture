// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { PayloadViewer } from '@/components/trace-detail/payload-viewer';

describe('PayloadViewer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('shows "No data" message when content is null', () => {
    render(<PayloadViewer content={null} label="Request" />);

    expect(screen.getByText('No request data')).toBeDefined();
  });

  it('shows "No data" for response label when content is null', () => {
    render(<PayloadViewer content={null} label="Response" />);

    expect(screen.getByText('No response data')).toBeDefined();
  });

  it('formats valid JSON content with indentation', () => {
    const json = '{"key":"value","num":42}';
    const { container } = render(<PayloadViewer content={json} label="Request" />);

    const preElement = container.querySelector('pre');
    expect(preElement!.textContent).toContain('"key": "value"');
    expect(preElement!.textContent).toContain('"num": 42');
  });

  it('renders non-JSON content as-is', () => {
    const raw = 'plain text content';
    const { container } = render(<PayloadViewer content={raw} label="Request" />);

    const preElement = container.querySelector('pre');
    expect(preElement!.textContent).toBe('plain text content');
  });

  it('renders label text', () => {
    render(<PayloadViewer content="test" label="My Label" />);

    expect(screen.getByText('My Label')).toBeDefined();
  });

  it('truncates long content with "..." and shows Expand button', () => {
    const longContent = 'x'.repeat(600);
    render(<PayloadViewer content={longContent} label="Request" />);

    // The Expand button should be visible
    expect(screen.getByText('Expand')).toBeDefined();

    // Content should be truncated
    const preElement = document.querySelector('pre');
    expect(preElement!.textContent!.endsWith('...')).toBe(true);
    expect(preElement!.textContent!.length).toBeLessThan(600);
  });

  it('does not show Expand button for short content', () => {
    render(<PayloadViewer content="short" label="Request" />);

    expect(screen.queryByText('Expand')).toBeNull();
    expect(screen.queryByText('Collapse')).toBeNull();
  });

  it('expand/collapse toggle works', () => {
    const longContent = 'y'.repeat(600);
    render(<PayloadViewer content={longContent} label="Request" />);

    // Click expand
    fireEvent.click(screen.getByText('Expand'));

    // Should now show Collapse
    expect(screen.getByText('Collapse')).toBeDefined();

    // Full content should be shown
    const preElement = document.querySelector('pre');
    expect(preElement!.textContent).toBe(longContent);

    // Click collapse
    fireEvent.click(screen.getByText('Collapse'));

    expect(screen.getByText('Expand')).toBeDefined();
  });

  it('copy button writes to clipboard', async () => {
    render(<PayloadViewer content="copy me" label="Request" />);

    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('copy me');
  });

  it('shows "Copied" temporarily after copy', async () => {
    vi.useFakeTimers();

    render(<PayloadViewer content="copy me" label="Request" />);

    await act(async () => {
      fireEvent.click(screen.getByText('Copy'));
    });

    expect(screen.getByText('Copied')).toBeDefined();

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Copy')).toBeDefined();

    vi.useRealTimers();
  });

  it('renders Copy button for non-null content', () => {
    render(<PayloadViewer content="test content" label="Request" />);

    expect(screen.getByText('Copy')).toBeDefined();
  });
});
