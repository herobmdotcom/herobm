import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as api from '@herobm/sdk';
import CrmActivitiesSection from '../CrmActivitiesSection';

const mockT = (key: string) => key;
jest.mock('next-intl', () => ({
  useTranslations: () => mockT,
}));

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  crmActivitiesControllerFindAll: jest.fn(),
  crmActivitiesControllerComplete: jest.fn(),
  crmActivitiesControllerUpdate: jest.fn(),
}));

jest.mock('../LogActivityModal', () => {
  return function MockLogActivityModal({ isOpen }: { isOpen: boolean }) {
    return isOpen ? <div data-testid="mock-log-modal">Modal Open</div> : null;
  };
});

describe('CrmActivitiesSection', () => {
  const mockActivities = [
    {
      activityId: 'call-1',
      type: 'call',
      subject: 'Yesterday Discovery Call',
      status: 'completed',
      priority: 'medium',
      createdOn: '2026-09-06T10:00:00Z',
    },
    {
      activityId: 'meeting-1',
      type: 'meeting',
      subject: 'Today Morning Meeting',
      status: 'completed',
      priority: 'medium',
      createdOn: '2026-09-07T08:00:00Z',
    },
    {
      activityId: 'task-closed',
      type: 'task',
      subject: 'Older Completed Task',
      status: 'completed',
      priority: 'medium',
      completedAt: '2026-09-05T15:00:00Z',
      createdOn: '2026-09-05T10:00:00Z',
    },
    {
      activityId: 'task-open-late',
      type: 'task',
      subject: 'Open Task Due Next Week',
      status: 'open',
      priority: 'medium',
      dueDate: '2026-09-15T12:00:00Z',
      createdOn: '2026-09-01T10:00:00Z',
    },
    {
      activityId: 'task-open-soonest',
      type: 'task',
      subject: 'Open Task Due Tomorrow',
      status: 'open',
      priority: 'urgent',
      dueDate: '2026-09-08T12:00:00Z',
      createdOn: '2026-09-02T10:00:00Z',
    },
    {
      activityId: 'task-open-nodue',
      type: 'task',
      subject: 'Open Task Without Due Date',
      status: 'open',
      priority: 'low',
      dueDate: null,
      createdOn: '2026-09-04T10:00:00Z',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (api.crmActivitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: {
        data: mockActivities,
        total: mockActivities.length,
      },
    });
  });

  it('orders open tasks at top by due date soonest first, followed by natural ordering for other activities and closed tasks', async () => {
    await act(async () => {
      render(
        <CrmActivitiesSection
          entityType="opportunity"
          entityId="opp-123"
          entityName="Enterprise Deal"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Open Task Due Tomorrow')).toBeInTheDocument();
    });

    const renderedCards = screen.getAllByRole('button');
    const subjects = renderedCards
      .map((el) => el.querySelector('span.font-semibold')?.textContent)
      .filter(Boolean);

    // Expected order:
    // 1. Open Task Due Tomorrow (soonest due date)
    // 2. Open Task Due Next Week (later due date)
    // 3. Open Task Without Due Date (open task, nulls last)
    // 4. Today Morning Meeting (newest interaction, 2026-09-07)
    // 5. Yesterday Discovery Call (interaction, 2026-09-06)
    // 6. Older Completed Task (closed task in natural order, 2026-09-05)
    expect(subjects).toEqual([
      'Open Task Due Tomorrow',
      'Open Task Due Next Week',
      'Open Task Without Due Date',
      'Today Morning Meeting',
      'Yesterday Discovery Call',
      'Older Completed Task',
    ]);
  });

  it('filters by tasks tab and keeps open tasks first by due date then closed tasks', async () => {
    await act(async () => {
      render(
        <CrmActivitiesSection
          entityType="opportunity"
          entityId="opp-123"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Open Task Due Tomorrow')).toBeInTheDocument();
    });

    // Switch to Tasks tab
    const tasksTab = screen.getByRole('tab', { name: /filter\.tasks/i });
    await act(async () => {
      fireEvent.click(tasksTab);
    });

    const renderedCards = screen.getAllByRole('button');
    const subjects = renderedCards
      .map((el) => el.querySelector('span.font-semibold')?.textContent)
      .filter(Boolean);

    expect(subjects).toEqual([
      'Open Task Due Tomorrow',
      'Open Task Due Next Week',
      'Open Task Without Due Date',
      'Older Completed Task',
    ]);
  });

  it('filters by interactions tab and displays interactions in natural ordering', async () => {
    await act(async () => {
      render(
        <CrmActivitiesSection
          entityType="opportunity"
          entityId="opp-123"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Today Morning Meeting')).toBeInTheDocument();
    });

    // Switch to Interactions tab
    const interactionsTab = screen.getByRole('tab', { name: /filter\.interactions/i });
    await act(async () => {
      fireEvent.click(interactionsTab);
    });

    const renderedCards = screen.getAllByRole('button');
    const subjects = renderedCards
      .map((el) => el.querySelector('span.font-semibold')?.textContent)
      .filter(Boolean);

    expect(subjects).toEqual([
      'Today Morning Meeting',
      'Yesterday Discovery Call',
    ]);
  });

  it('toggles task completion and reorganizes list dynamically', async () => {
    (api.crmActivitiesControllerComplete as jest.Mock).mockResolvedValue({
      data: { success: true },
    });

    await act(async () => {
      render(
        <CrmActivitiesSection
          entityType="opportunity"
          entityId="opp-123"
        />,
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Open Task Due Tomorrow')).toBeInTheDocument();
    });

    // Find the toggle button inside the "Open Task Due Tomorrow" card
    const card = screen.getByText('Open Task Due Tomorrow').closest('[role="button"]');
    expect(card).toBeInTheDocument();
    const toggleBtn = card?.querySelector('button[title="actions.markComplete"]');
    expect(toggleBtn).toBeInTheDocument();

    // Click to complete
    await act(async () => {
      fireEvent.click(toggleBtn!);
    });

    // Now "Open Task Due Tomorrow" is completed, so it moves into the "others" group (natural order by createdOn)
    const renderedCards = screen.getAllByRole('button');
    const subjects = renderedCards
      .map((el) => el.querySelector('span.font-semibold')?.textContent)
      .filter(Boolean);

    expect(subjects).toEqual([
      'Open Task Due Next Week',
      'Open Task Without Due Date',
      'Today Morning Meeting',
      'Yesterday Discovery Call',
      'Older Completed Task',
      'Open Task Due Tomorrow',
    ]);
  });
});
