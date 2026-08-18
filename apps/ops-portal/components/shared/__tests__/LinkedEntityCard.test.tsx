import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LinkedEntityCard from '../LinkedEntityCard';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

describe('LinkedEntityCard', () => {
  it('renders title, icon, and joined array subtitle', () => {
    render(
      <LinkedEntityCard
        icon="receipt_long"
        title="INV-2026-001"
        subtitle={['15 Aug 2026', '3 lines', 'by admin', false, null, undefined]}
      />,
    );

    expect(screen.getByText('INV-2026-001')).toBeInTheDocument();
    expect(screen.getByText('receipt_long')).toBeInTheDocument();
    expect(screen.getByText('15 Aug 2026 · 3 lines · by admin')).toBeInTheDocument();
  });

  it('renders whole card as link when href is provided without actions or children', () => {
    render(
      <LinkedEntityCard
        icon="assignment_return"
        title="PRET-001"
        href="/purchase-orders/returns/pr-1"
        status="shipped"
        testId="card-link"
      />,
    );

    const card = screen.getByTestId('card-link');
    expect(card.tagName.toLowerCase()).toBe('a');
    expect(card).toHaveAttribute('href', '/purchase-orders/returns/pr-1');
  });

  it('renders inner link on left side when actions are provided to prevent nested interactive elements', () => {
    const handleAction = jest.fn();

    render(
      <LinkedEntityCard
        icon="receipt_long"
        title="INV-001"
        href="/sales-invoices/inv-1"
        actions={<button type="button" onClick={handleAction}>Email Invoice</button>}
        testId="card-container"
      />,
    );

    const container = screen.getByTestId('card-container');
    expect(container.tagName.toLowerCase()).toBe('div');

    const link = screen.getByRole('link', { name: /INV-001/i });
    expect(link).toHaveAttribute('href', '/sales-invoices/inv-1');

    const button = screen.getByRole('button', { name: 'Email Invoice' });
    expect(button).toBeInTheDocument();

    fireEvent.click(button);
    expect(handleAction).toHaveBeenCalledTimes(1);
  });

  it('renders formatted amounts and amount subtext', () => {
    render(
      <LinkedEntityCard
        title="DN-100"
        amount="$1,234.50"
        amountSubtext="Tax: $123.45"
      />,
    );

    expect(screen.getByText('$1,234.50')).toBeInTheDocument();
    expect(screen.getByText('Tax: $123.45')).toBeInTheDocument();
  });

  it('renders status badge for state strings and custom nodes', () => {
    const { rerender } = render(
      <LinkedEntityCard
        title="SH-001"
        status="shipped"
      />,
    );

    expect(screen.getByText(/shipped/i)).toBeInTheDocument();

    rerender(
      <LinkedEntityCard
        title="SH-001"
        status={<span data-testid="custom-badge">Custom Status</span>}
      />,
    );

    expect(screen.getByTestId('custom-badge')).toHaveAttribute('data-testid', 'custom-badge');
  });

  it('renders children underneath when provided', () => {
    render(
      <LinkedEntityCard
        title="PR-100"
        href="/purchase-orders/returns/pr-100"
      >
        <div data-testid="warning-notice">Location discrepancy detected</div>
      </LinkedEntityCard>,
    );

    expect(screen.getByTestId('warning-notice')).toBeInTheDocument();
    expect(screen.getByText('Location discrepancy detected')).toBeInTheDocument();
  });

  it('triggers onClick handler when card is clicked without href', () => {
    const handleClick = jest.fn();
    render(
      <LinkedEntityCard
        title="Selectable Card"
        onClick={handleClick}
        testId="clickable-card"
      />,
    );

    const card = screen.getByTestId('clickable-card');
    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
