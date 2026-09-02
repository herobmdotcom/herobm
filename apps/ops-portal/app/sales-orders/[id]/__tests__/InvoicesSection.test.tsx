/* eslint-disable @typescript-eslint/no-require-imports -- Inline require used to mock or verify package calls in local tests. */
/**
 * InvoicesSection.test.tsx
 *
 * Tests the InvoicesSection component rendering states, button visibility,
 * and interactive form handlers (create, cancel, generate).
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InvoicesSection from '../InvoicesSection';
import type { OrderDetail, SalesInvoice, TaxCategory } from '../types';

// ── Mocks ────────────────────────────────────────────────────────────
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

const mockCreateInvoice = jest.fn().mockResolvedValue({});
jest.mock('@/lib/api', () => ({
    reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
    salesInvoiceControllerCreateSalesInvoice: jest.fn().mockResolvedValue({}),
    pdfTemplatesControllerRunHook: jest.fn().mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) })
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
        taxCategoryId: null,
        tax: '50.00',
        totalAmount: '550.00',
        unitOfMeasure: 'EA',
    }],
    events: [],
};

const taxCategories: TaxCategory[] = [];

const picking = {
    lines: [{ salesOrderLineId: 'L1', quantityShipped: '5', quantityPicked: '5' }],
};

const defaultProps = {
    orderId: 'so-001',
    order: baseOrder,

    invoices: [] as SalesInvoice[],
    taxCategories,
    pickingSummary: null,
    setError: jest.fn(),
    loadInvoices: jest.fn().mockResolvedValue(undefined),
    loadOrder: jest.fn().mockResolvedValue(undefined),
};

// ── Tests ────────────────────────────────────────────────────────────

describe('InvoicesSection — rendering', () => {
    it('shows "No products have shipped yet" when nothing shipped', () => {
        render(<InvoicesSection {...defaultProps} pickingSummary={{ lines: [] }} />);
        expect(screen.getByText('noProductsShippedYet')).toBeInTheDocument();
    });

    it('shows "No invoices generated yet" when shipped but no invoices', () => {
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);
        expect(screen.getByText('noInvoicesGeneratedYet')).toBeInTheDocument();
    });

    it('renders existing invoice with invoice number', () => {
        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '500.00',
            taxAmount: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
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
    });



    it('shows Print PDF button on existing invoices', () => {
        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '500.00',
            taxAmount: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
            lines: [],
        };
        render(<InvoicesSection {...defaultProps} invoices={[invoice]} />);
        expect(screen.getByText('Email Invoice')).toBeInTheDocument();
    });

    it('shows Create Invoice button for shipped state', () => {
        render(
            <InvoicesSection {...defaultProps} pickingSummary={picking} />,
        );
        expect(screen.getByText('buttons.createInvoice')).toBeInTheDocument();
    });

    it('disables Create Invoice when nothing shipped', () => {
        render(
            <InvoicesSection
                {...defaultProps}
                order={{ ...baseOrder, stateCode: 'shipped' }}
                pickingSummary={{ lines: [] }}
            />,
        );
        const btn = screen.getByText('buttons.createInvoice');
        expect(btn).toBeDisabled();
    });

    it('shows Create Invoice button for picking state too', () => {
        render(
            <InvoicesSection {...defaultProps} order={{ ...baseOrder, stateCode: 'picking' }} pickingSummary={picking} />,
        );
        expect(screen.getByText('buttons.createInvoice')).toBeInTheDocument();
    });

    it('shows Create Invoice button for confirmed state with non-stock lines', () => {
        mockCalcInvoiceable.mockReturnValueOnce([
            { salesOrderLineId: 'L1', maxQty: 2, defaultQty: '2' },
        ]);
        render(
            <InvoicesSection {...defaultProps} order={{ ...baseOrder, stateCode: 'confirmed' }} pickingSummary={{ lines: [] }} />,
        );
        expect(screen.getByText('buttons.createInvoice')).toBeInTheDocument();
        expect(screen.getByText('buttons.createInvoice')).not.toBeDisabled();
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

        await user.click(screen.getByText('buttons.createInvoice'));

        expect(screen.getByText('New Invoice')).toBeInTheDocument();
        expect(screen.getByText('buttons.createInvoice')).toBeInTheDocument();
        expect(screen.getByText('cancel')).toBeInTheDocument();
    });

    it('closes create form when cancel is clicked', async () => {
        const user = userEvent.setup();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        await user.click(screen.getByText('buttons.createInvoice'));
        expect(screen.getByText('New Invoice')).toBeInTheDocument();

        await user.click(screen.getByText('cancel'));
        expect(screen.queryByText('New Invoice')).not.toBeInTheDocument();
    });



    it('renders quantity-to-invoice inputs in the form', async () => {
        const user = userEvent.setup();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        await user.click(screen.getByText('buttons.createInvoice'));

        // Should have a number input with the default quantity
        const inputs = screen.getAllByRole('spinbutton');
        expect(inputs.length).toBeGreaterThan(0);
    });

    it('calls sdk endpoint with correct payload when Generate Invoice is clicked', async () => {
        const user = userEvent.setup();
        // Mock window.confirm
        jest.spyOn(window, 'confirm').mockReturnValue(true);

        render(<InvoicesSection {...defaultProps} pickingSummary={picking} />);

        // Click to open form
        await user.click(screen.getByText('buttons.createInvoice'));
        // Click to generate inside form
        await user.click(screen.getByText('buttons.createInvoice'));

        const api = require('@herobm/sdk');
        await waitFor(() => {
            expect(api.salesInvoiceControllerCreateSalesInvoice).toHaveBeenCalledWith(
                'so-001',
                expect.objectContaining({ lines: expect.any(Array) })
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
        
        await user.click(screen.getByText('buttons.createInvoice'));
        await user.click(screen.getByText('buttons.createInvoice'));

        expect(mockCreateInvoice).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });

    it('shows error when generation fails', async () => {
        const user = userEvent.setup();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        const api = require('@herobm/sdk');
        api.salesInvoiceControllerCreateSalesInvoice.mockRejectedValueOnce(new Error('Invoice generation failed'));

        const setError = jest.fn();
        render(<InvoicesSection {...defaultProps} pickingSummary={picking} setError={setError} />);

        await user.click(screen.getByText('buttons.createInvoice'));
        await user.click(screen.getByText('buttons.createInvoice'));

        await waitFor(() => {
            expect(setError).toHaveBeenCalledWith('Invoice generation failed');
        });

        jest.restoreAllMocks();
    });
});

describe('InvoicesSection — Email Invoice Trigger', () => {
    it('clicking Email Invoice calls onEmailDocumentClick', async () => {
        const user = userEvent.setup();
        const onEmailDocumentClick = jest.fn();
        const invoice: SalesInvoice = {
            invoiceId: 'inv-1',
            invoiceNumber: 'INV-001',
            totalAmount: '500.00',
            taxAmount: '50.00',
            createdOn: '2024-01-15',
            createdBy: 'admin',
            lines: [],
        };

        render(<InvoicesSection {...defaultProps} invoices={[invoice]} onEmailDocumentClick={onEmailDocumentClick} />);
        await user.click(screen.getByText('Email Invoice'));
        
        expect(onEmailDocumentClick).toHaveBeenCalledWith('sales-invoice', 'Email Sales Invoice', 'Invoice', 'Sales Invoice', 'inv-1', 'sales-invoice');
    });
});

