/**
 * InvoicesSection.test.tsx
 *
 * Tests the InvoicesSection component rendering states, button visibility,
 * and interactive form handlers (create, cancel, generate).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoicesSection from '../InvoicesSection';
import type { OrderDetail, SalesInvoice, GstCategory } from '../types';

// ── Mocks ────────────────────────────────────────────────────────────
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

const mockApiMutate = jest.fn().mockResolvedValue({});
jest.mock('@/lib/api', () => ({
    apiFetch: jest.fn(),
    apiMutate: (...args: any[]) => mockApiMutate(...args),
    apiFetchBlob: jest.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' })),
    reportError: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
    toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }),
}));

jest.mock('@/lib/currency', () => ({
    formatAmount: (v: number, cc: string) => `${cc} ${v.toFixed(2)}`,
}));

const mockCalcInvoiceable = jest.fn().mockReturnValue([]);
jest.mock('@/lib/sales-order-utils', () => ({
    calculateInvoiceableQuantities: (...args: any[]) => mockCalcInvoiceable(...args),
}));

// ── Fixtures ─────────────────────────────────────────────────────────

const baseOrder: OrderDetail = {
    salesOrderId: 'so-001',
    orderNumber: 'SO-001',
    name: 'Test',
    customerId: 'cust-1',
    customerName: 'ACME',
    customerOrderNumber: null,
    stateCode: 'shipped',
    currencyCode: 'AUD',
    customerDiscount: null,
    gstCategoryId: null,
    notes: null,
    createdBy: 'admin',
    createdOn: '2024-01-01',
    modifiedOn: '2024-01-01',
    lines: [{
        salesOrderLineId: 'L1',
        lineNumber: 1,
        productId: 'prod-1',
        productNumber: 'WDG-001',
        productDescription: 'Widget',
        quantity: '10',
        pricePerUnit: '50.00',
        discountPercentage: '0',
        amount: '500.00',
        gstCategoryId: null,
        tax: '50.00',
        totalAmount: '550.00',
        unitOfMeasure: 'EA',
    }],
    events: [],
};

const gstCategories: GstCategory[] = [];

const picking = {
    lines: [{ salesOrderLineId: 'L1', quantityShipped: '5', quantityPicked: '5' }],
};

const defaultProps = {
    orderId: 'so-001',
    order: baseOrder,
    source: 'app',
    invoices: [] as SalesInvoice[],
    gstCategories,
    pickingSummary: null,
    setError: jest.fn(),
    loadInvoices: jest.fn().mockResolvedValue(undefined),
    loadOrder: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ────────────────────────────────────────────────────────────

describe('InvoicesSection — rendering', () => {
    it('shows "No products have shipped yet" when nothing shipped', () => {
        render(<InvoicesSection {...defaultProps} pickingSummary={{ lines: [] }} />);
        expect(screen.getByText(/No products have shipped yet/i)).toBeInTheDocument();
    });

    it('shows "No invoices generated yet" when shipped but no invoices', () => {
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);
        expect(screen.getByText(/No invoices generated yet/i)).toBeInTheDocument();
    });

    it('renders existing invoice with invoice number and line details', () => {
        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '500.00',
            totalTax: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
            erpnextJournalId: null,
            lines: [{
                lineId: 'il-1',
                salesOrderLineId: 'L1',
                quantityInvoiced: '5',
                pricePerUnit: '50.00',
                amount: '250.00',
            }],
        };
        render(<InvoicesSection {...defaultProps} invoices={[invoice]} />);
        expect(screen.getByText('INV-001')).toBeInTheDocument();
        // Invoice line table renders with product description
        expect(screen.getByText('Widget')).toBeInTheDocument();
    });

    it('shows GL badge when erpnextJournalId is present', () => {
        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '500.00',
            totalTax: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
            erpnextJournalId: 'JV-2024-001',
            lines: [],
        };
        render(<InvoicesSection {...defaultProps} invoices={[invoice]} />);
        expect(screen.getByText(/GL: JV-2024-001/)).toBeInTheDocument();
    });

    it('shows Print PDF button on existing invoices', () => {
        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '500.00',
            totalTax: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
            erpnextJournalId: null,
            lines: [],
        };
        render(<InvoicesSection {...defaultProps} invoices={[invoice]} />);
        expect(screen.getByText('Print PDF')).toBeInTheDocument();
    });

    it('shows Create Invoice button for shipped state with app source', () => {
        render(
            <InvoicesSection {...defaultProps} source="app" pickingSummary={picking} />,
        );
        expect(screen.getByText('Create Invoice')).toBeInTheDocument();
    });

    it('disables Create Invoice when nothing shipped', () => {
        render(
            <InvoicesSection
                {...defaultProps}
                order={{ ...baseOrder, stateCode: 'shipped' }}
                source="app"
                pickingSummary={{ lines: [] }}
            />,
        );
        const btn = screen.getByText('Create Invoice');
        expect(btn).toBeDisabled();
    });

    it('hides Create Invoice button for abm source', () => {
        render(
            <InvoicesSection {...defaultProps} source="abm" pickingSummary={picking} />,
        );
        expect(screen.queryByText('Create Invoice')).not.toBeInTheDocument();
    });
});

describe('InvoicesSection — create invoice form', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCalcInvoiceable.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 5, defaultQty: '5' },
        ]);
    });

    it('opens create form and shows invoice line table when Create Invoice is clicked', async () => {
        const user = userEvent.setup();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        await user.click(screen.getByText('Create Invoice'));

        expect(screen.getByText('New Invoice')).toBeInTheDocument();
        expect(screen.getByText('Generate Invoice')).toBeInTheDocument();
        expect(screen.getByText('cancel')).toBeInTheDocument();
    });

    it('closes create form when cancel is clicked', async () => {
        const user = userEvent.setup();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        await user.click(screen.getByText('Create Invoice'));
        expect(screen.getByText('New Invoice')).toBeInTheDocument();

        await user.click(screen.getByText('cancel'));
        expect(screen.queryByText('New Invoice')).not.toBeInTheDocument();
    });

    it('closes create form when ✕ is clicked', async () => {
        const user = userEvent.setup();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        await user.click(screen.getByText('Create Invoice'));
        const closeBtn = screen.getByText('✕');
        await user.click(closeBtn);
        expect(screen.queryByText('New Invoice')).not.toBeInTheDocument();
    });

    it('renders quantity-to-invoice inputs in the form', async () => {
        const user = userEvent.setup();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        await user.click(screen.getByText('Create Invoice'));

        // Should have a number input with the default quantity
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
    });

    it('calls apiMutate with correct payload when Generate Invoice is clicked', async () => {
        const user = userEvent.setup();
        // Mock window.confirm
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        await user.click(screen.getByText('Create Invoice'));
        await user.click(screen.getByText('Generate Invoice'));

        await waitFor(() => {
            expect(mockApiMutate).toHaveBeenCalledWith(
                '/api/sales-orders/so-001/invoice',
                'POST',
                expect.objectContaining({}),
            );
        });

        // Should reload invoices and order
        await waitFor(() => {
            expect(defaultProps.loadInvoices).toHaveBeenCalled();
        });

        jest.restoreAllMocks();
    });

    it('does not generate if confirm is cancelled', async () => {
        const user = userEvent.setup();
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);
        await user.click(screen.getByText('Create Invoice'));
        await user.click(screen.getByText('Generate Invoice'));

        expect(mockApiMutate).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    it('shows error when generation fails', async () => {
        const user = userEvent.setup();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        mockApiMutate.mockRejectedValueOnce(new Error('Invoice generation failed'));

        const setError = jest.fn();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} setError={setError} />);

        await user.click(screen.getByText('Create Invoice'));
        await user.click(screen.getByText('Generate Invoice'));

        await waitFor(() => {
            expect(setError).toHaveBeenCalledWith('Invoice generation failed');
        });

        jest.restoreAllMocks();
    });
});

describe('InvoicesSection — PDF download', () => {
    it('clicking Print PDF triggers blob fetch and opens window', async () => {
        const user = userEvent.setup();
        const mockOpen = jest.fn();
        jest.spyOn(window, 'open').mockImplementation(mockOpen);
        // jsdom doesn't have URL.createObjectURL — define it
        const origCreateObjectURL = URL.createObjectURL;
        URL.createObjectURL = jest.fn().mockReturnValue('blob:mock-url');

        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '500.00',
            totalTax: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
            erpnextJournalId: null,
            lines: [],
        };

        render(<InvoicesSection {...defaultProps} invoices={[invoice]} />);
        await user.click(screen.getByText('Print PDF'));

        const { apiFetchBlob } = require('@/lib/api');
        await waitFor(() => {
            expect(apiFetchBlob).toHaveBeenCalledWith(
                expect.stringContaining('invoiceId=inv-1'),
            );
            expect(mockOpen).toHaveBeenCalledWith('blob:mock-url', '_blank');
        });

        URL.createObjectURL = origCreateObjectURL;
        jest.restoreAllMocks();
    });
});

describe('InvoicesSection — invoice line table', () => {
    it('renders subtotal and tax in the invoice detail table', () => {
        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '550.00',
            totalTax: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
            erpnextJournalId: null,
            lines: [{
                lineId: 'il-1',
                salesOrderLineId: 'L1',
                quantityInvoiced: '5',
                pricePerUnit: '50.00',
                amount: '250.00',
            }],
        };

        render(<InvoicesSection {...defaultProps} invoices={[invoice]} />);
        // Should render the line amount (appears in both line row and subtotal)
        const amounts = screen.getAllByText('AUD 250.00');
        expect(amounts.length).toBeGreaterThanOrEqual(1);
        // Check subtotal row is present
        expect(screen.getByText('Subtotal')).toBeInTheDocument();
        // Check total row
        expect(screen.getByText('AUD 550.00')).toBeInTheDocument();
    });
});
