import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CrmActivityCard } from '../CrmActivityCard';
import { formatLocalDate } from '@/lib/date';
import type { CrmActivityResponseDto } from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) => {
    if (key === 'metadata.loggedBy') return `Logged by ${params?.user}`;
    if (key === 'tasks.due') return 'Due';
    if (key === 'tasks.overdue') return 'Overdue';
    if (key === 'tasks.completed') return 'Completed';
    return key;
  },
}));

describe('CrmActivityCard', () => {
  const baseTask: CrmActivityResponseDto = {
    activityId: 'task-1',
    type: 'task',
    subject: 'Follow up with client',
    status: 'open',
    priority: 'medium',
    dueDate: '2026-12-01T10:00:00Z',
    createdOn: '2026-09-01T10:00:00Z',
    modifiedOn: '2026-09-01T10:00:00Z',
    createdBy: 'admin',
    opportunityId: 'opp-100',
    opportunityName: 'Alpha Project',
    assignedToName: 'Frank Decesare',
  };

  it('renders task title, inline due date in same font, and priority badge on the right to the left of task owner', () => {
    render(<CrmActivityCard activity={baseTask} />);

    // Title
    const titleEl = screen.getByText('Follow up with client');
    expect(titleEl).toHaveClass('font-semibold', 'text-sm');

    // Due date inline in same font
    const dueDateEl = screen.getByText(/Due:/);
    expect(dueDateEl).toHaveClass('font-semibold', 'text-sm');
    expect(dueDateEl.textContent).toContain(formatLocalDate(baseTask.dueDate));

    // No calendar icon
    expect(screen.queryByText('calendar_today')).not.toBeInTheDocument();
    expect(screen.queryByText('event')).not.toBeInTheDocument();

    // Task owner
    const taskOwnerEl = screen.getByText('Frank Decesare');
    expect(taskOwnerEl).toBeInTheDocument();

    // Priority badge on the right, to the left of the task owner
    const priorityBadge = screen.getByText('priorities.medium');
    expect(priorityBadge).toBeInTheDocument();
    expect(priorityBadge.parentElement).toBe(taskOwnerEl.closest('.text-xs')?.parentElement);
    expect(priorityBadge.compareDocumentPosition(taskOwnerEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // No activity type badge (e.g. FOLLOW-UP TASK)
    expect(screen.queryByText('types.task')).not.toBeInTheDocument();
    expect(screen.queryByText('FOLLOW-UP TASK')).not.toBeInTheDocument();
  });

  it('renders overdue due date with red styling', () => {
    const overdueTask: CrmActivityResponseDto = {
      ...baseTask,
      dueDate: '2020-01-01T10:00:00Z',
    };

    render(<CrmActivityCard activity={overdueTask} />);

    const overdueEl = screen.getByText(/Overdue:/);
    expect(overdueEl).toHaveClass('text-rose-600');
    expect(overdueEl).toHaveClass('font-semibold', 'text-sm');
  });

  it('replaces due date with completed date when task is completed, and does not show completed in footer', () => {
    const completedTask: CrmActivityResponseDto = {
      ...baseTask,
      status: 'completed',
      completedAt: '2026-09-05T14:30:00Z',
    };

    render(<CrmActivityCard activity={completedTask} />);

    // Completed date replaces due date on header line
    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
    const completedEl = screen.getByText(/Completed:/);
    expect(completedEl).toHaveClass('font-semibold', 'text-sm', 'text-emerald-600');
    expect(completedEl.textContent).toContain(formatLocalDate(completedTask.completedAt));

    // Footer only has loggedBy and date
    expect(screen.getByText('Logged by admin')).toBeInTheDocument();
  });

  it('shows opportunity name link by default and on Dashboard, but hides it when showOpportunity is false', () => {
    const { rerender } = render(<CrmActivityCard activity={baseTask} showOpportunity={true} />);
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();

    rerender(<CrmActivityCard activity={baseTask} showOpportunity={false} />);
    expect(screen.queryByText('Alpha Project')).not.toBeInTheDocument();
  });

  it('does not render due date, priority, or completed date for non-task activities', () => {
    const callActivity: CrmActivityResponseDto = {
      activityId: 'call-1',
      type: 'call',
      subject: 'Discovery phone call',
      status: 'completed',
      priority: 'high',
      createdOn: '2026-09-01T10:00:00Z',
      modifiedOn: '2026-09-01T10:00:00Z',
      createdBy: 'admin',
    };

    render(<CrmActivityCard activity={callActivity} />);

    expect(screen.getByText('Discovery phone call')).toBeInTheDocument();
    expect(screen.getByText('call')).toBeInTheDocument(); // material symbol for call
    expect(screen.queryByText(/Due:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Completed:/)).not.toBeInTheDocument();
    expect(screen.queryByText('priorities.high')).not.toBeInTheDocument();
  });

  it('triggers onEdit when card is clicked and onToggleComplete when checkbox is clicked', () => {
    const onEdit = jest.fn();
    const onToggleComplete = jest.fn();

    render(
      <CrmActivityCard
        activity={baseTask}
        onEdit={onEdit}
        onToggleComplete={onToggleComplete}
      />,
    );

    // Clicking checkbox button triggers onToggleComplete, NOT onEdit
    const toggleBtn = screen.getByTitle('actions.markComplete');
    fireEvent.click(toggleBtn);
    expect(onToggleComplete).toHaveBeenCalledWith(baseTask);
    expect(onEdit).not.toHaveBeenCalled();

    // Clicking card triggers onEdit
    const card = screen.getByRole('button', { name: /Follow up with client/i });
    fireEvent.click(card);
    expect(onEdit).toHaveBeenCalledWith(baseTask);
  });
});
