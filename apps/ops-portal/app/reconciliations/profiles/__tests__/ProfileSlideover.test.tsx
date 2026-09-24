import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileSlideover, { parseSimpleCsv, colToLetter, letterToColIndex } from '../components/ProfileSlideover';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string) => key;
    t.has = () => true;
    return t;
  },
}));

jest.mock('@/components/shared/SlideOver', () => {
  return function MockSlideOver({
    isOpen,
    title,
    children,
    footer,
  }: {
    isOpen: boolean;
    title: string;
    children: React.ReactNode;
    footer?: React.ReactNode;
  }) {
    if (!isOpen) return null;
    return (
      <div data-testid="slide-over">
        <h2>{title}</h2>
        <div>{children}</div>
        <div>{footer}</div>
      </div>
    );
  };
});

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  bankFeedsControllerCreateProfile: jest.fn(),
  bankFeedsControllerUpdateProfile: jest.fn(),
}));

describe('ProfileSlideover & CSV Mapping Helper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Helper Utilities', () => {
    it('converts numbers/letters to standard column letters with colToLetter', () => {
      expect(colToLetter('0')).toBe('A');
      expect(colToLetter('1')).toBe('B');
      expect(colToLetter('25')).toBe('Z');
      expect(colToLetter('A')).toBe('A');
      expect(colToLetter('C')).toBe('C');
      expect(colToLetter('')).toBe('');
    });

    it('converts column letters to 0-indexed column indexes with letterToColIndex', () => {
      expect(letterToColIndex('A')).toBe(0);
      expect(letterToColIndex('B')).toBe(1);
      expect(letterToColIndex('C')).toBe(2);
      expect(letterToColIndex('Z')).toBe(25);
      expect(letterToColIndex('')).toBe(-1);
    });

    it('parses CSV text into headers and rows with parseSimpleCsv', () => {
      const csv = `Date,Description,Amount\n2026-09-01,"Office Supplies, Inc",-45.50\n2026-09-02,Client Deposit,1200.00`;
      const parsed = parseSimpleCsv(csv);
      expect(parsed.headers).toEqual(['Date', 'Description', 'Amount']);
      expect(parsed.rows.length).toBe(2);
      expect(parsed.rows[0]).toEqual(['2026-09-01', 'Office Supplies, Inc', '-45.50']);
      expect(parsed.rows[1]).toEqual(['2026-09-02', 'Client Deposit', '1200.00']);
    });
  });

  describe('Component Rendering & User Interactions', () => {
    it('renders create mode with Single Column (+/-) by default', () => {
      render(
        <ProfileSlideover
          isOpen={true}
          onClose={jest.fn()}
          onSaved={jest.fn()}
          profileToEdit={null}
        />,
      );

      expect(screen.getByText('Create Import Profile')).toBeInTheDocument();
      expect(screen.getByText('Single Amount Column (+ / -)')).toBeInTheDocument();
      expect(screen.getByText('Separate Debit & Credit')).toBeInTheDocument();
      expect(screen.getByText(/^Amount Column \(\+ \/ -\)/)).toBeInTheDocument();
    });

    it('switches to Separate Debit & Credit format when card is clicked', async () => {
      render(
        <ProfileSlideover
          isOpen={true}
          onClose={jest.fn()}
          onSaved={jest.fn()}
          profileToEdit={null}
        />,
      );

      fireEvent.click(screen.getByText('Separate Debit & Credit'));

      expect(screen.getByText(/Debit Column \(Money Out/)).toBeInTheDocument();
      expect(screen.getByText(/Credit Column \(Money In/)).toBeInTheDocument();
      expect(screen.queryByText(/^Amount Column \(\+ \/ -\)/)).not.toBeInTheDocument();
    });

    it('loads sample CSV file and renders live parsed preview table', async () => {
      render(
        <ProfileSlideover
          isOpen={true}
          onClose={jest.fn()}
          onSaved={jest.fn()}
          profileToEdit={null}
        />,
      );

      const csvContent = `Date,Description,Amount,Reference,Payee\n2026-09-01,Office Supplies Co,-45.50,INV-8891,Office Supplies Co\n2026-09-02,Client Retainer Payment,1250.00,REC-202,Apex Commercial`;
      const file = new File([csvContent], 'statement.csv', { type: 'text/csv' });

      // Mock FileReader
      const originalFileReader = window.FileReader;
      class MockFileReader {
        onload: ((e: ProgressEvent<FileReader>) => void) | null = null;
        readAsText() {
          setTimeout(() => {
            if (this.onload) {
              this.onload({ target: { result: csvContent } } as unknown as ProgressEvent<FileReader>);
            }
          }, 10);
        }
      }
      window.FileReader = MockFileReader as unknown as typeof FileReader;

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();

      fireEvent.change(fileInput, { target: { files: [file] } });

      await waitFor(() => {
        expect(screen.getByText(/Live Parsed Output Preview/)).toBeInTheDocument();
        expect(screen.getAllByText('Office Supplies Co').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('-45.50')).toBeInTheDocument();
        expect(screen.getByText('+1250.00')).toBeInTheDocument();
      });

      window.FileReader = originalFileReader;
    });

    it('loads existing profile data when in edit mode', () => {
      const existingProfile = {
        profileId: 'prof-123',
        name: 'Barclays Main',
        dateColumn: 'A',
        descriptionColumn: 'B',
        amountColumn: '',
        debitColumn: 'C',
        creditColumn: 'D',
        typeColumn: '',
        payeeColumn: 'E',
        referenceColumn: 'F',
        headerRows: 2,
      };

      render(
        <ProfileSlideover
          isOpen={true}
          onClose={jest.fn()}
          onSaved={jest.fn()}
          profileToEdit={existingProfile}
        />,
      );

      expect(screen.getByText('Edit Import Profile')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Barclays Main')).toBeInTheDocument();
      expect(screen.getByDisplayValue('2')).toBeInTheDocument();
      expect(screen.getByText(/Debit Column \(Money Out/)).toBeInTheDocument();
    });

    it('validates required fields and prevents saving when empty', async () => {
      render(
        <ProfileSlideover
          isOpen={true}
          onClose={jest.fn()}
          onSaved={jest.fn()}
          profileToEdit={null}
        />,
      );

      // Save without entering name
      fireEvent.click(screen.getByText('save'));

      await waitFor(() => {
        expect(screen.getByText('Profile name is required')).toBeInTheDocument();
      });

      expect(api.bankFeedsControllerCreateProfile).not.toHaveBeenCalled();
    });

    it('successfully calls create API when form is valid', async () => {
      (api.bankFeedsControllerCreateProfile as jest.Mock).mockResolvedValue({
        data: { profileId: 'prof-new' },
      });
      const onSaved = jest.fn().mockResolvedValue(undefined);
      const onClose = jest.fn();

      render(
        <ProfileSlideover
          isOpen={true}
          onClose={onClose}
          onSaved={onSaved}
          profileToEdit={null}
        />,
      );

      fireEvent.change(screen.getByPlaceholderText(/e\.g\. Barclays/), {
        target: { value: 'Santander Business' },
      });

      fireEvent.click(screen.getByText('save'));

      await waitFor(() => {
        expect(api.bankFeedsControllerCreateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            name: 'Santander Business',
            dateColumn: 'A',
            descriptionColumn: 'B',
            amountColumn: 'C',
            headerRows: 1,
          }),
        );
        expect(onSaved).toHaveBeenCalled();
        expect(onClose).toHaveBeenCalled();
      });
    });
  });
});
