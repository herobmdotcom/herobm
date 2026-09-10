import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import FulfillmentSection from '../FulfillmentSection';
import type { OrderDetail } from '../types';
import * as api from '@herobm/sdk';

// ── Mocks ────────────────────────────────────────────────────────────
jest.mock('next-intl', () => ({
    useTranslations: (ns?: string) => (key: string) => `${ns ? ns + '.' : ''}${key}`,
}));

jest.mock('@herobm/sdk', () => ({
    orderPickingControllerGetShippingContext: jest.fn(),
}));

const mockGetShippingContext = api.orderPickingControllerGetShippingContext as jest.Mock;

const baseOrder: OrderDetail = {
    salesOrderId: 'so-100',
    orderNumber: 'SO-100',
    name: 'Test SO',
    customerId: 'cust-1',
    customerName: 'ACME',
    customerOrderNumber: null,
    stateCode: 'confirmed',
    currencyCode: 'EUR',
    notes: null,
    createdBy: 'admin',
    createdOn: '2026-01-01',
    modifiedOn: '2026-01-01',
    lines: [
        {
            salesOrderLineId: 'line-1',
            lineNumber: 1,
            productId: 'prod-1',
            productNumber: '103850',
            productDescription: 'RIAS2x1.1/2WD',
            quantity: '1',
            pricePerUnit: '10',
            discountPercentage: '0',
            amount: '10',
            taxCategoryId: null,
            tax: '0',
            totalAmount: '10',
            unitOfMeasure: 'EA',
        },
    ],
    events: [],
};

describe('FulfillmentSection', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('renders fulfillment table with correctly aligned column headers and line items', async () => {
        mockGetShippingContext.mockResolvedValue({
            data: {
                lines: [
                    {
                        salesOrderLineId: 'line-1',
                        lineNumber: 1,
                        productId: 'prod-1',
                        productNumber: '103850',
                        productDescription: 'RIAS2x1.1/2WD',
                        isPhysical: true,
                        isStocked: true,
                        quantity: '1',
                        quantityPicked: '1',
                        quantityShipped: '1',
                        availableToShip: '0',
                    },
                ],
                shipments: [],
            },
        });

        render(
            <FulfillmentSection
                orderId="so-100"
                pickingSummary={{
                    totalLines: 1,
                    fullyPickedLines: 1,
                    isFullyPicked: true,
                    lines: [
                        {
                            salesOrderLineId: 'line-1',
                            lineNumber: 1,
                            productId: 'prod-1',
                            productNumber: '103850',
                            productDescription: 'RIAS2x1.1/2WD',
                            quantity: '1',
                            quantityPicked: '1',
                            remaining: '0',
                            isFullyPicked: true,
                            isPhysical: true,
                            onHand: '3',
                        },
                    ],
                }}
                order={baseOrder}
            />
        );

        await waitFor(() => {
            expect(screen.getAllByText('103850').length).toBeGreaterThanOrEqual(1);
            expect(screen.getAllByText('RIAS2x1.1/2WD').length).toBeGreaterThanOrEqual(1);
        });

        const headers = screen.getAllByRole('columnheader');
        expect(headers).toHaveLength(8);

        // Check that numeric column headers have right alignment style and class
        const orderedHeader = headers.find((h) => h.textContent?.includes('columns.ordered'));
        expect(orderedHeader).toHaveClass('text-right');
        expect(orderedHeader).toHaveStyle('text-align: right');

        const pickedHeader = headers.find((h) => h.textContent?.includes('columns.picked'));
        expect(pickedHeader).toHaveClass('text-right');
        expect(pickedHeader).toHaveStyle('text-align: right');

        const onHandHeader = headers.find((h) => h.textContent?.includes('columns.onHand'));
        expect(onHandHeader).toHaveClass('text-right');
        expect(onHandHeader).toHaveStyle('text-align: right');

        const shippedHeader = headers.find((h) => h.textContent?.includes('columns.shipped'));
        expect(shippedHeader).toHaveClass('text-right');
        expect(shippedHeader).toHaveStyle('text-align: right');

        const readyToShipHeader = headers.find((h) => h.textContent?.includes('columns.readyToShip'));
        expect(readyToShipHeader).toHaveClass('text-right');
        expect(readyToShipHeader).toHaveStyle('text-align: right');
    });
});
