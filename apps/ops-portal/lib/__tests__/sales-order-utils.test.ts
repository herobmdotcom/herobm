import {
    calculateInvoiceableQuantities,
    convertFeeMode,
} from '../sales-order-utils';
import type { OrderLine, SalesInvoice } from '@/app/sales-orders/[id]/types';
import type { PickingLine } from '../sales-order-utils';

/* ── Helpers ─────────────────────────────────────────────────────── */

function makeLine(overrides: Partial<OrderLine> & { salesOrderLineId: string }): OrderLine {
    return {
        lineNumber: 1,
        productId: 'prod-1',
        productDescription: 'Widget',
        quantity: '10',
        pricePerUnit: '100',
        discountPercentage: '0',
        amount: '1000',
        gstCategoryId: null,
        tax: '0',
        totalAmount: '1000',
        unitOfMeasure: 'EA',
        ...overrides,
    };
}

function makeInvoice(
    lines: { salesOrderLineId: string; quantityInvoiced: string }[],
): SalesInvoice {
    return {
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-001',
        totalAmount: '0',
        taxAmount: '0',
        createdOn: '2024-01-01',
        createdBy: 'test',
        lines: lines.map((l) => ({
            lineId: `line-${l.salesOrderLineId}`,
            salesOrderLineId: l.salesOrderLineId,
            quantityInvoiced: l.quantityInvoiced,
        })),
    };
}

/* ── calculateInvoiceableQuantities ──────────────────────────────── */

describe('calculateInvoiceableQuantities', () => {
    it('returns maxQty = shipped when nothing invoiced', () => {
        const lines = [makeLine({ salesOrderLineId: 'L1' })];
        const picking: PickingLine[] = [
            { salesOrderLineId: 'L1', quantityShipped: '5' },
        ];

        const result = calculateInvoiceableQuantities(lines, [], picking);

        expect(result).toEqual([
            { salesOrderLineId: 'L1', maxQty: 5, defaultQty: '5' },
        ]);
    });

    it('subtracts already-invoiced quantities across multiple invoices', () => {
        const lines = [makeLine({ salesOrderLineId: 'L1' })];
        const invoices = [
            makeInvoice([{ salesOrderLineId: 'L1', quantityInvoiced: '2' }]),
            makeInvoice([{ salesOrderLineId: 'L1', quantityInvoiced: '1' }]),
        ];
        const picking: PickingLine[] = [
            { salesOrderLineId: 'L1', quantityShipped: '5' },
        ];

        const result = calculateInvoiceableQuantities(lines, invoices, picking);

        expect(result).toEqual([
            { salesOrderLineId: 'L1', maxQty: 2, defaultQty: '2' },
        ]);
    });

    it('clamps to zero and excludes fully-invoiced lines', () => {
        const lines = [makeLine({ salesOrderLineId: 'L1' })];
        const invoices = [
            makeInvoice([{ salesOrderLineId: 'L1', quantityInvoiced: '5' }]),
        ];
        const picking: PickingLine[] = [
            { salesOrderLineId: 'L1', quantityShipped: '5' },
        ];

        const result = calculateInvoiceableQuantities(lines, invoices, picking);

        expect(result).toEqual([]); // maxQty = 0, filtered out
    });

    it('handles null/missing picking data', () => {
        const lines = [makeLine({ salesOrderLineId: 'L1' })];

        const result = calculateInvoiceableQuantities(lines, [], null);

        expect(result).toEqual([]); // shippedQty = 0, so maxQty = 0
    });

    it('handles multiple order lines', () => {
        const lines = [
            makeLine({ salesOrderLineId: 'L1' }),
            makeLine({ salesOrderLineId: 'L2' }),
        ];
        const invoices = [
            makeInvoice([
                { salesOrderLineId: 'L1', quantityInvoiced: '3' },
            ]),
        ];
        const picking: PickingLine[] = [
            { salesOrderLineId: 'L1', quantityShipped: '5' },
            { salesOrderLineId: 'L2', quantityShipped: '10' },
        ];

        const result = calculateInvoiceableQuantities(lines, invoices, picking);

        expect(result).toEqual([
            { salesOrderLineId: 'L1', maxQty: 2, defaultQty: '2' },
            { salesOrderLineId: 'L2', maxQty: 10, defaultQty: '10' },
        ]);
    });
});

/* ── convertFeeMode ──────────────────────────────────────────────── */

describe('convertFeeMode', () => {
    it('converts absolute $50 to percentage of $1000 → 5.0%', () => {
        expect(convertFeeMode('50', 1000, 'absolute', 'percentage')).toBe('5.0');
    });

    it('converts percentage 5% of $1000 → $50.00', () => {
        expect(convertFeeMode('5', 1000, 'percentage', 'absolute')).toBe('50.00');
    });

    it('returns same value when modes are equal', () => {
        expect(convertFeeMode('50', 1000, 'absolute', 'absolute')).toBe('50');
    });

    it('handles zero original amount (absolute → percentage)', () => {
        expect(convertFeeMode('50', 0, 'absolute', 'percentage')).toBe('0');
    });

    it('handles empty fee string', () => {
        expect(convertFeeMode('', 1000, 'absolute', 'percentage')).toBe('0.0');
    });

    it('handles fractional percentages', () => {
        expect(convertFeeMode('33.33', 300, 'percentage', 'absolute')).toBe('99.99');
    });
});
