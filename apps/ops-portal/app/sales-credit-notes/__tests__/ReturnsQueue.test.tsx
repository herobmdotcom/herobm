import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReturnsQueuePage from '../page';
import * as api from '@herobm/sdk';

jest.mock('@herobm/sdk', () => ({
  globalReturnsControllerFindGlobalReturns: jest.fn(),
  globalPurchaseReturnsControllerGetPurchaseReturns: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

// Mock DataGrid
jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid({ rowData, onRowClicked }: any) {
    return (
      <div data-testid="datagrid-mock">
        <div data-testid="row-count">{rowData?.length || 0}</div>
        <div data-testid="rows">
          {rowData?.map((row: any, idx: number) => (
            <div
              key={idx}
              data-testid={`return-row-${row.returnNumber}`}
              onClick={() => onRowClicked && onRowClicked(row)}
              className="cursor-pointer"
            >
              <span data-testid={`type-${row.returnNumber}`}>{row.typeLabel}</span>
              <span data-testid={`num-${row.returnNumber}`}>{row.returnNumber}</span>
              <span data-testid={`party-${row.returnNumber}`}>{row.partyName}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
});

jest.mock('../AdHocCreditNoteSlideOver', () => {
  return function MockAdHocSlideOver({ isOpen }: any) {
    return isOpen ? <div data-testid="adhoc-slideover">AdHoc SlideOver</div> : null;
  };
});

jest.mock('../ReturnCreditNoteSlideOver', () => {
  return function MockReturnCreditNoteSlideOver({ isOpen, returnRecord }: any) {
    return isOpen ? (
      <div data-testid="customer-credit-slideover">
        Customer Credit: {returnRecord?.returnNumber}
      </div>
    ) : null;
  };
});

jest.mock('../ReturnDebitNoteSlideOver', () => {
  return function MockReturnDebitNoteSlideOver({ isOpen, returnRecord }: any) {
    return isOpen ? (
      <div data-testid="supplier-debit-slideover">
        Supplier Debit: {returnRecord?.returnNumber}
      </div>
    ) : null;
  };
});

describe('ReturnsQueuePage — Unified Returns Queue', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (api.globalReturnsControllerFindGlobalReturns as jest.Mock).mockResolvedValue({
      data: [
        {
          returnId: 'sr-1',
          returnNumber: 'RET-001',
          salesOrderId: 'so-1',
          orderNumber: 'SO-100',
          customerNumber: 'CUST-001',
          customerName: 'Customer One',
          createdOn: '2026-08-01T10:00:00Z',
          stateCode: 'received',
          lines: [{ lineId: '1', putawayStatus: 'completed' }],
        },
      ],
    });

    (api.globalPurchaseReturnsControllerGetPurchaseReturns as jest.Mock).mockResolvedValue({
      data: [
        {
          returnId: 'pr-1',
          returnNumber: 'PRET-001',
          purchaseOrderId: 'po-1',
          orderNumber: 'PO-200',
          vendorName: 'Supplier One',
          vendorCode: 'SUP-001',
          createdOn: '2026-08-02T11:00:00Z',
          stateCode: 'shipped',
          lines: [{ lineId: '2' }],
        },
      ],
    });
  });

  it('renders both Customer Returns and Supplier Returns in the same queue', async () => {
    render(<ReturnsQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('row-count')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('num-RET-001')).toHaveTextContent('RET-001');
    expect(screen.getByTestId('type-RET-001')).toHaveTextContent('Customer Return');
    expect(screen.getByTestId('party-RET-001')).toHaveTextContent('Customer One');

    expect(screen.getByTestId('num-PRET-001')).toHaveTextContent('PRET-001');
    expect(screen.getByTestId('type-PRET-001')).toHaveTextContent('Supplier Return');
    expect(screen.getByTestId('party-PRET-001')).toHaveTextContent('Supplier One');
  });

  it('opens ReturnCreditNoteSlideOver when a customer return row is clicked', async () => {
    render(<ReturnsQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('return-row-RET-001')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('return-row-RET-001'));

    await waitFor(() => {
      expect(screen.getByTestId('customer-credit-slideover')).toBeInTheDocument();
    });
    expect(screen.getByTestId('customer-credit-slideover')).toHaveTextContent('RET-001');
  });

  it('opens ReturnDebitNoteSlideOver when a supplier return row is clicked', async () => {
    render(<ReturnsQueuePage />);

    await waitFor(() => {
      expect(screen.getByTestId('return-row-PRET-001')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByTestId('return-row-PRET-001'));

    await waitFor(() => {
      expect(screen.getByTestId('supplier-debit-slideover')).toBeInTheDocument();
    });
    expect(screen.getByTestId('supplier-debit-slideover')).toHaveTextContent('PRET-001');
  });
});
