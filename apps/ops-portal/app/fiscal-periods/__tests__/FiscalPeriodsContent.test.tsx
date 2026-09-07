import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FiscalPeriodsContent from '../FiscalPeriodsContent';
import * as api from '@herobm/sdk';
import { DATA_SOURCE_CONTEXT, SystemResource } from '@herobm/shared';

// ── Mocks ────────────────────────────────────────────────────────────

jest.mock('@/components/AuthGate', () => ({
  useAuth: () => ({
    permissions: [
      { resource: SystemResource.FISCAL_PERIODS, action: 'read', effect: 'allow' },
      { resource: SystemResource.FISCAL_PERIODS, action: 'write', effect: 'allow' },
      { resource: SystemResource.GL, action: 'read', effect: 'allow' },
    ],
  }),
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@herobm/sdk', () => ({
  setSdkConfig: jest.fn(),
  glControllerGetFiscalPeriods: jest.fn(),
  glControllerUpdateFiscalPeriodStatus: jest.fn(),
  pdfTemplatesControllerRunHook: jest.fn(),
}));

const mockPeriods: api.FiscalPeriodResponseDto[] = [
  {
    periodId: 'p-1',
    periodName: '2026-08',
    fiscalYear: 2026,
    periodNumber: 8,
    startDate: '2026-08-01',
    endDate: '2026-08-31',
    status: 'hard_closed',
    closedBy: 'cfo@herobm.com',
    closedAt: '2026-08-31T23:59:59Z',
    notes: 'Closed period',
    createdOn: '2026-08-01T00:00:00Z',
    modifiedOn: '2026-08-31T23:59:59Z',
  },
  {
    periodId: 'p-2',
    periodName: '2026-09',
    fiscalYear: 2026,
    periodNumber: 9,
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    status: 'open',
    createdOn: '2026-09-01T00:00:00Z',
    modifiedOn: '2026-09-01T00:00:00Z',
  },
];

describe('FiscalPeriodsContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.glControllerGetFiscalPeriods as jest.Mock).mockResolvedValue({
      data: mockPeriods,
    });
    (api.pdfTemplatesControllerRunHook as jest.Mock).mockResolvedValue({
      data: new Blob(['fake-pdf'], { type: 'application/pdf' }),
    });
    window.URL.createObjectURL = jest.fn().mockReturnValue('blob:http://localhost/fake-pdf');
    window.open = jest.fn();
  });

  it('renders fiscal periods table with periods', async () => {
    render(<FiscalPeriodsContent />);

    await waitFor(() => {
      expect(screen.getByText(/2026-08 \(Period 8\)/)).toBeInTheDocument();
      expect(screen.getByText(/2026-09 \(Period 9\)/)).toBeInTheDocument();
    });

    expect(screen.getByText('Hard Closed')).toBeInTheDocument();
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('triggers PDF generation when Audit PDF button is clicked', async () => {
    const user = userEvent.setup();
    render(<FiscalPeriodsContent />);

    await waitFor(() => {
      expect(screen.getAllByText('Audit PDF')).toHaveLength(2);
    });

    const auditButtons = screen.getAllByText('Audit PDF');
    await user.click(auditButtons[0]);

    await waitFor(() => {
      expect(api.pdfTemplatesControllerRunHook).toHaveBeenCalledWith(
        'period-close-audit',
        {},
        {
          id: 'p-1',
          context: DATA_SOURCE_CONTEXT.PERIOD_CLOSE_AUDIT,
        },
      );
      expect(window.open).toHaveBeenCalledWith('blob:http://localhost/fake-pdf', '_blank');
    });
  });
});
