import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import * as api from '@herobm/sdk';
import DashboardTasksWidget from '../DashboardTasksWidget';

const mockT = (key: string) => key;
jest.mock('next-intl', () => ({
  useTranslations: () => mockT,
}));

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  crmActivitiesControllerFindAll: jest.fn(),
  crmActivitiesControllerComplete: jest.fn(),
}));

jest.mock('@/components/shared/LogActivityModal', () => {
  return function MockLogActivityModal({ isOpen }: { isOpen: boolean }) {
    return isOpen ? <div data-testid="mock-log-activity-modal">Modal Open</div> : null;
  };
});

describe('DashboardTasksWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders section title and task list for current user', async () => {
    (api.crmActivitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            activityId: 'task-1',
            type: 'task',
            subject: 'Review supplier contract',
            priority: 'high',
            status: 'open',
            dueDate: '2026-10-01T12:00:00Z',
          },
        ],
        total: 1,
      },
    });

    await act(async () => {
      render(<DashboardTasksWidget />);
    });

    // Section title
    expect(screen.getByText('title')).toBeInTheDocument();
    // New task button
    expect(screen.getByText('newTask')).toBeInTheDocument();

    await waitFor(() => {
      expect(api.crmActivitiesControllerFindAll).toHaveBeenCalledWith({
        status: 'open',
        myTasks: 'true',
        limit: 10,
      });
      expect(screen.getByText('Review supplier contract')).toBeInTheDocument();
    });
  });

  it('renders compact empty state when there are no open tasks', async () => {
    (api.crmActivitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: {
        data: [],
        total: 0,
      },
    });

    await act(async () => {
      render(<DashboardTasksWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('empty')).toBeInTheDocument();
    });
  });

  it('opens LogActivityModal when New Task button is clicked', async () => {
    (api.crmActivitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: { data: [], total: 0 },
    });

    await act(async () => {
      render(<DashboardTasksWidget />);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('newTask'));
    });
    expect(screen.getByTestId('mock-log-activity-modal')).toBeInTheDocument();
  });

  it('opens LogActivityModal when a task card is clicked for editing', async () => {
    (api.crmActivitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            activityId: 'task-1',
            type: 'task',
            subject: 'Review contract terms',
            status: 'open',
            priority: 'urgent',
            dueDate: '2026-10-01T12:00:00Z',
          },
        ],
        total: 1,
      },
    });

    await act(async () => {
      render(<DashboardTasksWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('Review contract terms')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Review contract terms'));
    });

    expect(screen.getByTestId('mock-log-activity-modal')).toBeInTheDocument();
  });

  it('orders tasks by Due Date soonest first and puts tasks without due date last', async () => {
    (api.crmActivitiesControllerFindAll as jest.Mock).mockResolvedValue({
      data: {
        data: [
          {
            activityId: 'task-later',
            type: 'task',
            subject: 'Task Due Later',
            status: 'open',
            priority: 'medium',
            dueDate: '2026-10-15T12:00:00Z',
            createdOn: '2026-09-01T10:00:00Z',
          },
          {
            activityId: 'task-nodue',
            type: 'task',
            subject: 'Task Without Due Date',
            status: 'open',
            priority: 'low',
            dueDate: null,
            createdOn: '2026-09-02T10:00:00Z',
          },
          {
            activityId: 'task-soonest',
            type: 'task',
            subject: 'Task Due Tomorrow',
            status: 'open',
            priority: 'urgent',
            dueDate: '2026-09-08T12:00:00Z',
            createdOn: '2026-09-03T10:00:00Z',
          },
        ],
        total: 3,
      },
    });

    await act(async () => {
      render(<DashboardTasksWidget />);
    });

    await waitFor(() => {
      expect(screen.getByText('Task Due Tomorrow')).toBeInTheDocument();
    });

    const renderedCards = screen.getAllByRole('button');
    // Filter to task cards (cards with subject texts)
    const taskSubjects = renderedCards
      .map((el) => el.querySelector('span.font-semibold')?.textContent)
      .filter(Boolean);

    expect(taskSubjects).toEqual([
      'Task Due Tomorrow',
      'Task Due Later',
      'Task Without Due Date',
    ]);
  });
});

