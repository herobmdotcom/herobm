/**
 * ReturnsSection.test.tsx
 *
 * Tests the ReturnsSection component rendering states,
 * editable vs read-only fields, transition buttons, and interaction handlers.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReturnsSection from '../ReturnsSection';
import type { OrderDetail, OrderReturn } from '../types';
import { RETURN_STATE, RETURN_TRANSITIONS, RETURN_LIFECYCLE, SALES_ORDER_STATE } from '@modbm/shared';

// ── Mocks ────────────────────────────────────────────────────────────
jest.mock('next-intl', () => ({
    useTranslations: () => (key: string) => key,
}));

const mockSdkMutate = jest.fn().mockResolvedValue({});
jest.mock('@/lib/api', () => ({
    apiCall: (...args: any[]) => mockSdkMutate(...args),
}));

jest.mock('@/lib/currency', () => ({
    formatAmount: (v: number, cc: string) => `${cc} ${v.toFixed(2)}`,
}));

jest.mock('@modbm/shared', () => {
    const actual = jest.requireActual('@modbm/shared');
    return {
        ...actual,
        RETURN_TRANSITIONS: {
            [actual.RETURN_STATE.DRAFT]: [actual.RETURN_STATE.CONFIRMED, actual.RETURN_STATE.CANCELLED],
            [actual.RETURN_STATE.CONFIRMED]: [actual.RETURN_STATE.PROCESSED, actual.RETURN_STATE.DRAFT],
            [actual.RETURN_STATE.PROCESSED]: [],
            [actual.RETURN_STATE.CANCELLED]: [],
        },
        RETURN_LIFECYCLE: {
            [actual.RETURN_STATE.CANCELLED]: 0, 
            [actual.RETURN_STATE.DRAFT]: 1, 
            [actual.RETURN_STATE.CONFIRMED]: 2, 
            [actual.RETURN_STATE.PROCESSED]: 3,
        },
    };
});

jest.mock('@/components/StateBadge', () => {
    const StateName = ({ state }: { state: string }) => <span>{state}</span>;
    return {
        __esModule: true,
        default: ({ state }: { state: string }) => <span className="badge">{state}</span>,
        StateName,
    };
});

// ── Fixtures ─────────────────────────────────────────────────────────

const baseOrder: OrderDetail = {
    salesOrderId: 'so-001',
    orderNumber: 'SO-001',
    name: 'Test Order',
    customerId: 'cust-1',
    customerName: 'ACME',
    customerOrderNumber: null,
    stateCode: SALES_ORDER_STATE.INVOICED,
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

const draftReturn: OrderReturn = {
    returnId: 'ret-1',
    returnNumber: 'RET-001',
    salesOrderId: 'so-001',
    stateCode: RETURN_STATE.DRAFT,
    notes: 'Damaged goods',
    createdBy: 'admin',
    createdOn: '2024-02-01',
    modifiedOn: '2024-02-01',
    lines: [{
        returnLineId: 'rl-1',
        salesOrderLineId: 'L1',
        quantityReturned: '2',
        reason: 'Defective',
        returnFee: '10.00',
    }],
};

const confirmedReturn: OrderReturn = {
    ...draftReturn,
    returnId: 'ret-2',
    returnNumber: 'RET-002',
    stateCode: RETURN_STATE.CONFIRMED,
    notes: null,
};

const defaultProps = {
    orderId: 'so-001',
    order: baseOrder,
    returns: [] as OrderReturn[],
    returnsLoading: false,
    showCreateReturn: false,
    setShowCreateReturn: jest.fn(),
    setError: jest.fn(),
    loadReturns: jest.fn().mockResolvedValue(undefined),
    loadOrder: jest.fn().mockResolvedValue(undefined),
    taxCategories: [],
    locations: [],
};

// ── Tests — rendering ────────────────────────────────────────────────

describe('ReturnsSection — rendering', () => {
    it('shows "noReturns" message when returns array is empty', () => {
        render(<ReturnsSection {...defaultProps} />);
        expect(screen.getByText('noReturns')).toBeInTheDocument();
    });

    it('shows loading message when returnsLoading is true', () => {
        render(<ReturnsSection {...defaultProps} returnsLoading={true} />);
        expect(screen.getByText('loadingReturns')).toBeInTheDocument();
    });

    it('renders a return with its return number', () => {
        render(<ReturnsSection {...defaultProps} returns={[draftReturn]} />);
        expect(screen.getByText('RET-001')).toBeInTheDocument();
    });

    it('shows return notes when present', () => {
        render(<ReturnsSection {...defaultProps} returns={[draftReturn]} />);
        expect(screen.getByText('Damaged goods')).toBeInTheDocument();
    });

    it('shows editable quantity input for draft returns', () => {
        render(<ReturnsSection {...defaultProps} returns={[draftReturn]} />);
        const inputs = screen.getAllByRole('spinbutton');
        const qtyInput = inputs.find(i => (i as HTMLInputElement).defaultValue === '2');
        expect(qtyInput).toBeTruthy();
    });

    it('shows read-only quantity text for confirmed returns', () => {
        render(<ReturnsSection {...defaultProps} returns={[confirmedReturn]} />);
        expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('shows read-only reason text for confirmed returns', () => {
        render(<ReturnsSection {...defaultProps} returns={[confirmedReturn]} />);
        expect(screen.getByText('Defective')).toBeInTheDocument();
    });

    it('shows transition buttons matching allowed transitions for draft', () => {
        render(<ReturnsSection {...defaultProps} returns={[draftReturn]} />);
        const buttons = screen.getAllByRole('button');
        const confirmedBtn = buttons.find(b => b.textContent?.trim().includes('confirmed'));
        const cancelledBtn = buttons.find(b => b.textContent?.trim().includes('cancelled'));
        expect(confirmedBtn).toBeTruthy();
        expect(cancelledBtn).toBeTruthy();
    });



    it('shows delete button for editable (draft) return lines', () => {
        render(<ReturnsSection {...defaultProps} returns={[draftReturn]} />);
        const deleteBtn = screen.getByText('✕');
        expect(deleteBtn).toBeInTheDocument();
    });

    it('does not show delete button for non-draft returns', () => {
        render(<ReturnsSection {...defaultProps} returns={[confirmedReturn]} />);
        expect(screen.queryByText('✕')).not.toBeInTheDocument();
    });
});

// ── Tests — interactions ─────────────────────────────────────────────

describe('ReturnsSection — state transitions', () => {
    beforeEach(() => jest.clearAllMocks());

    it('calls apiCall to change state when transition button is clicked', async () => {
        const user = userEvent.setup();
        const loadReturns = jest.fn().mockResolvedValue(undefined);
        const loadOrder = jest.fn().mockResolvedValue(undefined);

        render(
            <ReturnsSection
                {...defaultProps}
                returns={[draftReturn]}
                loadReturns={loadReturns}
                loadOrder={loadOrder}
            />,
        );

        const buttons = screen.getAllByRole('button');
        const confirmedBtn = buttons.find(b => b.textContent?.trim().includes('confirmed'))!;
        await user.click(confirmedBtn);

        await waitFor(() => {
            expect(mockSdkMutate).toHaveBeenCalledWith(
                '/api/sales-orders/so-001/returns/ret-1/state',
                'PATCH',
                { stateCode: RETURN_STATE.CONFIRMED },
            );
        });
        await waitFor(() => expect(loadReturns).toHaveBeenCalled());
    });

    it('shows error when state transition fails', async () => {
        const user = userEvent.setup();
        mockSdkMutate.mockRejectedValueOnce(new Error('Transition denied'));
        const setError = jest.fn();

        render(
            <ReturnsSection {...defaultProps} returns={[draftReturn]} setError={setError} />,
        );

        const buttons = screen.getAllByRole('button');
        const confirmedBtn = buttons.find(b => b.textContent?.trim().includes('confirmed'))!;
        await user.click(confirmedBtn);

        await waitFor(() => {
            expect(setError).toHaveBeenCalledWith('Transition denied');
        });
    });
});

describe('ReturnsSection — inline editing', () => {
    beforeEach(() => jest.clearAllMocks());

    it('updates return line quantity on blur when value changes', async () => {
        const user = userEvent.setup();
        const loadReturns = jest.fn().mockResolvedValue(undefined);

        render(
            <ReturnsSection
                {...defaultProps}
                returns={[draftReturn]}
                loadReturns={loadReturns}
            />,
        );

        const inputs = screen.getAllByRole('spinbutton');
        const qtyInput = inputs.find(i => (i as HTMLInputElement).defaultValue === '2')!;

        await user.clear(qtyInput);
        await user.type(qtyInput, '5');
        await user.tab(); // trigger blur

        await waitFor(() => {
            expect(mockSdkMutate).toHaveBeenCalledWith(
                '/api/sales-orders/so-001/returns/ret-1/lines/rl-1',
                'PATCH',
                { quantityReturned: '5' },
            );
        });
    });

    it('does not call apiCall when quantity is unchanged on blur', async () => {
        const user = userEvent.setup();

        render(<ReturnsSection {...defaultProps} returns={[draftReturn]} />);

        const inputs = screen.getAllByRole('spinbutton');
        const qtyInput = inputs.find(i => (i as HTMLInputElement).defaultValue === '2')!;

        // Just focus and blur without changing value
        await user.click(qtyInput);
        await user.tab();

        expect(mockSdkMutate).not.toHaveBeenCalled();
    });

    it('updates return line reason on blur when value changes', async () => {
        const user = userEvent.setup();
        const loadReturns = jest.fn().mockResolvedValue(undefined);

        render(
            <ReturnsSection
                {...defaultProps}
                returns={[draftReturn]}
                loadReturns={loadReturns}
            />,
        );

        const reasonInput = screen.getByDisplayValue('Defective');
        await user.clear(reasonInput);
        await user.type(reasonInput, 'Wrong item');
        await user.tab();

        await waitFor(() => {
            expect(mockSdkMutate).toHaveBeenCalledWith(
                '/api/sales-orders/so-001/returns/ret-1/lines/rl-1',
                'PATCH',
                { reason: 'Wrong item' },
            );
        });
    });

    it('updates return fee on blur when value changes', async () => {
        const user = userEvent.setup();
        const loadReturns = jest.fn().mockResolvedValue(undefined);

        render(
            <ReturnsSection
                {...defaultProps}
                returns={[draftReturn]}
                loadReturns={loadReturns}
            />,
        );

        const inputs = screen.getAllByRole('spinbutton');
        // fee input has defaultValue '10.00'
        const feeInput = inputs.find(i => (i as HTMLInputElement).defaultValue === '10.00')!;
        await user.clear(feeInput);
        await user.type(feeInput, '25');
        await user.tab();

        await waitFor(() => {
            expect(mockSdkMutate).toHaveBeenCalledWith(
                '/api/sales-orders/so-001/returns/ret-1/lines/rl-1',
                'PATCH',
                { returnFee: '25.00' },
            );
        });
    });
});

describe('ReturnsSection — delete line', () => {
    beforeEach(() => jest.clearAllMocks());

    it('deletes a return line after confirmation', async () => {
        const user = userEvent.setup();
        jest.spyOn(window, 'confirm').mockReturnValue(true);
        const loadReturns = jest.fn().mockResolvedValue(undefined);

        render(
            <ReturnsSection
                {...defaultProps}
                returns={[draftReturn]}
                loadReturns={loadReturns}
            />,
        );

        await user.click(screen.getByText('✕'));

        await waitFor(() => {
            expect(mockSdkMutate).toHaveBeenCalledWith(
                '/api/sales-orders/so-001/returns/ret-1/lines/rl-1',
                'DELETE',
            );
        });
        await waitFor(() => expect(loadReturns).toHaveBeenCalled());

        jest.restoreAllMocks();
    });

    it('does not delete when confirmation is cancelled', async () => {
        const user = userEvent.setup();
        jest.spyOn(window, 'confirm').mockReturnValue(false);

        render(<ReturnsSection {...defaultProps} returns={[draftReturn]} />);
        await user.click(screen.getByText('✕'));

        expect(mockSdkMutate).not.toHaveBeenCalled();
        jest.restoreAllMocks();
    });
});

describe('ReturnsSection — create return form', () => {
    beforeEach(() => jest.clearAllMocks());

    it('shows create return form with line inputs when showCreateReturn is true', () => {
        render(<ReturnsSection {...defaultProps} showCreateReturn={true} />);
        expect(screen.getByText('buttons.saveReturn')).toBeInTheDocument();
        expect(screen.getByText('cancel')).toBeInTheDocument();
    });

    it('cancels create form and calls setShowCreateReturn(false)', async () => {
        const user = userEvent.setup();
        const setShowCreateReturn = jest.fn();

        render(
            <ReturnsSection
                {...defaultProps}
                showCreateReturn={true}
                setShowCreateReturn={setShowCreateReturn}
            />,
        );

        await user.click(screen.getByText('cancel'));
        expect(setShowCreateReturn).toHaveBeenCalledWith(false);
    });

    it('saves return with correct POST payload', async () => {
        const user = userEvent.setup();
        const loadReturns = jest.fn().mockResolvedValue(undefined);
        const loadOrder = jest.fn().mockResolvedValue(undefined);
        const setShowCreateReturn = jest.fn();

        render(
            <ReturnsSection
                {...defaultProps}
                showCreateReturn={true}
                setShowCreateReturn={setShowCreateReturn}
                loadReturns={loadReturns}
                loadOrder={loadOrder}
            />,
        );

        // Fill in quantity for the first line
        const inputs = screen.getAllByRole('spinbutton');
        const qtyInput = inputs[0];
        await user.type(qtyInput, '3');

        // The save button should now be enabled
        const saveBtn = screen.getByText('buttons.saveReturn');
        expect(saveBtn).not.toBeDisabled();
        await user.click(saveBtn);

        await waitFor(() => {
            expect(mockSdkMutate).toHaveBeenCalledWith(
                '/api/sales-orders/so-001/returns',
                'POST',
                expect.objectContaining({
                    lines: expect.arrayContaining([
                        expect.objectContaining({
                            salesOrderLineId: 'L1',
                            quantityReturned: '3',
                        }),
                    ]),
                }),
            );
        });
        await waitFor(() => expect(loadReturns).toHaveBeenCalled());
    });

    it('shows error when save fails', async () => {
        const user = userEvent.setup();
        mockSdkMutate.mockRejectedValueOnce(new Error('Save failed'));
        const setError = jest.fn();

        render(
            <ReturnsSection
                {...defaultProps}
                showCreateReturn={true}
                setError={setError}
            />,
        );

        const inputs = screen.getAllByRole('spinbutton');
        await user.type(inputs[0], '1');
        await user.click(screen.getByText('buttons.saveReturn'));

        await waitFor(() => {
            expect(setError).toHaveBeenCalledWith('Save failed');
        });
    });

    it('updates reason field in create form via onChange', async () => {
        const user = userEvent.setup();
        render(<ReturnsSection {...defaultProps} showCreateReturn={true} />);

        // Find the reason input by its placeholder
        const reasonInput = screen.getByPlaceholderText('placeholders.reason');
        await user.type(reasonInput, 'Broken item');
        expect((reasonInput as HTMLInputElement).value).toBe('Broken item');
    });

    it('updates fee value in create form via onChange', async () => {
        const user = userEvent.setup();
        render(<ReturnsSection {...defaultProps} showCreateReturn={true} />);

        // Find the fee number input (second spinbutton)
        const inputs = screen.getAllByRole('spinbutton');
        const feeInput = inputs[inputs.length - 1]; // last spinbutton is the fee
        await user.clear(feeInput);
        await user.type(feeInput, '15');
        expect((feeInput as HTMLInputElement).value).toBe('15');
    });

    it('toggles fee mode from absolute to percentage via select', async () => {
        const user = userEvent.setup();
        render(<ReturnsSection {...defaultProps} showCreateReturn={true} />);

        const selects = screen.getAllByRole('combobox');
        expect(selects.length).toBeGreaterThan(0);
        const feeModeSelect = selects[0];

        // Default is "absolute" ($), switch to "percentage" (%)
        await user.selectOptions(feeModeSelect, 'percentage');
        expect((feeModeSelect as HTMLSelectElement).value).toBe('percentage');
    });

    it('auto-converts fee from percentage to absolute on blur', async () => {
        const user = userEvent.setup();
        render(
            <ReturnsSection
                {...defaultProps}
                showCreateReturn={true}
                order={{
                    ...baseOrder,
                    lines: [{
                        ...baseOrder.lines[0],
                        amount: '500.00',
                    }],
                }}
            />,
        );

        // Switch to percentage mode
        const selects = screen.getAllByRole('combobox');
        await user.selectOptions(selects[0], 'percentage');

        // Type a percentage value in the fee input
        const inputs = screen.getAllByRole('spinbutton');
        const feeInput = inputs[inputs.length - 1];
        await user.clear(feeInput);
        await user.type(feeInput, '10');

        // Blur should trigger auto-conversion from % to $
        await user.tab();

        // After blur the select should revert to absolute
        await waitFor(() => {
            expect((selects[0] as HTMLSelectElement).value).toBe('absolute');
        });
    });
});
