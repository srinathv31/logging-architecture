// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { Activity } from 'lucide-react';
import { StatCard } from '@/components/layout/stat-card';

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard icon={Activity} label="Total Events" value="1,234" />);

    expect(screen.getByText('Total Events')).toBeDefined();
    expect(screen.getByText('1,234')).toBeDefined();
  });

  it('renders numeric value', () => {
    render(<StatCard icon={Activity} label="Count" value={42} />);

    expect(screen.getByText('42')).toBeDefined();
  });

  it('applies success status styles', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Rate" value="95%" status="success" />
    );

    const valueEl = container.querySelector('.text-green-600');
    expect(valueEl).not.toBeNull();
  });

  it('applies warning status styles', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Rate" value="75%" status="warning" />
    );

    const valueEl = container.querySelector('.text-yellow-600');
    expect(valueEl).not.toBeNull();
  });

  it('applies error status styles', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Rate" value="50%" status="error" />
    );

    const valueEl = container.querySelector('.text-red-600');
    expect(valueEl).not.toBeNull();
  });

  it('defaults to neutral status', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Count" value="100" />
    );

    // Neutral doesn't add green/yellow/red classes
    expect(container.querySelector('.text-green-600')).toBeNull();
    expect(container.querySelector('.text-yellow-600')).toBeNull();
    expect(container.querySelector('.text-red-600')).toBeNull();
  });

  it('renders subtitle when provided', () => {
    render(
      <StatCard icon={Activity} label="Systems" value="5" subtitle="A, B, C" />
    );

    expect(screen.getByText('A, B, C')).toBeDefined();
  });

  it('does not render subtitle when not provided', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Systems" value="5" />
    );

    // No subtitle element should be present
    const subtitleEls = container.querySelectorAll('.text-\\[11px\\]');
    expect(subtitleEls.length).toBe(0);
  });

  it('renders trend with trendUp=true in green', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Growth" value="120" trend="+5%" trendUp={true} />
    );

    expect(screen.getByText('+5%')).toBeDefined();
    const trendEl = container.querySelector('.text-green-600');
    expect(trendEl).not.toBeNull();
  });

  it('renders trend with trendUp=false in red', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Growth" value="80" trend="-3%" trendUp={false} />
    );

    expect(screen.getByText('-3%')).toBeDefined();
    const trendEl = container.querySelector('.text-red-600');
    expect(trendEl).not.toBeNull();
  });

  it('does not render trend when not provided', () => {
    render(
      <StatCard icon={Activity} label="Count" value="100" />
    );

    expect(screen.queryByText(/[+-]\d+%/)).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(
      <StatCard icon={Activity} label="Test" value="1" className="my-custom-class" />
    );

    expect(container.firstElementChild!.classList.contains('my-custom-class')).toBe(true);
  });
});
