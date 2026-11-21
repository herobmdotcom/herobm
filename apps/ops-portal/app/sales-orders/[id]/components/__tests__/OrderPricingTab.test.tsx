import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OrderPricingTab } from '../OrderPricingTab';
import type { OrderDetail } from '../../types';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
    useTranslations: () => {
        const fn = (key: string, params?: Record<string, unknown>) => {
            if (params?.count !== undefined) return `${key}:${params.count}`;
            return key;
        };
        fn.has = () => true;
        return fn;
    },
}));

jest.mock('@/lib/api', () => ({
    reportError: jest.fn(),
}));

jest.mock('@/lib/currency', () => ({
    formatAmount: (v: number, cc: string) => `${cc} ${v.toFixed(2)}`,
}));

jest.mock('@/lib/date', () => ({
    formatLocalDate: (d: string) => d,
}));

jest.mock('@herobm/sdk', () => ({
    ordersControllerGetProductPricingHistory: jest.fn(),
}));

const mockOrder: OrderDetail = {
    salesOrderId: 'so-001',
    orderNumber: 'SO-001',
    name: 'Test Order',
    customerId: 'cust-1',
    customerName: 'ACME Corp',
    customerOrderNumber: 'PO-123',
    stateCode: 'draft',
    currencyCode: 'AUD',
    notes: null,
    createdBy: 'admin',
    createdOn: '2024-01-01',
    modifiedOn: '2024-01-01',
    lines: [
        {
            salesOrderLineId: 'line-1',
            lineNumber: 1,
            productId: 'prod-1',
            productNumber: 'WDG-001',
            productDescription: 'Widget Alpha',
            quantity: '10',
            pricePerUnit: '50.00',
            discountPercentage: '0',
            amount: '500.00',
            taxCategoryId: null,
            tax: '50.00',
            totalAmount: '550.00',
            unitOfMeasure: 'EA',
        },
        {
            salesOrderLineId: 'line-2',
            lineNumber: 2,
            productId: null,
            productNumber: undefined,
            productDescription: 'Custom Service Line',
            quantity: '1',
            pricePerUnit: '100.00',
            discountPercentage: '0',
            amount: '100.00',
            taxCategoryId: null,
            tax: '10.00',
            totalAmount: '110.00',
            unitOfMeasure: 'HR',
        },
    ],
    events: [],
};

describe('OrderPricingTab', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders separate columns for product and description without total amount under price', async () => {
        (api.ordersControllerGetProductPricingHistory as jest.Mock).mockResolvedValue({
            data: {
                data: [
                    {
                        salesOrderId: 'so-past-1',
                        orderNumber: 'SO-PAST-01',
                        orderDate: '2024-01-01',
                        customerId: 'cust-1',
                        customerName: 'ACME Corp',
                        isCurrentCustomer: true,
                        stateCode: 'confirmed',
                        lineNumber: 1,
                        quantity: '5',
                        unitOfMeasure: 'EA',
                        pricePerUnit: '48.00',
                        discountPercentage: '0',
                        lineTotal: '240.00',
                        currencyCode: 'AUD',
                    },
                ],
                total: 1,
                page: 1,
                limit: 3,
            },
        });

        render(<OrderPricingTab order={mockOrder} />);

        // Verify product and description exist in separate cells
        expect(screen.getAllByText('WDG-001')[0]).toBeInTheDocument();
        expect(screen.getAllByText('Widget Alpha')[0]).toBeInTheDocument();

        // Verify current price is formatted as AUD 50.00 @ 10 EA
        expect(screen.getAllByText('AUD 50.00 @ 10 EA')[0]).toBeInTheDocument();

        // Ensure no "totalAmount" string or 550.00 is rendered under current price
        expect(screen.queryByText(/columns\.totalAmount/i)).not.toBeInTheDocument();

        // Wait for recent order to load
        await waitFor(() => {
            expect(screen.getAllByText('SO-PAST-01')[0]).toBeInTheDocument();
        });

        expect(screen.getAllByText('AUD 48.00 @ 5 EA')[0]).toBeInTheDocument();
        expect(screen.getAllByText('pricing.thisCustomer')[0]).toBeInTheDocument();

        // Verify View All button text and no Material symbol
        const viewAllBtns = screen.getAllByRole('button', { name: /pricing\.viewAllWithCount:1/i });
        expect(viewAllBtns.length).toBeGreaterThan(0);
        expect(viewAllBtns[0].querySelector('.material-symbols-outlined')).toBeNull();
    });

    it('opens slideover when View All button is clicked', async () => {
        (api.ordersControllerGetProductPricingHistory as jest.Mock).mockResolvedValue({
            data: {
                data: [],
                total: 0,
                page: 1,
                limit: 3,
            },
        });

        render(<OrderPricingTab order={mockOrder} />);

        await waitFor(() => {
            expect(api.ordersControllerGetProductPricingHistory).toHaveBeenCalledWith({
                productId: 'prod-1',
                customerId: 'cust-1',
                excludeOrderId: 'so-001',
                page: 1,
                limit: 3,
            });
        });

        const viewAllBtn = screen.getAllByRole('button', { name: /pricing\.viewAllWithCount:0/i })[0];
        fireEvent.click(viewAllBtn);

        // Slideover opens and fetches history
        await waitFor(() => {
            expect(api.ordersControllerGetProductPricingHistory).toHaveBeenCalledWith(
                expect.objectContaining({
                    productId: 'prod-1',
                    limit: 20,
                })
            );
        });
    });
});
