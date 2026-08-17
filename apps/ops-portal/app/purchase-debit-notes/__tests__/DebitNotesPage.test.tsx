import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PurchaseDebitNotesPage from '../page';

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
  return function DummyDataGrid({ onRowClicked, headerActions, pageTitle }: any) {
    return (
      <div data-testid="data-grid">
        <h1>{pageTitle}</h1>
        <div>{headerActions}</div>
        <button
          data-testid="row-dn-1"
          onClick={() => onRowClicked({ debitNoteId: 'dn-1', debitNoteNumber: 'DN-001' })}
        >
          Row DN-001
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

describe('PurchaseDebitNotesPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders page and handles row navigation to detail page', async () => {
    render(<PurchaseDebitNotesPage />);

    expect(screen.getByText('Purchase Debit Notes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Debit Note' })).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('row-dn-1'));
    expect(mockPush).toHaveBeenCalledWith('/purchase-debit-notes/dn-1');
  });

  it('opens create debit note slideover when clicking header action', async () => {
    render(<PurchaseDebitNotesPage />);

    await userEvent.click(screen.getByRole('button', { name: 'Create Debit Note' }));
    expect(screen.getByTestId('create-note-slideover')).toBeInTheDocument();
  });
});
