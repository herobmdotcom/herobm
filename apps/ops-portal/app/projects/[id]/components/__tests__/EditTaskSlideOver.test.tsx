import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditTaskSlideOver } from '../EditTaskSlideOver';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      editTaskTitle: 'Edit Task',
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
      'buttons.saveChanges': 'Save Changes',
      'buttons.saving': 'Saving...',
      cancel: 'Cancel',
    };
    const t = (key: string) => translations[key] || (namespace ? `${namespace}.${key}` : key);
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
}));

const mockTask: api.ProjectTaskResponseDto = {
  projectTaskId: 'task-1',
  projectId: 'prj-1',
  taskCode: '1.0',
  name: 'Foundation & Framing',
  description: 'Initial site foundation',
  stateCode: 'in_progress',
  isMilestone: false,
  isBillable: true,
};

const mockTasks: api.ProjectTaskResponseDto[] = [
  mockTask,
  {
    projectTaskId: 'task-2',
    projectId: 'prj-1',
    taskCode: '2.0',
    name: 'Roofing',
    stateCode: 'not_started',
    isMilestone: false,
    isBillable: true,
  },
];

describe('EditTaskSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnSubmit = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <EditTaskSlideOver
        isOpen={false}
        onClose={mockOnClose}
        task={mockTask}
        tasks={mockTasks}
        onSubmit={mockOnSubmit}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders preloaded task fields when open', () => {
    render(
      <EditTaskSlideOver
        isOpen={true}
        onClose={mockOnClose}
        task={mockTask}
        tasks={mockTasks}
        onSubmit={mockOnSubmit}
      />
    );

    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('1.0')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Foundation & Framing')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Initial site foundation')).toBeInTheDocument();
  });

  it('submits updated values correctly', async () => {
    render(
      <EditTaskSlideOver
        isOpen={true}
        onClose={mockOnClose}
        task={mockTask}
        tasks={mockTasks}
        onSubmit={mockOnSubmit}
      />
    );

    const nameInput = screen.getByDisplayValue('Foundation & Framing');
    fireEvent.change(nameInput, { target: { value: 'Foundation & Structure' } });

    const submitBtn = screen.getByRole('button', { name: 'Save Changes' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({
          name: 'Foundation & Structure',
        })
      );
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
