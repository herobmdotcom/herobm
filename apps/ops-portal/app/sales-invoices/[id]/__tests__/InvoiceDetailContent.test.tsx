import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoiceDetailContent from '../InvoiceDetailContent';
import { useSalesInvoice } from '../useSalesInvoice';
import { SALES_INVOICE_STATE } from '@herobm/shared';

jest.mock('../useSalesInvoice', () => ({
    useSalesInvoice: jest.fn()
}));

jest.mock('next-intl', () => ({
    useTranslations: () => {
        const t = (key: string) => key;
        t.has = () => true;
        return t;
    }
}));

jest.mock('next/navigation', () => ({
    useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/components/AuthGate', () => ({
    useAuth: () => ({ permissions: [{ resource: 'gl', action: 'write' }] }),
}));

jest.mock('@/components/SettingsProvider', () => ({
    useSettings: () => ({ baseCurrency: 'USD' }),
}));

const mockInvoiceDetailControllerChangeSalesInvoiceState = jest.fn().mockResolvedValue({});
const mockInvoiceDetailControllerAdminMarkSalesInvoicePaid = jest.fn().mockResolvedValue({});
const mockPdfTemplatesControllerRunHook = jest.fn().mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) });
jest.mock('@herobm/sdk', () => ({
    __esModule: true,
    setSdkConfig: jest.fn(),
    invoiceDetailControllerChangeSalesInvoiceState: (...args: any[]) => mockInvoiceDetailControllerChangeSalesInvoiceState(...args),
    invoiceDetailControllerAdminMarkSalesInvoicePaid: (...args: any[]) => mockInvoiceDetailControllerAdminMarkSalesInvoicePaid(...args),
    pdfTemplatesControllerRunHook: (...args: any[]) => mockPdfTemplatesControllerRunHook(...args),
    contactsControllerListContacts: jest.fn().mockResolvedValue({ data: [] }),
    macroControllerGetMacrosByContext: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
    useDocumentTitle: jest.fn(),
}));

describe('InvoiceDetailContent', () => {
    beforeAll(() => {
        Object.defineProperty(Object.getPrototypeOf(window.location), 'reload', {
            configurable: true,
            writable: true,
            value: jest.fn(),
        });
        window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/blob');
        window.open = jest.fn();
    });

    beforeEach(() => {
        jest.clearAllMocks();
        // Mock window.confirm
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        (useSalesInvoice as jest.Mock).mockReturnValue({
            invoice: {
                invoiceId: 'inv-1',
                invoiceNumber: 'INV-001',
                salesOrderId: 'so-1',
                orderNumber: 'SO-001',
                stateCode: SALES_INVOICE_STATE.INVOICED,
                customerId: 'cust-1',
                customerName: 'ACME Corp',
                currencyCode: 'USD',
                createdOn: '2024-01-01T00:00:00Z',
                totalAmount: '100',
                taxAmount: '10',
                outstandingAmount: '100',
                lines: [
                    {
                        lineId: 'line-1',
                        productId: 'prod-1',
                        productNumber: 'PROD-1',
                        quantityInvoiced: '1',
                        pricePerUnit: '90',
                        amount: '90'
                    }
                ],
                allocations: [],
                events: []
            },
            loading: false,
            error: null,
        });
    });

    it('renders invoice details', () => {
        render(<InvoiceDetailContent id="inv-1" />);
        expect(screen.getByText('INV-001')).toBeInTheDocument();
        expect(screen.getByText('ACME Corp')).toBeInTheDocument();
        expect(screen.getAllByText('PROD-1').length).toBeGreaterThan(0);
    });

    it('allows cancelling invoice', async () => {
        const user = userEvent.setup();
        render(<InvoiceDetailContent id="inv-1" />);
        
        const cancelBtn = screen.getByText('cancel');
        await user.click(cancelBtn);

        expect(mockInvoiceDetailControllerChangeSalesInvoiceState).toHaveBeenCalledWith('inv-1', {
            stateCode: SALES_INVOICE_STATE.CANCELLED
        });
    });

    it('allows marking invoice as paid', async () => {
        const user = userEvent.setup();
        render(<InvoiceDetailContent id="inv-1" />);
        
        const markPaidBtn = screen.getByText('markPaid');
        await user.click(markPaidBtn);

        expect(mockInvoiceDetailControllerAdminMarkSalesInvoicePaid).toHaveBeenCalledWith('inv-1', {});
    });

    it('allows printing invoice PDF via print dialog', async () => {
        const user = userEvent.setup();

        render(<InvoiceDetailContent id="inv-1" />);
        
        const printBtn = screen.getAllByText('printInvoice')[0];
        await user.click(printBtn);

        // Dialog should be open with Print Sales Invoice title and Print PDF button
        expect(screen.getByText('Print Sales Invoice')).toBeInTheDocument();
        const submitPrintBtn = screen.getByRole('button', { name: /buttons\.printPdf/i });
        await user.click(submitPrintBtn);

        await waitFor(() => {
            expect(mockPdfTemplatesControllerRunHook).toHaveBeenCalledWith('sales-invoice', { customPdfText: '' }, {
                id: 'inv-1',
                context: 'sales-invoice',
            });
        });
        expect(window.open).toHaveBeenCalledWith('blob:http://localhost/blob', '_blank');
    });
});
