import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import BuyerQualificationsTab from '../BuyerQualificationsTab';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';

jest.mock('@herobm/sdk', () => ({
  maGetBuyerQualifications: jest.fn(),
  maAddBuyerQualification: jest.fn(),
  maUpdateBuyerQualification: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('BuyerQualificationsTab', () => {
  const mockActorId = 'actor-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when there is no data', async () => {
    (api.maGetBuyerQualifications as jest.Mock).mockResolvedValue({ data: [] });

    render(<BuyerQualificationsTab actorId={mockActorId} />);
    
    expect(api.maGetBuyerQualifications).toHaveBeenCalledWith(mockActorId);

    // Wait for the empty draft state to appear
    await waitFor(() => {
      expect(screen.getByText('BUYER QUALIFICATIONS')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    // Check if the specific textareas are rendered for the empty draft
    expect(screen.getByText('Buyer Activity')).toBeInTheDocument();
    expect(screen.getByText('Business Model')).toBeInTheDocument();
    expect(screen.getByText('Geography')).toBeInTheDocument();
    expect(screen.getByText('Size Criteria')).toBeInTheDocument();
    expect(screen.getByText('Financial Capacity')).toBeInTheDocument();
    expect(screen.getByText('Strategic Fit')).toBeInTheDocument();
  });

  it('renders correctly with populated snapshots', async () => {
    const mockData = [
      {
        qualificationId: 'q-1',
        snapshotName: 'Current Quarter',
        buyerActivity: 'Active',
        businessModel: 'B2B',
      },
      {
        qualificationId: 'q-2',
        snapshotName: 'Previous Quarter',
        buyerActivity: 'Passive',
        businessModel: 'B2C',
      }
    ];

    (api.maGetBuyerQualifications as jest.Mock).mockResolvedValue({ data: mockData });

    render(<BuyerQualificationsTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Current Quarter')).toBeInTheDocument();
    });

    // Since there are 2 items, there should be 2 'Buyer Activity' textareas
    // Wait, the first item uses snapshot draft fields plus inputs, the second item uses headings plus inputs.
    // Actually the SnapshotTabContainer renders label + textarea for each item.
    const activityInputs = screen.getAllByDisplayValue(/assive|Active/);
    expect(activityInputs).toHaveLength(2);
    
    // Note: order is not guaranteed, but they are both rendered
    expect(activityInputs.map(i => (i as HTMLInputElement).value)).toContain('Active');
    expect(activityInputs.map(i => (i as HTMLInputElement).value)).toContain('Passive');
  });

  it('creates a new snapshot when the add button is clicked', async () => {
    (api.maGetBuyerQualifications as jest.Mock).mockResolvedValue({ data: [] });
    (api.maAddBuyerQualification as jest.Mock).mockResolvedValue({});

    render(<BuyerQualificationsTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add New Snapshot/i }));

    await waitFor(() => {
      expect(api.maAddBuyerQualification).toHaveBeenCalledWith(mockActorId, {});
      expect(toast.success).toHaveBeenCalledWith('Snapshot created');
    });
  });

  it('updates a field on blur', async () => {
    const mockData = [
      {
        qualificationId: 'q-1',
        snapshotName: 'Current Quarter',
        buyerActivity: 'Active',
      }
    ];

    (api.maGetBuyerQualifications as jest.Mock).mockResolvedValue({ data: mockData });
    (api.maUpdateBuyerQualification as jest.Mock).mockResolvedValue({});

    render(<BuyerQualificationsTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Current Quarter')).toBeInTheDocument();
    });

    const activityInput = screen.getByDisplayValue('Active');
    fireEvent.change(activityInput, { target: { value: 'Very Active' } });
    fireEvent.blur(activityInput);

    await waitFor(() => {
      expect(api.maUpdateBuyerQualification).toHaveBeenCalledWith(mockActorId, 'q-1', { buyerActivity: 'Very Active' });
      expect(toast.success).toHaveBeenCalledWith('Saved');
    });
  });
});
