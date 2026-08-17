import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PurchaseReturnsPage from '../page';

const mockPush = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid({ onRowClicked, headerActions, pageTitle }: any) {
    return (
      <div data-testid="data-grid">
        <h1>{pageTitle}</h1>
        <div>{headerActions}</div>
        <button
          data-testid="row-pr-1"
          onClick={() => onRowClicked({ returnId: 'ret-1', returnNumber: 'PR-001' })}
        >
          Row PR-001
        </button>
      </div>
    );
  };
});

describe('PurchaseReturnsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders pageTitle and Create Return button', () => {
    render(<PurchaseReturnsPage />);
    expect(screen.getByText('Purchase Returns')).toBeInTheDocument();
    expect(screen.getByText('returns.createReturn')).toBeInTheDocument();
  });

  it('navigates to detail page on row click', async () => {
    const user = userEvent.setup();
    render(<PurchaseReturnsPage />);

    await user.click(screen.getByTestId('row-pr-1'));
    expect(mockPush).toHaveBeenCalledWith('/purchase-orders/returns/ret-1');
  });
});
