import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import StrategicIntelligenceTab from '../StrategicIntelligenceTab';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';

jest.mock('@herobm/sdk', () => ({
  maGetStrategicIntelligence: jest.fn(),
  maAddStrategicIntelligence: jest.fn(),
  maUpdateStrategicIntelligence: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('StrategicIntelligenceTab', () => {
  const mockActorId = 'actor-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when there is no data', async () => {
    (api.maGetStrategicIntelligence as jest.Mock).mockResolvedValue({ data: [] });

    render(<StrategicIntelligenceTab actorId={mockActorId} />);
    
    expect(api.maGetStrategicIntelligence).toHaveBeenCalledWith(mockActorId);

    // Wait for the empty draft state to appear
    await waitFor(() => {
      expect(screen.getByText('STRATEGIC INTELLIGENCE')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    // Check if the specific textareas are rendered for the empty draft
    expect(screen.getByText('Timeline')).toBeInTheDocument();
    expect(screen.getByText('Manager Intent')).toBeInTheDocument();
    expect(screen.getByText('Sector Interests')).toBeInTheDocument();
    expect(screen.getByText('External Growth Projects')).toBeInTheDocument();
    expect(screen.getByText('Future Sale Intent')).toBeInTheDocument();
    expect(screen.getByText('Strategic Rationale')).toBeInTheDocument();
  });

  it('renders correctly with populated snapshots', async () => {
    const mockData = [
      {
        intelligenceId: 'i-1',
        snapshotName: 'Current Quarter',
        timeline: 'Q3',
        managerIntent: 'Expand',
      },
      {
        intelligenceId: 'i-2',
        snapshotName: 'Previous Quarter',
        timeline: 'Q2',
        managerIntent: 'Hold',
      }
    ];

    (api.maGetStrategicIntelligence as jest.Mock).mockResolvedValue({ data: mockData });

    render(<StrategicIntelligenceTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Current Quarter')).toBeInTheDocument();
    });

    const timelineInputs = screen.getAllByDisplayValue(/Q[23]/);
    expect(timelineInputs).toHaveLength(2);
    
    expect(timelineInputs[0]).toHaveValue('Q3');
    expect(timelineInputs[1]).toHaveValue('Q2');
  });

  it('creates a new snapshot when the add button is clicked', async () => {
    (api.maGetStrategicIntelligence as jest.Mock).mockResolvedValue({ data: [] });
    (api.maAddStrategicIntelligence as jest.Mock).mockResolvedValue({});

    render(<StrategicIntelligenceTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add New Snapshot/i }));

    await waitFor(() => {
      expect(api.maAddStrategicIntelligence).toHaveBeenCalledWith(mockActorId, {});
      expect(toast.success).toHaveBeenCalledWith('Snapshot created');
    });
  });

  it('updates a field on blur', async () => {
    const mockData = [
      {
        intelligenceId: 'i-1',
        snapshotName: 'Current Quarter',
        timeline: 'Q3',
      }
    ];

    (api.maGetStrategicIntelligence as jest.Mock).mockResolvedValue({ data: mockData });
    (api.maUpdateStrategicIntelligence as jest.Mock).mockResolvedValue({});

    render(<StrategicIntelligenceTab actorId={mockActorId} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Current Quarter')).toBeInTheDocument();
    });

    const timelineInput = screen.getByDisplayValue('Q3');
    fireEvent.change(timelineInput, { target: { value: 'Q4' } });
    fireEvent.blur(timelineInput);

    await waitFor(() => {
      expect(api.maUpdateStrategicIntelligence).toHaveBeenCalledWith(mockActorId, 'i-1', { timeline: 'Q4' });
      expect(toast.success).toHaveBeenCalledWith('Saved');
    });
  });
});
