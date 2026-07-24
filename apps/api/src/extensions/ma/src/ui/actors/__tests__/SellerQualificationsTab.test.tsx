import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import SellerQualificationsTab from '../SellerQualificationsTab';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';

jest.mock('@herobm/sdk', () => ({
  maGetSellerQualifications: jest.fn(),
  maAddSellerQualification: jest.fn(),
  maUpdateSellerQualification: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('SellerQualificationsTab', () => {
  const mockActorId = 'actor-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when there is no data', async () => {
    (api.maGetSellerQualifications as jest.Mock).mockResolvedValue({ data: [] });

    render(<SellerQualificationsTab actorId={mockActorId} />);
    
    expect(api.maGetSellerQualifications).toHaveBeenCalledWith(mockActorId);

    // Wait for the empty draft state to appear
    await waitFor(() => {
      expect(screen.getByText('SELLER QUALIFICATIONS')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    // Check if the specific textareas are rendered for the empty draft
    expect(screen.getByText('Market Context')).toBeInTheDocument();
    expect(screen.getByText('Competitive Environment')).toBeInTheDocument();
    expect(screen.getByText('Market Trends')).toBeInTheDocument();
    expect(screen.getByText('Added Value')).toBeInTheDocument();
    expect(screen.getByText('Specific Clients')).toBeInTheDocument();
    expect(screen.getByText('Business Model')).toBeInTheDocument();
    expect(screen.getByText('Consolidation Perspectives')).toBeInTheDocument();
    expect(screen.getByText('Interested Buyers Exist')).toBeInTheDocument(); // checkbox
  });

  it('renders correctly with populated snapshots', async () => {
    const mockData = [
      {
        qualificationId: 'q-1',
        snapshotName: 'Current Quarter',
        marketContext: 'Favorable',
        interestedBuyersExist: true,
      },
      {
        qualificationId: 'q-2',
        snapshotName: 'Previous Quarter',
        marketContext: 'Unfavorable',
        interestedBuyersExist: false,
      }
    ];

    (api.maGetSellerQualifications as jest.Mock).mockResolvedValue({ data: mockData });

    render(<SellerQualificationsTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Current Quarter')).toBeInTheDocument();
    });

    const contextInputs = screen.getAllByDisplayValue(/Favorable|Unfavorable/i);
    expect(contextInputs).toHaveLength(2);
    
    expect(contextInputs.map(i => (i as HTMLInputElement).value)).toContain('Favorable');
    expect(contextInputs.map(i => (i as HTMLInputElement).value)).toContain('Unfavorable');

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
  });

  it('creates a new snapshot when the add button is clicked', async () => {
    (api.maGetSellerQualifications as jest.Mock).mockResolvedValue({ data: [] });
    (api.maAddSellerQualification as jest.Mock).mockResolvedValue({});

    render(<SellerQualificationsTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add New Snapshot/i }));

    await waitFor(() => {
      expect(api.maAddSellerQualification).toHaveBeenCalledWith(mockActorId, {});
      expect(toast.success).toHaveBeenCalledWith('Snapshot created');
    });
  });

  it('updates a field on blur', async () => {
    const mockData = [
      {
        qualificationId: 'q-1',
        snapshotName: 'Current Quarter',
        marketContext: 'Favorable',
      }
    ];

    (api.maGetSellerQualifications as jest.Mock).mockResolvedValue({ data: mockData });
    (api.maUpdateSellerQualification as jest.Mock).mockResolvedValue({});

    render(<SellerQualificationsTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Current Quarter')).toBeInTheDocument();
    });

    const contextInput = screen.getByDisplayValue('Favorable');
    fireEvent.change(contextInput, { target: { value: 'Very Favorable' } });
    fireEvent.blur(contextInput);

    await waitFor(() => {
      expect(api.maUpdateSellerQualification).toHaveBeenCalledWith(mockActorId, 'q-1', { marketContext: 'Very Favorable' });
      expect(toast.success).toHaveBeenCalledWith('Saved');
    });
  });
});
