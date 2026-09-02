import { render, screen, waitFor } from '@testing-library/react';
import DebitNoteDetailContent from '../DebitNoteDetailContent';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    baseCurrency: 'AUD',
  }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  setSdkConfig: jest.fn(),
  purchaseDebitNotesControllerFindOne: jest.fn(),
  pdfTemplatesControllerRunHook: jest.fn(),
  pdfTemplatesControllerGetAssignments: jest.fn().mockResolvedValue({ data: [] }),
  macrosControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
  suppliersControllerFindOne: jest.fn().mockResolvedValue({ data: { contacts: [] } }),
}));

describe('DebitNoteDetailContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders debit note detail overview and PDF/Email action buttons', async () => {
    (api.purchaseDebitNotesControllerFindOne as jest.Mock).mockResolvedValue({
      data: {
        debitNoteId: 'dn-1',
        debitNoteNumber: 'PDN-20260821-0001',
        stateCode: 'posted',
        supplierReferenceNumber: 'INV-SUPP-555',
        totalAmount: '500.00',
        taxAmount: '50.00',
        feeAmount: '0.00',
        currencyCode: 'AUD',
        vendorId: 'vend-1',
        vendorName: 'Acme Parts Ltd',
        orderNumber: 'PO-1001',
        createdOn: '2026-08-21T00:00:00Z',
        lines: [
          {
            debitNoteLineId: 'line-1',
            purchaseOrderLineId: 'pol-1',
            quantityInvoiced: '5',
            pricePerUnit: '100.00',
            amount: '500.00',
            taxAmount: '50.00',
            productNumber: 'MOT-001',
            productDescription: 'Electric Motor',
          },
        ],
      },
    });

    render(<DebitNoteDetailContent id="dn-1" />);

    await waitFor(() => {
      expect(screen.getByText('PDN-20260821-0001')).toBeInTheDocument();
    });

    expect(screen.getByText('Acme Parts Ltd')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Print Debit Note/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Email Debit Note/i })).toBeInTheDocument();
  });
});
