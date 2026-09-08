import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OpportunityForm from '../OpportunityForm';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';

const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
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

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({
    baseCurrency: 'USD',
    app: {
      opportunityStages: [
        { value: 'Lead', order: 1 },
        { value: 'Proposal', order: 2 },
      ],
      opportunityTypes: [
        { value: 'New Business', order: 1 },
        { value: 'Expansion', order: 2 },
      ],
    },
  }),
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

jest.mock('@herobm/sdk', () => ({
  __esModule: true,
  opportunitiesControllerCreate: jest.fn(),
}));

describe('OpportunityForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders required form elements', () => {
    render(<OpportunityForm />);
    expect(screen.getByPlaceholderText(/Acme Corp/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Opportunity/i })).toBeInTheDocument();
  });

  it('validates required name field before submitting', async () => {
    render(<OpportunityForm />);
    fireEvent.click(screen.getByRole('button', { name: /Create Opportunity/i }));

    expect(toast.error).toHaveBeenCalledWith('Opportunity name is required');
    expect(api.opportunitiesControllerCreate).not.toHaveBeenCalled();
  });

  it('rejects invalid or out-of-range target close date before API call', async () => {
    render(<OpportunityForm />);
    fireEvent.change(screen.getByPlaceholderText(/Acme Corp/i), {
      target: { value: 'Valid Deal Name' },
    });

    const dateInput = document.querySelector('input[type="date"]');
    expect(dateInput).toBeInTheDocument();
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '12150-12-15' } });
    }

    fireEvent.click(screen.getByRole('button', { name: /Create Opportunity/i }));

    expect(toast.error).toHaveBeenCalledWith(
      'Please enter a valid target close date (between 1900 and 2100)',
    );
    expect(api.opportunitiesControllerCreate).not.toHaveBeenCalled();
  });

  it('surfaces backend error message instead of swallowing it when API call fails', async () => {
    const backendError = new Error('targetCloseDate must be a valid ISO 8601 date string');
    (api.opportunitiesControllerCreate as jest.Mock).mockRejectedValueOnce(backendError);

    render(<OpportunityForm />);
    fireEvent.change(screen.getByPlaceholderText(/Acme Corp/i), {
      target: { value: 'Apex Commercial Project' },
    });

    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '2026-12-15' } });
    }

    fireEvent.click(screen.getByRole('button', { name: /Create Opportunity/i }));

    await waitFor(() => {
      expect(api.opportunitiesControllerCreate).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        'targetCloseDate must be a valid ISO 8601 date string',
      );
    });
  });

  it('successfully creates opportunity and navigates to detail view', async () => {
    (api.opportunitiesControllerCreate as jest.Mock).mockResolvedValueOnce({
      data: { opportunityId: 'opp-created-123' },
    });

    render(<OpportunityForm />);
    fireEvent.change(screen.getByPlaceholderText(/Acme Corp/i), {
      target: { value: 'Apex Commercial Project' },
    });

    const dateInput = document.querySelector('input[type="date"]');
    if (dateInput) {
      fireEvent.change(dateInput, { target: { value: '2026-12-15' } });
    }

    fireEvent.click(screen.getByRole('button', { name: /Create Opportunity/i }));

    await waitFor(() => {
      expect(api.opportunitiesControllerCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Apex Commercial Project',
          targetCloseDate: expect.stringMatching(/^2026-12-15T/),
        }),
      );
      expect(toast.success).toHaveBeenCalledWith('Opportunity created successfully');
      expect(mockPush).toHaveBeenCalledWith('/crm/opportunities/opp-created-123');
    });
  });
});
