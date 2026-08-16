import { render as rtlRender, screen, waitFor } from '@testing-library/react';
import { SWRConfig } from 'swr';
import userEvent from '@testing-library/user-event';
import CreditDebitNotesPage from '../page';
import * as api from '@herobm/sdk';

const render = (ui: React.ReactElement) => {
  return rtlRender(
    <SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>
      {ui}
    </SWRConfig>
  );
};

jest.mock('@herobm/sdk', () => ({
  salesCreditNotesControllerFindAll: jest.fn(),
  purchaseDebitNotesControllerFindAll: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({ baseCurrency: 'AUD' }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@/lib/currency', () => ({
  formatAmount: (v: number, cc: string) => `${cc} ${v}`,
}));

jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid({ rowData, endpoint, onRowClicked, headerActions }: any) {
    const data = rowData || [
      {
        id: 'credit_note-cn-1',
        noteId: 'cn-1',
        type: 'credit_note',
        typeLabel: 'Credit Note',
        noteNumber: 'SCN-2026-001',
        partyName: 'Customer Alpha',
        totalAmount: 120,
      },
      {
        id: 'debit_note-dn-1',
        noteId: 'dn-1',
        type: 'debit_note',
        typeLabel: 'Debit Note',
        noteNumber: 'PDN-2026-001',
        partyName: 'Supplier Beta',
        totalAmount: 85,
      },
    ];
    return (
      <div data-testid="datagrid-mock">
        <div data-testid="header-actions">{headerActions}</div>
        <div data-testid="row-count">{data.length}</div>
        <div data-testid="rows">
          {data.map((row: any, idx: number) => (
            <div
              key={idx}
              data-testid={`history-row-${row.noteNumber}`}
              onClick={() => onRowClicked && onRowClicked(row)}
              className="cursor-pointer"
            >
              <span data-testid={`type-${row.noteNumber}`}>{row.typeLabel || (row.type === 'credit_note' ? 'Credit Note' : 'Debit Note')}</span>
              <span data-testid={`num-${row.noteNumber}`}>{row.noteNumber}</span>
              <span data-testid={`party-${row.noteNumber}`}>{row.partyName}</span>
              <span data-testid={`amount-${row.noteNumber}`}>{row.totalAmount}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
});

jest.mock('../CreateNoteSlideOver', () => {
  return function MockCreateNoteSlideOver({ isOpen }: any) {
    return isOpen ? <div data-testid="create-note-slideover">Create Note Modal</div> : null;
  };
});

jest.mock('../CreditNoteDetailSlideOver', () => {
  return function MockCreditNoteDetailSlideOver({ isOpen, creditNoteId }: any) {
    return isOpen ? (
      <div data-testid="credit-note-detail-slideover">
        Credit Note Detail: {creditNoteId}
      </div>
    ) : null;
  };
});

jest.mock('../DebitNoteDetailSlideOver', () => {
  return function MockDebitNoteDetailSlideOver({ isOpen, debitNoteId }: any) {
    return isOpen ? (
      <div data-testid="debit-note-detail-slideover">
        Debit Note Detail: {debitNoteId}
      </div>
    ) : null;
  };
});

describe('CreditDebitNotesPage — Unified Notes Ledger', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (api.salesCreditNotesControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        {
          creditNoteId: 'cn-1',
          creditNoteNumber: 'SCN-2026-001',
          customerName: 'Customer Alpha',
          customerNumber: 'CUST-001',
          createdOn: '2026-08-01T10:00:00Z',
          totalAmount: '120.00',
          stateCode: 'posted',
        },
      ],
    });

    (api.purchaseDebitNotesControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        {
          debitNoteId: 'dn-1',
          debitNoteNumber: 'PDN-2026-001',
          vendorName: 'Supplier Beta',
          vendorCode: 'SUP-001',
          createdOn: '2026-08-02T11:00:00Z',
          totalAmount: '85.00',
          stateCode: 'posted',
        },
      ],
    });
  });

  it('renders both Sales Credit Notes and Purchase Debit Notes in the unified history', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('num-SCN-2026-001')).toHaveTextContent('SCN-2026-001');
    expect(screen.getByTestId('type-SCN-2026-001')).toHaveTextContent('Credit Note');
    expect(screen.getByTestId('party-SCN-2026-001')).toHaveTextContent('Customer Alpha');

    expect(screen.getByTestId('num-PDN-2026-001')).toHaveTextContent('PDN-2026-001');
    expect(screen.getByTestId('type-PDN-2026-001')).toHaveTextContent('Debit Note');
    expect(screen.getByTestId('party-PDN-2026-001')).toHaveTextContent('Supplier Beta');
  });

  it('opens CreateNoteSlideOver when clicking Create Note button', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Create Note' })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Create Note' }));

    await waitFor(() => {
      expect(screen.getByTestId('create-note-slideover')).toBeInTheDocument();
    });
  });

  it('opens CreditNoteDetailSlideOver when clicking a credit note row', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('history-row-SCN-2026-001')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('history-row-SCN-2026-001'));

    await waitFor(() => {
      expect(screen.getByTestId('credit-note-detail-slideover')).toBeInTheDocument();
    });
    expect(screen.getByTestId('credit-note-detail-slideover')).toHaveTextContent('cn-1');
  });

  it('opens DebitNoteDetailSlideOver when clicking a debit note row', async () => {
    render(<CreditDebitNotesPage />);

    await waitFor(() => {
      expect(screen.getByTestId('history-row-PDN-2026-001')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('history-row-PDN-2026-001'));

    await waitFor(() => {
      expect(screen.getByTestId('debit-note-detail-slideover')).toBeInTheDocument();
    });
    expect(screen.getByTestId('debit-note-detail-slideover')).toHaveTextContent('dn-1');
  });
});
