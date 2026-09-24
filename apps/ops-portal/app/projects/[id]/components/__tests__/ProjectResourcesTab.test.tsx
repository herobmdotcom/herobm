import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectResourcesTab } from '../ProjectResourcesTab';
import * as api from '@herobm/sdk';
import type { ProjectResource } from '../../useProject';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'tabs.resources': 'Resources',
      'resources.consumptionSubtitle': 'Track team allocations, active personnel, and actual hours logged against project tasks.',
      'sections.timeLog': 'Resource Usage',
      'resources.typePerson': 'Person',
      'resources.typeContractor': 'Contractor',
      'resources.typeEquipment': 'Equipment',
      'buttons.consumeResource': 'Consume',
      'buttons.assignResource': 'Assign',
      'buttons.addResource': 'Assign',
      'buttons.removeResource': 'Remove Resource from Project',
      'confirmDeleteTimeEntry': 'Are you sure you want to delete this resource usage entry?',
      'resources.assignSlideOverTitle': 'Assign Resource to Project',
      'labels.task': 'Task',
      'columns.resourceName': 'Resource Name',
      'columns.resourceType': 'Type',
      'columns.service': 'Service',
      'columns.tasksWorked': 'Tasks Worked',
      'columns.consumed': 'Consumed',
      'columns.consumedHours': 'Consumed Hours',
      'columns.lastActivity': 'Last Activity',
      'columns.date': 'Date',
      'columns.quantity': 'Quantity',
      'columns.loggedHours': 'Logged Hours',
      'columns.notes': 'Notes',
      'columns.createdBy': 'Created By',
    };
    const t = (key: string) => translations[key] || (namespace ? `${namespace}.${key}` : key);
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
}));

jest.mock('@herobm/sdk', () => {
  const actual = jest.requireActual('@herobm/sdk');
  return {
    ...actual,
    __esModule: true,
    productsControllerFindAll: jest.fn().mockResolvedValue({ data: [] }),
    projectsControllerFindAllResources: jest.fn().mockResolvedValue({ data: [] }),
    projectsControllerGetLedgerEntries: jest.fn().mockResolvedValue({ data: [] }),
  };
});

const mockResources: ProjectResource[] = [
  {
    resourceId: 'res-1',
    resourceType: 'person',
    resourceCode: 'RES-001',
    name: 'Sarah Jenkins',
    baseUom: 'hours',
    directUnitCost: '80',
    unitPrice: '150',
    isActive: true,
  },
  {
    resourceId: 'res-2',
    resourceType: 'contractor',
    resourceCode: 'CON-002',
    name: 'Apex Electrical Contractors',
    serviceProduct: {
      productId: 'srv-1',
      productNumber: 'SRV-001',
      name: 'Electrical Engineering',
    },
    baseUom: 'hours',
    directUnitCost: '95',
    unitPrice: '160',
    isActive: true,
  },
  {
    resourceId: 'res-3',
    resourceType: 'equipment',
    resourceCode: 'EQP-003',
    name: '25 Ton Crane',
    baseUom: 'DAY',
    directUnitCost: '400',
    unitPrice: '800',
    isActive: true,
  },
];

const mockAssignedResources: api.ProjectResourceAssignmentResponseDto[] = [
  {
    assignmentId: 'asg-1',
    projectId: 'prj-1',
    resourceId: 'res-1',
    notes: 'Lead engineer',
    createdOn: '2026-09-01T00:00:00Z',
    resource: mockResources[0] as unknown as api.ProjectResourceResponseDto,
  },
  {
    assignmentId: 'asg-2',
    projectId: 'prj-1',
    resourceId: 'res-2',
    createdOn: '2026-09-01T00:00:00Z',
    resource: mockResources[1] as unknown as api.ProjectResourceResponseDto,
  },
];

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
  {
    projectTaskId: 'task-2',
    projectId: 'prj-1',
    taskCode: '2.0',
    name: 'Control Panel Wiring',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
];

const mockLedgerEntries: api.ProjectLedgerEntryResponseDto[] = [
  {
    ledgerId: 'led-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    resourceId: 'res-1',
    lineType: 'resource',
    entryType: 'usage',
    sourceType: 'timesheet',
    description: 'Initial site engineering review',
    quantity: '16',
    unitCostBase: '80',
    totalCostBase: '1280',
    unitPriceBase: '150',
    totalPriceBase: '2400',
    postingDate: '2026-09-18T10:00:00Z',
    createdBy: 'admin',
    isBilled: false,
  },
  {
    ledgerId: 'led-2',
    projectId: 'prj-1',
    projectTaskId: 'task-2',
    resourceId: 'res-1',
    lineType: 'resource',
    entryType: 'usage',
    sourceType: 'timesheet',
    description: 'Panel layout review',
    quantity: '8.5',
    unitCostBase: '80',
    totalCostBase: '680',
    unitPriceBase: '150',
    totalPriceBase: '1275',
    postingDate: '2026-09-19T14:30:00Z',
    createdBy: 'admin',
    isBilled: false,
  },
  {
    ledgerId: 'led-3',
    projectId: 'prj-1',
    projectTaskId: 'task-2',
    resourceId: 'res-2',
    lineType: 'resource',
    entryType: 'usage',
    sourceType: 'timesheet',
    description: 'Electrical wiring execution',
    quantity: '24',
    unitCostBase: '95',
    totalCostBase: '2280',
    unitPriceBase: '160',
    totalPriceBase: '3840',
    postingDate: '2026-09-20T16:00:00Z',
    createdBy: 'admin',
    isBilled: false,
  },
  {
    ledgerId: 'led-4',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    resourceId: 'res-3',
    lineType: 'resource',
    entryType: 'usage',
    sourceType: 'timesheet',
    description: 'Crane onsite operation',
    quantity: '2',
    unitCostBase: '400',
    totalCostBase: '800',
    unitPriceBase: '800',
    totalPriceBase: '1600',
    postingDate: '2026-09-21T09:00:00Z',
    createdBy: 'admin',
    isBilled: false,
  },
];

describe('ProjectResourcesTab', () => {
  it('renders resource consumption summary aggregating consumed quantity and tasks worked with dynamic UoM', () => {
    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
      />
    );

    // Verify summary table headers focus on consumption rather than pricing
    expect(screen.getAllByRole('columnheader', { name: /Resource Name/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Type/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Service/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Tasks Worked/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Notes/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Consumed/i }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('columnheader', { name: /Last Activity/i }).length).toBeGreaterThanOrEqual(1);

    // Verify assignment notes
    expect(screen.getAllByText('Lead engineer').length).toBeGreaterThanOrEqual(1);

    // Verify aggregated resource units with proper UoMs and service names:
    // Sarah Jenkins: 16 + 8.5 = 24.5 hours
    // Apex Electrical: 24 hours, service: Electrical Engineering
    // 25 Ton Crane: 2 DAY
    expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('24.5 hours').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Apex Electrical Contractors').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Electrical Engineering').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('24 hours').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('25 Ton Crane').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('2.0 DAY').length).toBeGreaterThanOrEqual(1);
  });

  it('renders assigned resources in roster even when no consumption has occurred yet', () => {
    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={[]}
        currency="USD"
        isEditable={true}
      />
    );

    expect(screen.getAllByText('Sarah Jenkins').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Apex Electrical Contractors').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('0.0 hours').length).toBeGreaterThanOrEqual(2);
  });

  it('renders detailed time & usage log card showing chronological entries', () => {
    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
      />
    );

    expect(screen.getByText('Resource Usage')).toBeInTheDocument();
    expect(screen.getAllByText('Initial site engineering review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Panel layout review').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Electrical wiring execution').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Assign (secondary standard button) and Consume (primary action button) in correct order', () => {
    const mockConsumeResource = jest.fn().mockResolvedValue(undefined);
    const mockAssignResource = jest.fn().mockResolvedValue(undefined);

    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        consumeResource={mockConsumeResource}
        assignResourceToProject={mockAssignResource}
      />
    );

    const assignBtn = screen.getByRole('button', { name: 'Assign' });
    const consumeBtn = screen.getByRole('button', { name: 'Consume' });

    expect(assignBtn).toBeInTheDocument();
    expect(consumeBtn).toBeInTheDocument();

    // Assign is secondary (standard button) and Consume is primary (action button)
    expect(assignBtn).toHaveClass('bg-[var(--bg-card)]');
    expect(consumeBtn).toHaveClass('bg-[var(--accent)]');

    // Button order check: Assign comes before Consume
    expect(assignBtn.compareDocumentPosition(consumeBtn)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    // Clicking Assign opens the Assign slideover
    fireEvent.click(assignBtn);
    expect(screen.getByRole('heading', { name: 'Assign Resource to Project' })).toBeInTheDocument();
  });

  it('renders log time and remove buttons on assigned resource rows and edit/delete on time log', () => {
    const mockRemoveResource = jest.fn().mockResolvedValue(undefined);
    const mockConsumeResource = jest.fn().mockResolvedValue(undefined);
    const mockUpdateLedgerEntry = jest.fn().mockResolvedValue(undefined);
    const mockDeleteLedgerEntry = jest.fn().mockResolvedValue(undefined);

    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        removeResourceFromProject={mockRemoveResource}
        consumeResource={mockConsumeResource}
        updateLedgerEntry={mockUpdateLedgerEntry}
        deleteLedgerEntry={mockDeleteLedgerEntry}
      />
    );

    // Summary table log time & remove buttons
    const logTimeBtns = screen.getAllByTitle('Consume');
    expect(logTimeBtns.length).toBeGreaterThanOrEqual(1);

    const removeBtns = screen.getAllByTitle('Remove from Project Roster');
    expect(removeBtns.length).toBeGreaterThanOrEqual(1);

    // Time log table edit & delete buttons
    const editTimeBtns = screen.getAllByTitle('Edit Time Entry');
    expect(editTimeBtns.length).toBe(mockLedgerEntries.length * 2);

    const deleteTimeBtns = screen.getAllByTitle('Delete Time Entry');
    expect(deleteTimeBtns.length).toBe(mockLedgerEntries.length * 2);
  });

  it('triggers remove resource from project when confirmed', async () => {
    const mockRemoveResource = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        removeResourceFromProject={mockRemoveResource}
      />
    );

    const removeBtn = screen.getAllByTitle('Remove from Project Roster')[0];
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockRemoveResource).toHaveBeenCalled();
    });

    (window.confirm as jest.Mock).mockRestore();
  });

  it('triggers delete on time log entry when confirmed', async () => {
    const mockDeleteLedgerEntry = jest.fn().mockResolvedValue(undefined);

    jest.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        deleteLedgerEntry={mockDeleteLedgerEntry}
      />
    );

    const deleteBtns = screen.getAllByTitle('Delete Time Entry');
    fireEvent.click(deleteBtns[0]);

    await waitFor(() => {
      expect(mockDeleteLedgerEntry).toHaveBeenCalledWith('led-1');
    });

    (window.confirm as jest.Mock).mockRestore();
  });

  it('opens EditResourceUsageSlideOver when clicking edit on a time log entry', () => {
    const mockUpdateLedgerEntry = jest.fn().mockResolvedValue(undefined);

    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        updateLedgerEntry={mockUpdateLedgerEntry}
      />
    );

    const editBtns = screen.getAllByTitle('Edit Time Entry');
    fireEvent.click(editBtns[0]);

    // Check that Edit Resource Usage slideover is rendered with form fields
    expect(screen.getByText('Edit Resource Usage')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Initial site engineering review')).toBeInTheDocument();
  });

  it('opens Consume slideover with prefilled resource when clicking log time on a resource row', () => {
    const mockConsumeResource = jest.fn().mockResolvedValue(undefined);

    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        consumeResource={mockConsumeResource}
      />
    );

    const logTimeBtns = screen.getAllByTitle('Consume');
    fireEvent.click(logTimeBtns[0]);

    expect(screen.getByRole('heading', { name: 'Consume' })).toBeInTheDocument();
  });

  it('refreshes resource ledger entries when consuming a resource', async () => {
    const mockConsumeResource = jest.fn().mockResolvedValue(undefined);
    const mockReloadProject = jest.fn().mockResolvedValue(undefined);

    (api.projectsControllerGetLedgerEntries as jest.Mock).mockResolvedValue({
      data: {
        data: [
          ...mockLedgerEntries,
          {
            ledgerId: 'led-new',
            projectId: 'prj-1',
            projectTaskId: 'task-1',
            entryType: 'usage',
            lineType: 'resource',
            sourceType: 'timesheet',
            resourceId: 'res-1',
            description: 'Newly logged resource usage',
            quantity: '5',
            unitCostBase: '80.00',
            totalCostBase: '400.00',
            unitPriceBase: '150.00',
            totalPriceBase: '750.00',
            isBilled: false,
            postingDate: '2026-03-20T10:00:00Z',
            createdBy: 'admin',
          },
        ],
        total: 4,
        hasMore: false,
      },
    });

    render(
      <ProjectResourcesTab
        projectId="prj-1"
        projectNumber="PRJ-2026-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResources={mockAssignedResources}
        ledgerEntries={mockLedgerEntries}
        currency="USD"
        isEditable={true}
        consumeResource={mockConsumeResource}
        reloadProject={mockReloadProject}
      />
    );

    const logTimeBtns = screen.getAllByTitle('Consume');
    fireEvent.click(logTimeBtns[0]);

    // Submit consumption
    const submitBtns = screen.getAllByRole('button', { name: 'Consume' });
    fireEvent.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(mockConsumeResource).toHaveBeenCalled();
      expect(mockReloadProject).toHaveBeenCalled();
      expect(api.projectsControllerGetLedgerEntries).toHaveBeenCalledWith('prj-1', {
        lineType: 'resource',
        limit: 50,
      });
    });

    await waitFor(() => {
      expect(screen.getAllByText('Newly logged resource usage').length).toBeGreaterThanOrEqual(1);
    });
  });
});
