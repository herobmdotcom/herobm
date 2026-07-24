import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SalesReturnDetailContent from '../SalesReturnDetailContent';
import { useSalesReturn } from '../useSalesReturn';
import { RETURN_STATE, PUTAWAY_STATUS } from '@herobm/shared';

jest.mock('../useSalesReturn', () => ({
    useSalesReturn: jest.fn()
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
    useAuth: () => ({ permissions: [{ resource: 'sales-returns', action: 'write' }] }),
}));

jest.mock('@/components/SettingsProvider', () => ({
    useSettings: () => ({ baseCurrency: 'USD' }),
}));

const mockOrderReturnsControllerChangeReturnState = jest.fn().mockResolvedValue({});
jest.mock('@herobm/sdk', () => ({
    __esModule: true,
    setSdkConfig: jest.fn(),
    orderReturnsControllerChangeReturnState: (...args: any[]) => mockOrderReturnsControllerChangeReturnState(...args),
    pdfTemplatesControllerRunHook: jest.fn().mockResolvedValue({ data: new Blob(['pdf'], { type: 'application/pdf' }) }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
    useDocumentTitle: jest.fn(),
}));

const mockFetchReturn = jest.fn().mockResolvedValue({});

describe('SalesReturnDetailContent', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (useSalesReturn as jest.Mock).mockReturnValue({
            ret: {
                returnId: 'ret-1',
                returnNumber: 'RET-001',
                salesOrderId: 'so-1',
                orderNumber: 'SO-001',
                stateCode: RETURN_STATE.DRAFT,
                customerId: 'cust-1',
                customerName: 'ACME Corp',
                currencyCode: 'USD',
                createdOn: '2024-01-01T00:00:00Z',
                lines: [
                    {
                        returnLineId: 'line-1',
                        productId: 'prod-1',
                        productNumber: 'PROD-1',
                        quantityReturned: '2',
                        pricePerUnit: '10',
                        returnFee: '0',
                        putawayStatus: PUTAWAY_STATUS.PENDING_PUTAWAY
                    }
                ],
                events: []
            },
            locations: [],
            loading: false,
            error: null,
            fetchReturn: mockFetchReturn,
        });
    });

    it('renders return details', () => {
        render(<SalesReturnDetailContent id="ret-1" />);
        expect(screen.getByText('RET-001')).toBeInTheDocument();
        expect(screen.getByText('ACME Corp')).toBeInTheDocument();
        expect(screen.getAllByText('PROD-1').length).toBeGreaterThan(0);
    });

    it('shows warning banner for pending putaway', () => {
        render(<SalesReturnDetailContent id="ret-1" />);
        expect(screen.getByText('Pending Inspection')).toBeInTheDocument();
    });

    it('allows state transitions', async () => {
        const user = userEvent.setup();
        render(<SalesReturnDetailContent id="ret-1" />);
        
        // Draft returns can be confirmed
        const confirmBtn = screen.getByText('confirmed');
        await user.click(confirmBtn);

        expect(mockOrderReturnsControllerChangeReturnState).toHaveBeenCalledWith('so-1', 'ret-1', {
            stateCode: RETURN_STATE.CONFIRMED
        });
    });
});
