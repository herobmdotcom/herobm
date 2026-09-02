import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesCreditNotesPage from '../page';

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

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({ baseCurrency: 'USD' }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid({ onRowClicked, rowHref, headerActions, pageTitle }: any) {
    return (
      <div data-testid="data-grid">
        <h1>{pageTitle}</h1>
        <div>{headerActions}</div>
        <button
          data-testid="row-cn-1"
          onClick={() => {
            if (rowHref) {
              mockPush(rowHref({ creditNoteId: 'cn-1', creditNoteNumber: 'CN-001' }));
            } else if (onRowClicked) {
              onRowClicked({ creditNoteId: 'cn-1', creditNoteNumber: 'CN-001' });
            }
          }}
        >
          Row CN-001
        </button>
      </div>
    );
  };
});

jest.mock('@/app/credit-debit-notes/CreateNoteSlideOver', () => {
  return function DummyCreateSlideOver({ isOpen, onClose }: any) {
    if (!isOpen) return null;
    return (
      <div data-testid="create-note-slideover">
        <button onClick={onClose}>Close</button>
      </div>
    );
  };
});

describe('SalesCreditNotesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page and handles row navigation to detail page', async () => {
    render(<SalesCreditNotesPage />);

    expect(screen.getByText('Sales Credit Notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Credit Note' })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('row-cn-1'));
    expect(mockPush).toHaveBeenCalledWith('/sales-credit-notes/cn-1');
  });

  it('opens create credit note slideover when clicking header action', async () => {
    render(<SalesCreditNotesPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Create Credit Note' }));
    expect(screen.getByTestId('create-note-slideover')).toBeInTheDocument();
  });
});
