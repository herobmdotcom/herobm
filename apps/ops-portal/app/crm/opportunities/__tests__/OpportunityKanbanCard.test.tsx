import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpportunityKanbanCard } from '../components/OpportunityKanbanCard';
import type { OpportunityResponseDto } from '@herobm/sdk';

const STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'won', label: 'Won' },
];

const mockOpp: OpportunityResponseDto = {
  opportunityId: 'opp-101',
  name: 'Global Cloud Migration',
  status: 'prospect',
  type: 'commercial',
  stateCode: 'active',
  estimatedValue: '500000',
  currencyCode: 'USD',
  probability: 75,
  targetCloseDate: '2026-12-31T00:00:00.000Z',
  createdOn: '2026-09-01T00:00:00.000Z',
  modifiedOn: '2026-09-01T00:00:00.000Z',
  opportunityActors: [
    { actor: { name: 'Acme Corporation' } },
  ],
} as unknown as OpportunityResponseDto;

describe('OpportunityKanbanCard', () => {
  it('renders opportunity details with deal value pill and probability', () => {
    render(
      <OpportunityKanbanCard
        opportunity={mockOpp}
        stages={STAGES}
        onMoveStage={jest.fn()}
      />,
    );

    expect(screen.getByText('Global Cloud Migration')).toBeInTheDocument();
    expect(screen.getByText('Acme Corporation')).toBeInTheDocument();
    expect(screen.getByText(/500,000/)).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('triggers onMoveStage when quick stage dropdown changes', () => {
    const handleMoveStage = jest.fn();
    render(
      <OpportunityKanbanCard
        opportunity={mockOpp}
        stages={STAGES}
        onMoveStage={handleMoveStage}
      />,
    );

    const select = screen.getByTitle('Change stage');
    fireEvent.change(select, { target: { value: 'proposal' } });

    expect(handleMoveStage).toHaveBeenCalledWith('opp-101', 'proposal');
  });
});
