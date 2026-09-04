import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OpportunityKanbanBoard } from '../components/OpportunityKanbanBoard';
import type { OpportunityResponseDto } from '@herobm/sdk';

const STAGES = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'qualification', label: 'Qualification' },
  { value: 'won', label: 'Won' },
];

const mockOpportunities: OpportunityResponseDto[] = [
  {
    opportunityId: 'opp-1',
    name: 'Apollo Hospital Contract',
    status: 'prospect',
    type: 'commercial',
    stateCode: 'active',
    estimatedValue: '100000',
    currencyCode: 'USD',
    probability: 40,
    targetCloseDate: '2026-11-15T00:00:00.000Z',
    createdOn: '2026-09-01T00:00:00.000Z',
    modifiedOn: '2026-09-01T00:00:00.000Z',
    opportunityActors: [{ actor: { name: 'Apollo Health' } }],
  } as unknown as OpportunityResponseDto,
  {
    opportunityId: 'opp-2',
    name: 'Metro Transit System',
    status: 'prospect',
    type: 'infrastructure',
    stateCode: 'active',
    estimatedValue: '250000',
    currencyCode: 'USD',
    probability: 60,
    targetCloseDate: '2026-12-01T00:00:00.000Z',
    createdOn: '2026-09-02T00:00:00.000Z',
    modifiedOn: '2026-09-02T00:00:00.000Z',
    opportunityActors: [{ actor: { name: 'Metro Transit Auth' } }],
  } as unknown as OpportunityResponseDto,
  {
    opportunityId: 'opp-3',
    name: 'Harbor Warehouse Fitout',
    status: 'won',
    type: 'commercial',
    stateCode: 'active',
    estimatedValue: '80000',
    currencyCode: 'USD',
    probability: 100,
    targetCloseDate: '2026-09-10T00:00:00.000Z',
    createdOn: '2026-08-15T00:00:00.000Z',
    modifiedOn: '2026-09-03T00:00:00.000Z',
  } as unknown as OpportunityResponseDto,
];

describe('OpportunityKanbanBoard', () => {
  it('renders all stage columns with correct counts and formatted totals', () => {
    render(
      <OpportunityKanbanBoard
        opportunities={mockOpportunities}
        stages={STAGES}
        onMoveStage={jest.fn()}
      />,
    );

    // Columns
    expect(screen.getAllByText('Prospect')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Qualification')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Won')[0]).toBeInTheDocument();

    // Prospect cards
    expect(screen.getByText('Apollo Hospital Contract')).toBeInTheDocument();
    expect(screen.getByText('Metro Transit System')).toBeInTheDocument();

    // Won card
    expect(screen.getByText('Harbor Warehouse Fitout')).toBeInTheDocument();

    // Empty state on Qualification
    expect(screen.getByText('Drop deals here')).toBeInTheDocument();

    // Column totals: Prospect has $350,000 (100k + 250k)
    expect(screen.getByText(/350,000/)).toBeInTheDocument();
    expect(screen.getAllByText(/80,000/)[0]).toBeInTheDocument();
  });

  it('triggers onMoveStage when a card is dropped on a column', () => {
    const handleMoveStage = jest.fn();
    render(
      <OpportunityKanbanBoard
        opportunities={mockOpportunities}
        stages={STAGES}
        onMoveStage={handleMoveStage}
      />,
    );

    const wonHeader = screen.getAllByText('Won').find((el) => el.tagName === 'SPAN');
    expect(wonHeader).toBeDefined();
    const wonColumn = wonHeader!.closest('div')?.parentElement;
    expect(wonColumn).toBeInTheDocument();

    fireEvent.drop(wonColumn!, {
      dataTransfer: {
        getData: (format: string) => (format === 'text/plain' ? 'opp-1' : ''),
      },
    });

    expect(handleMoveStage).toHaveBeenCalledWith('opp-1', 'won');
  });
});
