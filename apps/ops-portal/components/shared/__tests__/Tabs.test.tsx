import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Tabs from '../Tabs';

describe('Tabs Component', () => {
  const tabs = [
    { id: 'lines', label: 'Line items' },
    { id: 'availability', label: 'Availability' },
    { id: 'backorders', label: 'Backorders' },
  ];

  it('renders all tab options and highlights the active tab', () => {
    const handleChange = jest.fn();

    render(
      <Tabs
        tabs={tabs}
        activeTab="lines"
        onChange={handleChange}
      />,
    );

    const linesTab = screen.getByRole('tab', { name: /Line items/i });
    const availTab = screen.getByRole('tab', { name: /Availability/i });

    expect(linesTab).toBeInTheDocument();
    expect(availTab).toBeInTheDocument();
    expect(linesTab).toHaveAttribute('aria-selected', 'true');
    expect(availTab).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(availTab);
    expect(handleChange).toHaveBeenCalledWith('availability');
  });

  it('renders actions when provided', () => {
    render(
      <Tabs
        tabs={tabs}
        activeTab="lines"
        onChange={jest.fn()}
        actions={<button type="button">Add Line</button>}
      />,
    );

    expect(screen.getByRole('button', { name: /Add Line/i })).toBeInTheDocument();
  });

  it('renders with custom status colors and badges', () => {
    const statusTabs = [
      { id: 'ready', label: 'Ready', color: 'emerald' as const, badge: '(10)' },
      { id: 'partial', label: 'Partial', color: 'amber' as const, badge: '(5)' },
      { id: 'blocked', label: 'Blocked', color: 'rose' as const, badge: '(2)' },
    ];

    render(
      <Tabs
        tabs={statusTabs}
        activeTab="ready"
        onChange={jest.fn()}
        equalWidth
      />,
    );

    expect(screen.getByText('(10)')).toBeInTheDocument();
    expect(screen.getByText('(5)')).toBeInTheDocument();
    expect(screen.getByText('(2)')).toBeInTheDocument();
  });

  it('renders flat variant when specified', () => {
    const handleChange = jest.fn();

    render(
      <Tabs
        tabs={tabs}
        activeTab="lines"
        onChange={handleChange}
        variant="flat"
      />,
    );

    const linesButton = screen.getByRole('button', { name: /Line items/i });
    const availButton = screen.getByRole('button', { name: /Availability/i });

    expect(linesButton).toBeInTheDocument();
    expect(availButton).toBeInTheDocument();

    fireEvent.click(availButton);
    expect(handleChange).toHaveBeenCalledWith('availability');
  });
});
