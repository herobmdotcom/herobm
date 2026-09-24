import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreateTaskSlideOver } from '../CreateTaskSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      createTaskTitle: 'Create Task',
      'labels.taskCode': 'Task Code',
      'labels.taskName': 'Task Name',
      'labels.description': 'Description',
      'labels.parentTask': 'Parent Task',
      'labels.noneTopLevel': 'None (Top-level task)',
      'labels.startDate': 'Start Date',
      'labels.endDate': 'End Date',
      'labels.isMilestone': 'Milestone Task',
      'labels.isBillable': 'Billable to Customer',
      'placeholders.taskCode': 'e.g. 1.0',
      'placeholders.taskName': 'e.g. Site Survey',
      'placeholders.taskDescription': 'Task scope, deliverables, and requirements...',
      'buttons.addTask': 'Add Task',
      'buttons.saving': 'Saving...',
      cancel: 'Cancel',
    };
    const t = (key: string) => translations[key] || (namespace ? `${namespace}.${key}` : key);
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
}));

const mockTasks: api.ProjectTaskResponseDto[] = [
  {
    projectTaskId: 'task-1',
    projectId: 'prj-1',
    taskCode: '1.0',
    name: 'Foundation & Framing',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
];

describe('CreateTaskSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CreateTaskSlideOver
        isOpen={false}
        onClose={mockOnClose}
        tasks={mockTasks}
        onSubmit={mockOnSubmit}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders SlideOver with Task Code and Task Name labels when open (not Project Code / Name)', () => {
    render(
      <CreateTaskSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        onSubmit={mockOnSubmit}
      />
    );

    // Verify title
    expect(screen.getByText('Create Task')).toBeInTheDocument();

    // Verify field labels: Task Code and Task Name (NOT Project Code / Project Name)
    expect(screen.getByText(/Task Code/)).toBeInTheDocument();
    expect(screen.getByText(/Task Name/)).toBeInTheDocument();
    expect(screen.queryByText(/Project Code/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Project Name/)).not.toBeInTheDocument();

    // Verify placeholders
    expect(screen.getByPlaceholderText('e.g. 1.0')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Site Survey')).toBeInTheDocument();

    // Verify Parent Task option
    expect(screen.getByText('1.0 — Foundation & Framing')).toBeInTheDocument();
  });

  it('submits form with correct payload', async () => {
    render(
      <CreateTaskSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        onSubmit={mockOnSubmit}
      />
    );

    const codeInput = screen.getByPlaceholderText('e.g. 1.0');
    const nameInput = screen.getByPlaceholderText('e.g. Site Survey');
    const descInput = screen.getByPlaceholderText('Task scope, deliverables, and requirements...');

    fireEvent.change(codeInput, { target: { value: '2.0' } });
    fireEvent.change(nameInput, { target: { value: 'Electrical Engineering' } });
    fireEvent.change(descInput, { target: { value: 'Complete wiring harness design' } });

    const submitBtn = screen.getByRole('button', { name: 'Add Task' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          taskCode: '2.0',
          name: 'Electrical Engineering',
          description: 'Complete wiring harness design',
          isBillable: true,
          isMilestone: false,
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('calls onClose when clicking Cancel button', () => {
    render(
      <CreateTaskSlideOver
        isOpen={true}
        onClose={mockOnClose}
        tasks={mockTasks}
        onSubmit={mockOnSubmit}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
