import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import FeedbackTab from '../FeedbackTab';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';

jest.mock('@herobm/sdk', () => ({
  maControllerGetFeedback: jest.fn(),
  maControllerAddFeedback: jest.fn(),
  maControllerUpdateFeedback: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe('FeedbackTab', () => {
  const mockProjectId = 'project-123';
  const mockActors = [
    { actor: { actorId: 'a-1', name: 'Actor One' } },
    { actor: { actorId: 'a-2', name: 'Actor Two' } },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly when there is no data', async () => {
    (api.maControllerGetFeedback as jest.Mock).mockResolvedValue({ data: [] });

    render(<FeedbackTab projectId={mockProjectId} actors={mockActors} />);
    
    expect(api.maControllerGetFeedback).toHaveBeenCalledWith(mockProjectId);

    await waitFor(() => {
      expect(screen.getByText('PROJECT FEEDBACK')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    expect(screen.getByText('Actor')).toBeInTheDocument();
    expect(screen.getByText('Deal Proposal Reason')).toBeInTheDocument();
    expect(screen.getByText('Deal Refusal Reason')).toBeInTheDocument();
  });

  it('renders correctly with populated snapshots', async () => {
    const mockData = [
      {
        feedbackId: 'f-1',
        snapshotName: 'Initial Feedback',
        actorId: 'a-1',
        dealProposalReason: 'Good fit',
      },
      {
        feedbackId: 'f-2',
        snapshotName: 'Follow-up Feedback',
        actorId: 'a-2',
        dealProposalReason: 'Still a good fit',
      }
    ];

    (api.maControllerGetFeedback as jest.Mock).mockResolvedValue({ data: mockData });

    render(<FeedbackTab projectId={mockProjectId} actors={mockActors} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Initial Feedback')).toBeInTheDocument();
    });

    // The first item (latest) renders a <select> for the Actor
    const actorSelect = screen.getByRole('combobox');
    expect(actorSelect).toBeInTheDocument();
    expect(actorSelect).toHaveValue('a-1');

    const spans = screen.getAllByText('Actor Two');
    expect(spans.length).toBeGreaterThan(0);

    const proposalInputs = screen.getAllByDisplayValue(/fit/);
    expect(proposalInputs).toHaveLength(2);
    expect(proposalInputs[0]).toHaveValue('Good fit');
    expect(proposalInputs[1]).toHaveValue('Still a good fit');
  });

  it('creates a new snapshot when the add button is clicked', async () => {
    (api.maControllerGetFeedback as jest.Mock).mockResolvedValue({ data: [] });
    (api.maControllerAddFeedback as jest.Mock).mockResolvedValue({});

    render(<FeedbackTab projectId={mockProjectId} actors={mockActors} />);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add New Snapshot/i }));

    await waitFor(() => {
      expect(api.maControllerAddFeedback).toHaveBeenCalledWith(mockProjectId, { actorId: 'a-1' });
      expect(toast.success).toHaveBeenCalledWith('Feedback snapshot created');
    });
  });

  it('shows an error when trying to create a snapshot without actors', async () => {
    (api.maControllerGetFeedback as jest.Mock).mockResolvedValue({ data: [] });
    (api.maControllerAddFeedback as jest.Mock).mockResolvedValue({});

    render(<FeedbackTab projectId={mockProjectId} actors={[]} />); // No actors
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Add New Snapshot/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Add New Snapshot/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Please add actors to the project first.');
      expect(api.maControllerAddFeedback).not.toHaveBeenCalled();
    });
  });

  it('updates a field on blur', async () => {
    const mockData = [
      {
        feedbackId: 'f-1',
        snapshotName: 'Initial Feedback',
        actorId: 'a-1',
        dealProposalReason: 'Good fit',
      }
    ];

    (api.maControllerGetFeedback as jest.Mock).mockResolvedValue({ data: mockData });
    (api.maControllerUpdateFeedback as jest.Mock).mockResolvedValue({});

    render(<FeedbackTab projectId={mockProjectId} actors={mockActors} />);
    
    await waitFor(() => {
      expect(screen.getByDisplayValue('Initial Feedback')).toBeInTheDocument();
    });

    const proposalInput = screen.getByDisplayValue('Good fit');
    fireEvent.change(proposalInput, { target: { value: 'Great fit' } });
    fireEvent.blur(proposalInput);

    await waitFor(() => {
      expect(api.maControllerUpdateFeedback).toHaveBeenCalledWith(mockProjectId, 'f-1', { dealProposalReason: 'Great fit' });
      expect(toast.success).toHaveBeenCalledWith('Saved');
    });
  });
});
