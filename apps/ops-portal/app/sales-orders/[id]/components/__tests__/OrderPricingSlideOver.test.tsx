import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OrderPricingSlideOver } from '../OrderPricingSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
    useTranslations: () => {
        const fn = (key: string, params?: Record<string, unknown>) => {
            if (params?.product) return `${key}:${params.product}`;
            if (params?.page && params?.totalPages) return `Page ${params.page} of ${params.totalPages}`;
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

describe('OrderPricingSlideOver', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('fetches pricing history and renders customer-ranked rows', async () => {
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
                        discountPercentage: '5',
                        lineTotal: '228.00',
                        currencyCode: 'AUD',
                    },
                    {
                        salesOrderId: 'so-past-2',
                        orderNumber: 'SO-PAST-02',
                        orderDate: '2023-12-15',
                        customerId: 'cust-2',
                        customerName: 'Other Buyer',
                        isCurrentCustomer: false,
                        stateCode: 'shipped',
                        lineNumber: 2,
                        quantity: '20',
                        unitOfMeasure: 'EA',
                        pricePerUnit: '45.00',
                        discountPercentage: '0',
                        lineTotal: '900.00',
                        currencyCode: 'AUD',
                    },
                ],
                total: 2,
                page: 1,
                limit: 20,
            },
        });

        render(
            <OrderPricingSlideOver
                isOpen={true}
                onClose={jest.fn()}
                productId="prod-1"
                productNumber="WDG-001"
                productDescription="Widget Alpha"
                currentCustomerId="cust-1"
                currentCustomerName="ACME Corp"
                currentOrderId="so-001"
            />
        );

        await waitFor(() => {
            expect(api.ordersControllerGetProductPricingHistory).toHaveBeenCalledWith({
                productId: 'prod-1',
                customerId: 'cust-1',
                excludeOrderId: 'so-001',
                page: 1,
                limit: 20,
                customerOnly: undefined,
            });
        });

        // Current customer row
        expect(screen.getAllByText('pricing.thisCustomer')[0]).toBeInTheDocument();
        expect(screen.getAllByText('SO-PAST-01')[0]).toBeInTheDocument();
        expect(screen.getAllByText('AUD 48.00')[0]).toBeInTheDocument();
        expect(screen.getAllByText('5%')[0]).toBeInTheDocument();

        // Other customer row
        expect(screen.getAllByText('Other Buyer')[0]).toBeInTheDocument();
        expect(screen.getAllByText('SO-PAST-02')[0]).toBeInTheDocument();
        expect(screen.getAllByText('AUD 45.00')[0]).toBeInTheDocument();
    });

    it('toggles customer only filter', async () => {
        (api.ordersControllerGetProductPricingHistory as jest.Mock).mockResolvedValue({
            data: {
                data: [],
                total: 0,
                page: 1,
                limit: 20,
            },
        });

        render(
            <OrderPricingSlideOver
                isOpen={true}
                onClose={jest.fn()}
                productId="prod-1"
                productNumber="WDG-001"
                productDescription="Widget Alpha"
                currentCustomerId="cust-1"
                currentCustomerName="ACME Corp"
                currentOrderId="so-001"
            />
        );

        const checkbox = screen.getByRole('checkbox');
        expect(checkbox).not.toBeChecked();

        fireEvent.click(checkbox);
        expect(checkbox).toBeChecked();

        await waitFor(() => {
            expect(api.ordersControllerGetProductPricingHistory).toHaveBeenCalledWith({
                productId: 'prod-1',
                customerId: 'cust-1',
                excludeOrderId: 'so-001',
                page: 1,
                limit: 20,
                customerOnly: true,
            });
        });
    });
});
