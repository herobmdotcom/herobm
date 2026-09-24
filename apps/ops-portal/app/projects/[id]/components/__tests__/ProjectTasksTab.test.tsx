import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectTasksTab } from '../ProjectTasksTab';
import * as api from '@herobm/sdk';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'tabs.wbs': 'WBS',
      'columns.taskCode': 'Code',
      'columns.taskName': 'Task Name',
      'columns.status': 'Status',
      'labels.isMilestone': 'Milestone',
      'labels.isBillable': 'Billable',
      'buttons.addTask': 'Add Task',
      'buttons.editTask': 'Edit Task',
      'buttons.deleteTask': 'Delete Task',
      'labels.taskCode': 'Task Code',
      'labels.taskName': 'Task Name',
      'labels.description': 'Description',
      'placeholders.taskCode': 'e.g. 1.0',
      'placeholders.taskName': 'e.g. Site Survey',
      'placeholders.taskDescription': 'Task scope, deliverables, and requirements...',
      confirmDeleteTask: 'Are you sure you want to delete this task?',
      completeTask: 'Are you sure you want to complete this task?',
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
    name: 'Engineering & Design',
    description: 'Electrical and mechanical schematics',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
  {
    projectTaskId: 'task-2',
    projectId: 'prj-1',
    taskCode: '2.0',
    name: 'Hardware Assembly',
    stateCode: 'not_started',
    isMilestone: true,
    isBillable: true,
  },
  {
    projectTaskId: 'task-3',
    projectId: 'prj-1',
    taskCode: '3.0',
    name: 'Unbudgeted Prototype Run',
    stateCode: 'not_started',
    isMilestone: false,
    isBillable: false,
  },
];

describe('ProjectTasksTab', () => {
  const mockCreateTask = jest.fn().mockResolvedValue(undefined);
  const mockUpdateTask = jest.fn().mockResolvedValue(undefined);
  const mockDeleteTask = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders WBS table with tasks and core deliverable columns', () => {
    render(
      <ProjectTasksTab
        tasks={mockTasks}
        isEditable={true}
        isProjectActive={true}
        saving={false}
        createTask={mockCreateTask}
        updateTask={mockUpdateTask}
        deleteTask={mockDeleteTask}
      />
    );

    // Verify task names and codes
    expect(screen.getAllByText('1.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Engineering & Design').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2.0').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Hardware Assembly').length).toBeGreaterThanOrEqual(1);

    // Verify column headers
    expect(screen.getByRole('columnheader', { name: 'Code' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Task Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Milestone' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Billable' })).toBeInTheDocument();

    // Verify Budget Use column header is NOT present in WBS table
    expect(screen.queryByRole('columnheader', { name: 'Budget Use' })).toBeNull();
  });

  it('renders empty placeholder when no tasks defined', () => {
    render(
      <ProjectTasksTab
        tasks={[]}
        isEditable={true}
        isProjectActive={true}
        saving={false}
        createTask={mockCreateTask}
        updateTask={mockUpdateTask}
        deleteTask={mockDeleteTask}
      />
    );

    expect(screen.getAllByText(/No tasks defined for this project yet/i).length).toBeGreaterThanOrEqual(1);
  });

  it('opens Add Task slide-over when clicking Add Task button', () => {
    render(
      <ProjectTasksTab
        tasks={mockTasks}
        isEditable={true}
        isProjectActive={true}
        saving={false}
        createTask={mockCreateTask}
        updateTask={mockUpdateTask}
        deleteTask={mockDeleteTask}
      />
    );

    const addBtn = screen.getByRole('button', { name: 'Add Task' });
    fireEvent.click(addBtn);

    expect(screen.getByPlaceholderText('e.g. 1.0')).toBeInTheDocument();
  });
});
