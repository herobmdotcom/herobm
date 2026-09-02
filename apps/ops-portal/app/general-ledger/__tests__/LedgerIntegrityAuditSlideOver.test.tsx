import { render, screen, fireEvent } from '@testing-library/react';
import LedgerIntegrityAuditSlideOver, {
  LedgerAuditData,
} from '../LedgerIntegrityAuditSlideOver';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: { count?: number; timestamp?: string }) => {
    if (params?.count !== undefined) return `${key}:${params.count}`;
    if (params?.timestamp !== undefined) return `${key}:${params.timestamp}`;
    return key;
  },
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

describe('LedgerIntegrityAuditSlideOver', () => {
  const mockAnomalies = [
    {
      type: 'missing_gl_journal' as const,
      invoiceNumber: 'INV-20260901-0001',
      invoiceId: 'inv-1',
      details: { stateCode: 'invoiced', totalAmount: '150.00' },
    },
    {
      type: 'unbalanced_journal_entry' as const,
      entryNumber: 'JE-20260901-0005',
      journalEntryId: 'je-5',
      details: { totalDebit: 100, totalCredit: 80, drift: 20 },
    },
    {
      type: 'sequence_gap' as const,
      invoiceNumber: 'INV-20260901-0010',
      details: { prefix: 'INV-20260901-', expectedSequence: 8, actualSequence: 10, missingCount: 2 },
    },
  ];

  const mockAuditData: LedgerAuditData = {
    hasAudit: true,
    eventId: 'evt-audit-123',
    anomaliesCount: 3,
    anomalies: mockAnomalies,
    verifiedInvoicesCount: 250,
    verifiedJournalsCount: 180,
    auditedAt: '2026-09-01T02:00:00Z',
  };

  it('renders all anomaly types and summary counts when opened', () => {
    const onClose = jest.fn();
    render(
      <LedgerIntegrityAuditSlideOver
        isOpen={true}
        onClose={onClose}
        initialData={mockAuditData}
      />,
    );

    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('INV-20260901-0001')).toBeInTheDocument();
    expect(screen.getByText('JE-20260901-0005')).toBeInTheDocument();
    expect(screen.getByText('INV-20260901-0010')).toBeInTheDocument();
    expect(screen.getByText('250')).toBeInTheDocument();
    expect(screen.getByText('180')).toBeInTheDocument();
  });

  it('filters anomalies when searching by document number', () => {
    const onClose = jest.fn();
    render(
      <LedgerIntegrityAuditSlideOver
        isOpen={true}
        onClose={onClose}
        initialData={mockAuditData}
      />,
    );

    const searchInput = screen.getByPlaceholderText('filterPlaceholder');
    fireEvent.change(searchInput, { target: { value: 'JE-20260901' } });

    expect(screen.getByText('JE-20260901-0005')).toBeInTheDocument();
    expect(screen.queryByText('INV-20260901-0001')).not.toBeInTheDocument();
    expect(screen.queryByText('INV-20260901-0010')).not.toBeInTheDocument();
  });

  it('filters anomalies by category chip', () => {
    const onClose = jest.fn();
    render(
      <LedgerIntegrityAuditSlideOver
        isOpen={true}
        onClose={onClose}
        initialData={mockAuditData}
      />,
    );

    const missingGlChip = screen.getByRole('button', { name: /types\.missing_gl_journal/i });
    fireEvent.click(missingGlChip);

    expect(screen.getByText('INV-20260901-0001')).toBeInTheDocument();
    expect(screen.queryByText('JE-20260901-0005')).not.toBeInTheDocument();
    expect(screen.queryByText('INV-20260901-0010')).not.toBeInTheDocument();
  });

  it('handles pagination properly for large volumes of anomalies', () => {
    const largeAnomalyList = Array.from({ length: 120 }, (_, i) => ({
      type: 'missing_gl_journal' as const,
      invoiceNumber: `INV-2026-BIG-${i + 1}`,
      invoiceId: `inv-big-${i + 1}`,
      details: { totalAmount: '10.00' },
    }));

    const largeData: LedgerAuditData = {
      hasAudit: true,
      anomaliesCount: 120,
      anomalies: largeAnomalyList,
      verifiedInvoicesCount: 5000,
      verifiedJournalsCount: 4000,
    };

    render(
      <LedgerIntegrityAuditSlideOver
        isOpen={true}
        onClose={jest.fn()}
        initialData={largeData}
      />,
    );

    // Page 1 displays items 1 through 50
    expect(screen.getByText('INV-2026-BIG-1')).toBeInTheDocument();
    expect(screen.getByText('INV-2026-BIG-50')).toBeInTheDocument();
    expect(screen.queryByText('INV-2026-BIG-51')).not.toBeInTheDocument();
    expect(screen.getByText('1 / 3')).toBeInTheDocument();

    // Click next page
    const nextBtn = screen.getByText('chevron_right').closest('button')!;
    fireEvent.click(nextBtn);

    // Page 2 displays items 51 through 100
    expect(screen.getByText('INV-2026-BIG-51')).toBeInTheDocument();
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(screen.queryByText('INV-2026-BIG-1')).not.toBeInTheDocument();
  });
});
