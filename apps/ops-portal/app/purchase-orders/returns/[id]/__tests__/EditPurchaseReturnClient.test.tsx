import { render, screen, waitFor } from '@testing-library/react';
import EditPurchaseReturnClient from '../EditPurchaseReturnClient';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  globalPurchaseReturnsControllerGetPurchaseReturnById: jest.fn(),
  purchaseReturnsControllerStageReturn: jest.fn(),
  purchaseReturnsControllerShipReturn: jest.fn(),
  purchaseReturnsControllerUnstageReturn: jest.fn(),
  purchaseReturnsControllerUnshipReturn: jest.fn(),
  purchaseReturnsControllerCancelReturn: jest.fn(),
}));

describe('EditPurchaseReturnClient — Shipped State & Debit Note Decoupling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does NOT render the inline debit note form or confirm debit note button when shipped without debit note', async () => {
    (api.globalPurchaseReturnsControllerGetPurchaseReturnById as jest.Mock).mockResolvedValue({
      data: {
        returnId: 'pr-123',
        returnNumber: 'PRET-001',
        purchaseOrderId: 'po-123',
        orderNumber: 'PO-1001',
        stateCode: 'shipped',
        vendorName: 'Acme Supplies',
        vendorId: 'vend-1',
        currencyCode: 'AUD',
        createdOn: '2026-08-01T00:00:00Z',
        lines: [
          {
            returnLineId: 'line-1',
            purchaseOrderLineId: 'pol-1',
            quantityReturned: '5',
            pricePerUnit: '10.00',
            productNumber: 'PROD-1',
            productDescription: 'Widget',
          },
        ],
      },
    });

    render(<EditPurchaseReturnClient id="pr-123" />);

    await waitFor(() => {
      expect(screen.getByText('PRET-001')).toBeInTheDocument();
    });

    // Debit note form should NOT be present
    expect(screen.queryByText('Create Purchase Debit Note')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm Debit Note')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('e.g. DN-2026-001')).not.toBeInTheDocument();

    // Informational message for pending finance reconciliation should be shown
    expect(
      screen.getByText(/Return has been shipped to supplier\. Pending Debit Note reconciliation/i),
    ).toBeInTheDocument();
  });

  it('renders the linked debit note card when a debit note exists for the return', async () => {
    (api.globalPurchaseReturnsControllerGetPurchaseReturnById as jest.Mock).mockResolvedValue({
      data: {
        returnId: 'pr-123',
        returnNumber: 'PRET-001',
        purchaseOrderId: 'po-123',
        orderNumber: 'PO-1001',
        stateCode: 'shipped',
        vendorName: 'Acme Supplies',
        vendorId: 'vend-1',
        currencyCode: 'AUD',
        createdOn: '2026-08-01T00:00:00Z',
        debitNoteId: 'dn-999',
        debitNoteNumber: 'PDN-2026-0099',
        debitNoteState: 'posted',
        lines: [],
      },
    });

    render(<EditPurchaseReturnClient id="pr-123" />);

    await waitFor(() => {
      expect(screen.getByText('PRET-001')).toBeInTheDocument();
    });

    // Should display the linked debit note reference in Debit Notes section
    expect(screen.getByText('Debit Notes')).toBeInTheDocument();
    const debitNoteLink = screen.getByRole('link', { name: /PDN-2026-0099/i });
    expect(debitNoteLink).toBeInTheDocument();
    expect(debitNoteLink).toHaveAttribute('href', '/purchase-debit-notes/dn-999');

    // Should NOT show the pending notice when debit note is already linked
    expect(
      screen.queryByText(/Return has been shipped to supplier\. Pending Debit Note reconciliation/i),
    ).not.toBeInTheDocument();
  });

  it('renders debit note net amount including tax and minus fees', async () => {
    (api.globalPurchaseReturnsControllerGetPurchaseReturnById as jest.Mock).mockResolvedValue({
      data: {
        returnId: 'pr-1572',
        returnNumber: 'PR 1572',
        purchaseOrderId: 'po-1572',
        orderNumber: 'Standalone Return - RAYWHI',
        stateCode: 'shipped',
        vendorName: 'RAY WHITE COMMERCIAL',
        vendorId: 'vend-raywhi',
        currencyCode: 'AUD',
        createdOn: '2024-12-01T00:00:00Z',
        debitNotes: [
          {
            debitNoteId: 'dn-1344',
            debitNoteNumber: 'PC 1344',
            stateCode: 'posted',
            totalAmount: '3411.65',
            taxAmount: '341.16',
            feeAmount: '0.00',
            createdOn: '2024-12-01T00:00:00Z',
          },
        ],
        lines: [],
      },
    });

    render(<EditPurchaseReturnClient id="pr-1572" />);

    await waitFor(() => {
      expect(screen.getByText('PR 1572')).toBeInTheDocument();
    });

    const debitNoteLink = screen.getByRole('link', { name: /PC 1344/i });
    expect(debitNoteLink).toBeInTheDocument();
    expect(debitNoteLink).toHaveAttribute('href', '/purchase-debit-notes/dn-1344');
    // Net Debit Total: 3411.65 + 341.16 = 3752.81
    expect(screen.getByText(/3,752\.81/)).toBeInTheDocument();
  });
});
