import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ShipmentsSection from '../ShipmentsSection';
import type { OrderDetail } from '../types';
import * as api from '@herobm/sdk';
import {
    calculateShippableQuantities,
    calculatePickAndShipQuantities,
} from '@/lib/sales-order-utils';

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('next-intl', () => ({
    useTranslations: (ns?: string) => Object.assign(
        (key: string, params?: Record<string, unknown>) => {
            if (params && 'count' in params) return `${params.count} lines`;
            return key;
        },
        { has: () => true }
    ),
}));

jest.mock('react-hot-toast', () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
    },
}));

jest.mock('@/lib/api', () => ({
    reportError: jest.fn(),
    getErrorMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}));

jest.mock('@herobm/sdk', () => ({
    orderShipmentsControllerFindShipments: jest.fn(),
    orderShipmentsControllerCreateShipment: jest.fn(),
    ordersControllerFulfillDirectOrder: jest.fn(),
}));

jest.mock('@/lib/sales-order-utils', () => {
    const actual = jest.requireActual('@/lib/sales-order-utils');
    return {
        ...actual,
        calculateShippableQuantities: jest.fn(),
        calculatePickAndShipQuantities: jest.fn(),
    };
});

const mockCalcShippable = calculateShippableQuantities as jest.MockedFunction<
    typeof calculateShippableQuantities
>;
const mockCalcPickAndShip = calculatePickAndShipQuantities as jest.MockedFunction<
    typeof calculatePickAndShipQuantities
>;

// ── Fixtures ─────────────────────────────────────────────────────────

const baseOrder: OrderDetail = {
    salesOrderId: 'so-1',
    orderNumber: 'SO-0001',
    name: 'Test Order',
    customerId: 'cust-1',
    customerName: 'Acme Corp',
    customerOrderNumber: 'PO-123',
    stateCode: 'confirmed',
    currencyCode: 'AUD',
    notes: '',
    createdBy: 'admin',
    createdOn: '2024-01-01',
    modifiedOn: '2024-01-01',
    lines: [
        {
            salesOrderLineId: 'L1',
            lineNumber: 1,
            productId: 'prod-1',
            productNumber: 'NS-001',
            productDescription: 'Non-stock hardware',
            productType: 'non-stock',
            quantity: '3',
            pricePerUnit: '100.00',
            discountPercentage: '0',
            amount: '300.00',
            taxCategoryId: null,
            tax: '30.00',
            totalAmount: '330.00',
            unitOfMeasure: 'EA',
        },
    ],
    events: [],
};

const defaultProps = {
    orderId: 'so-1',
    order: baseOrder,
    pickingSummary: { lines: [] },
    loadOrder: jest.fn(),
    setError: jest.fn(),
};

describe('ShipmentsSection — rendering & permissions', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api.orderShipmentsControllerFindShipments as jest.Mock).mockResolvedValue({
            data: [],
        });
        mockCalcShippable.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
        mockCalcPickAndShip.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
    });

    it('shows Create Shipment and Pick & Ship buttons for confirmed order with shippable lines', async () => {
        render(React.createElement(ShipmentsSection, defaultProps));
        await waitFor(() => {
            expect(screen.getByText('buttons.createShipment')).toBeInTheDocument();
            expect(screen.getByText('buttons.pickAndShip')).toBeInTheDocument();
        });
        expect(screen.getByText('buttons.createShipment')).not.toBeDisabled();
        expect(screen.getByText('buttons.pickAndShip')).not.toBeDisabled();
    });

    it('disables buttons when order has no shippable lines', async () => {
        mockCalcShippable.mockReturnValue([]);
        mockCalcPickAndShip.mockReturnValue([]);
        render(React.createElement(ShipmentsSection, defaultProps));
        await waitFor(() => {
            expect(screen.getByText('buttons.createShipment')).toBeInTheDocument();
            expect(screen.getByText('buttons.pickAndShip')).toBeInTheDocument();
        });
        expect(screen.getByText('buttons.createShipment')).toBeDisabled();
        expect(screen.getByText('buttons.pickAndShip')).toBeDisabled();
    });

    it('shows existing shipment in the list', async () => {
        (api.orderShipmentsControllerFindShipments as jest.Mock).mockResolvedValue({
            data: [
                {
                    shipmentId: 'ship-1',
                    shipmentNumber: 'SHP-20260901-0001',
                    stateCode: 'dispatched',
                    trackingNumber: 'TRACK-999',
                    createdOn: '2026-09-01T10:00:00Z',
                    createdBy: 'admin',
                    lines: [{ shipmentLineId: 'sl-1', salesOrderLineId: 'L1', quantityShipped: '3' }],
                },
            ],
        });

        render(React.createElement(ShipmentsSection, defaultProps));
        await waitFor(() => {
            expect(screen.getByText('SHP-20260901-0001')).toBeInTheDocument();
        });
    });
});

describe('ShipmentsSection — create shipment form & dispatch', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api.orderShipmentsControllerFindShipments as jest.Mock).mockResolvedValue({
            data: [],
        });
        (api.orderShipmentsControllerCreateShipment as jest.Mock).mockResolvedValue({
            data: { shipmentId: 'ship-new' },
        });
        mockCalcShippable.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
        mockCalcPickAndShip.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
    });

    it('opens creation form, accepts tracking info, delivery instructions and calls API', async () => {
        const user = userEvent.setup();
        const loadOrder = jest.fn().mockResolvedValue(undefined);
        const orderWithNotes: OrderDetail = {
            ...baseOrder,
            shippingNotes: 'Default instructions',
        };
        render(React.createElement(ShipmentsSection, { ...defaultProps, order: orderWithNotes, loadOrder }));

        await waitFor(() => {
            expect(screen.getByText('buttons.createShipment')).toBeInTheDocument();
        });

        await user.click(screen.getByText('buttons.createShipment'));

        expect(screen.getByPlaceholderText('deliveryInstructions')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('deliveryInstructions')).toHaveValue('Default instructions');
        expect(screen.getByPlaceholderText('placeholders.tracking')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('placeholders.shipmentNotes')).toBeInTheDocument();

        await user.clear(screen.getByPlaceholderText('deliveryInstructions'));
        await user.type(screen.getByPlaceholderText('deliveryInstructions'), 'Updated dock 3');
        await user.type(screen.getByPlaceholderText('placeholders.tracking'), 'TRACK-12345');
        await user.type(screen.getByPlaceholderText('placeholders.shipmentNotes'), 'Drop-shipped from vendor');

        const submitButtons = screen.getAllByText('buttons.createShipment');
        const submitBtn = submitButtons[submitButtons.length - 1];
        await user.click(submitBtn);

        await waitFor(() => {
            expect(api.orderShipmentsControllerCreateShipment).toHaveBeenCalledWith(
                'so-1',
                expect.objectContaining({
                    trackingNumber: 'TRACK-12345',
                    notes: 'Drop-shipped from vendor',
                    shippingNotes: 'Updated dock 3',
                    lines: [{ salesOrderLineId: 'L1', quantityShipped: '3' }],
                }),
            );
        });

        expect(loadOrder).toHaveBeenCalled();
    });

    it('shows delivery instructions input even when order has no shippingNotes', async () => {
        const user = userEvent.setup();
        render(React.createElement(ShipmentsSection, defaultProps));

        await waitFor(() => {
            expect(screen.getByText('buttons.createShipment')).toBeInTheDocument();
        });

        await user.click(screen.getByText('buttons.createShipment'));

        expect(screen.getByPlaceholderText('deliveryInstructions')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('deliveryInstructions')).toHaveValue('');
    });
});

describe('ShipmentsSection — pick & ship form & fulfill direct', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (api.orderShipmentsControllerFindShipments as jest.Mock).mockResolvedValue({
            data: [],
        });
        (api.ordersControllerFulfillDirectOrder as jest.Mock).mockResolvedValue({
            data: {
                success: true,
                salesOrderId: 'so-1',
                stateCode: 'shipped',
                picksCreated: 1,
                linesFulfilled: [{ salesOrderLineId: 'L1', quantityFulfilled: 3, inventoryIssued: true }],
            },
        });
        mockCalcShippable.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
        mockCalcPickAndShip.mockReturnValue([
            { salesOrderLineId: 'L1', maxQty: 3, defaultQty: '3' },
        ]);
    });

    it('opens pick & ship form, accepts tracking, notes and delivery instructions, and calls ordersControllerFulfillDirectOrder', async () => {
        const user = userEvent.setup();
        const loadOrder = jest.fn().mockResolvedValue(undefined);
        const orderWithNotes: OrderDetail = {
            ...baseOrder,
            shippingNotes: 'Initial instructions',
        };
        render(React.createElement(ShipmentsSection, { ...defaultProps, order: orderWithNotes, loadOrder }));

        await waitFor(() => {
            expect(screen.getByText('buttons.pickAndShip')).toBeInTheDocument();
        });

        await user.click(screen.getByText('buttons.pickAndShip'));

        expect(screen.getByPlaceholderText('deliveryInstructions')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('deliveryInstructions')).toHaveValue('Initial instructions');
        expect(screen.getByPlaceholderText('placeholders.tracking')).toBeInTheDocument();
        expect(screen.getByPlaceholderText('placeholders.shipmentNotes')).toBeInTheDocument();

        await user.clear(screen.getByPlaceholderText('deliveryInstructions'));
        await user.type(screen.getByPlaceholderText('deliveryInstructions'), 'Custom pick delivery instructions');
        await user.type(screen.getByPlaceholderText('placeholders.tracking'), 'TRK-999');
        await user.type(screen.getByPlaceholderText('placeholders.shipmentNotes'), 'Picked directly from warehouse');

        const submitButtons = screen.getAllByText('buttons.pickAndShip');
        const submitBtn = submitButtons[submitButtons.length - 1];
        await user.click(submitBtn);

        await waitFor(() => {
            expect(api.ordersControllerFulfillDirectOrder).toHaveBeenCalledWith(
                'so-1',
                expect.objectContaining({
                    trackingNumber: 'TRK-999',
                    notes: 'Picked directly from warehouse',
                    shippingNotes: 'Custom pick delivery instructions',
                    allowPartialFulfillment: true,
                    lines: [{ salesOrderLineId: 'L1', quantityToFulfill: '3' }],
                }),
            );
        });

        expect(loadOrder).toHaveBeenCalled();
    });

    it('cancels pick & ship form and closes panel', async () => {
        const user = userEvent.setup();
        render(React.createElement(ShipmentsSection, defaultProps));

        await waitFor(() => {
            expect(screen.getByText('buttons.pickAndShip')).toBeInTheDocument();
        });

        await user.click(screen.getByText('buttons.pickAndShip'));
        expect(screen.getByPlaceholderText('placeholders.shipmentNotes')).toBeInTheDocument();

        await user.click(screen.getByText('cancel'));
        expect(screen.queryByPlaceholderText('placeholders.shipmentNotes')).not.toBeInTheDocument();
    });
});

