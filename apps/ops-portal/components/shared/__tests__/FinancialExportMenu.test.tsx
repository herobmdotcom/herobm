import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FinancialExportMenu } from '../FinancialExportMenu';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const map: Record<string, string> = {
      export: 'Export',
      exportCsv: 'Export CSV',
      exportExcel: 'Export Excel',
    };
    return map[key] || key;
  },
}));

describe('FinancialExportMenu', () => {
  it('renders trigger button and toggles dropdown on click', async () => {
    const user = userEvent.setup();
    const mockCsv = jest.fn();
    const mockExcel = jest.fn();

    render(<FinancialExportMenu onExportCsv={mockCsv} onExportExcel={mockExcel} />);

    const triggerBtn = screen.getByRole('button', { name: 'Export...' });
    expect(triggerBtn).toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: 'Export CSV' })).not.toBeInTheDocument();

    await user.click(triggerBtn);
    expect(screen.getByRole('menuitem', { name: 'Export CSV' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Export Excel' })).toBeInTheDocument();

    await user.click(screen.getByRole('menuitem', { name: 'Export CSV' }));
    expect(mockCsv).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menuitem', { name: 'Export CSV' })).not.toBeInTheDocument();
  });

  it('triggers Excel export callback when Excel menuitem is clicked', async () => {
    const user = userEvent.setup();
    const mockCsv = jest.fn();
    const mockExcel = jest.fn();

    render(<FinancialExportMenu onExportCsv={mockCsv} onExportExcel={mockExcel} />);

    await user.click(screen.getByRole('button', { name: 'Export...' }));
    await user.click(screen.getByRole('menuitem', { name: 'Export Excel' }));
    expect(mockExcel).toHaveBeenCalledTimes(1);
  });

  it('closes dropdown on Escape key', async () => {
    const user = userEvent.setup();
    render(<FinancialExportMenu onExportCsv={jest.fn()} onExportExcel={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Export...' }));
    expect(screen.getByRole('menuitem', { name: 'Export CSV' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menuitem', { name: 'Export CSV' })).not.toBeInTheDocument();
  });
});
