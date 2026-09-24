import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ConsumeProjectResourceSlideOver } from '../ConsumeProjectResourceSlideOver';
import * as api from '@herobm/sdk';
import { RESOURCE_TYPE } from '@herobm/shared';
import type { ProjectResource } from '../../useProject';

jest.mock('next-intl', () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) => {
      if (values) {
        return `${key}:${JSON.stringify(values)}`;
      }
      return key;
    };
    t.has = () => true;
    return t;
  },
}));

const mockTasks: api.ProjectTaskResponseDto[] = [
  {
    projectTaskId: 'task-1',
    projectId: 'prj-1',
    taskCode: '1.0',
    name: 'Automation Architecture',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
  {
    projectTaskId: 'task-2',
    projectId: 'prj-1',
    taskCode: '2.0',
    name: 'PLC Commissioning',
    stateCode: 'in_progress',
    isMilestone: false,
    isBillable: true,
  },
];

const mockResources: ProjectResource[] = [
  {
    resourceId: 'res-1',
    resourceCode: 'RES-ENG-01',
    name: 'Senior Controls Engineer',
    resourceType: RESOURCE_TYPE.PERSON,
    baseUom: 'Hours',
    directUnitCost: '75',
    unitPrice: '150',
    isActive: true,
  },
  {
    resourceId: 'res-2',
    resourceCode: 'RES-CON-01',
    name: 'Apex Electrical Contractors',
    resourceType: RESOURCE_TYPE.CONTRACTOR,
    baseUom: 'Hours',
    directUnitCost: '95',
    unitPrice: '160',
    isActive: true,
  },
  {
    resourceId: 'res-3',
    resourceCode: 'RES-EQP-01',
    name: 'Fluke Power Quality Analyzer',
    resourceType: RESOURCE_TYPE.EQUIPMENT,
    baseUom: 'Days',
    directUnitCost: '200',
    unitPrice: '450',
    isActive: true,
  },
  {
    resourceId: 'res-4',
    resourceCode: 'RES-UNASSIGNED-01',
    name: 'External Field Specialist',
    resourceType: RESOURCE_TYPE.PERSON,
    baseUom: 'Hours',
    directUnitCost: '110',
    unitPrice: '220',
    isActive: true,
  },
];

const mockBudgetLines: api.ProjectBudgetLineResponseDto[] = [
  {
    budgetLineId: 'bud-1',
    projectId: 'prj-1',
    projectTaskId: 'task-1',
    lineType: 'resource',
    resourceId: 'res-1',
    plannedQuantity: '40',
    unitCost: '75',
    totalCost: '3000',
    unitPrice: '150',
    totalPrice: '6000',
  },
];

describe('ConsumeProjectResourceSlideOver', () => {
  const mockConsumeResource = jest.fn().mockResolvedValue(undefined);
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders SlideOver with tasks, resource tabs, and assigned resource list', async () => {
    render(
      <ConsumeProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResourceIds={['res-1', 'res-2', 'res-3']}
        currency="USD"
        consumeResource={mockConsumeResource}
        onSuccess={mockOnSuccess}
      />
    );

    expect(screen.getByRole('heading', { name: 'buttons.consumeResource' })).toBeInTheDocument();
    expect(screen.getByText('1.0 — Automation Architecture')).toBeInTheDocument();
    expect(screen.getByText('Senior Controls Engineer')).toBeInTheDocument();
    expect(screen.getByText('Apex Electrical Contractors')).toBeInTheDocument();
    expect(screen.getByText('Fluke Power Quality Analyzer')).toBeInTheDocument();
    // res-4 is unassigned, so it should not appear in the assigned card list
    expect(screen.queryByText('External Field Specialist')).not.toBeInTheDocument();
  });

  it('filters assigned resource list when switching resource type tabs', async () => {
    render(
      <ConsumeProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResourceIds={['res-1', 'res-2', 'res-3']}
        currency="USD"
        consumeResource={mockConsumeResource}
        onSuccess={mockOnSuccess}
      />
    );

    // Switch to Contractors tab
    const contractorTab = screen.getByRole('tab', { name: 'resources.typeContractor' });
    fireEvent.click(contractorTab);

    expect(screen.getByText('Apex Electrical Contractors')).toBeInTheDocument();
    expect(screen.queryByText('Senior Controls Engineer')).not.toBeInTheDocument();
    expect(screen.queryByText('Fluke Power Quality Analyzer')).not.toBeInTheDocument();
  });

  it('selects resource, displays UoM, Budget Use, Budget Cost, Budget Revenue without margin, and submits', async () => {
    render(
      <ConsumeProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResourceIds={['res-1', 'res-2', 'res-3']}
        budgetLines={mockBudgetLines}
        currency="USD"
        consumeResource={mockConsumeResource}
        onSuccess={mockOnSuccess}
      />
    );

    // Select the first resource
    const resourceCard = screen.getByText('Senior Controls Engineer');
    fireEvent.click(resourceCard);

    // Verify UoM is displayed
    expect(screen.getAllByText(/Hours/).length).toBeGreaterThan(0);

    // Verify Budget subtitles under inputs
    expect(screen.getAllByText('labels.budget:').length).toBe(3);
    expect(screen.getByText('40 Hours')).toBeInTheDocument();
    expect(screen.getByText('$75.00')).toBeInTheDocument();
    expect(screen.getByText('$150.00')).toBeInTheDocument();

    // Enter hours/quantity and description
    const qtyInput = screen.getByLabelText(/columns\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '16' } });

    const descInput = screen.getByLabelText(/columns\.description/i);
    fireEvent.change(descInput, { target: { value: 'SCADA panel wiring and validation' } });

    // Click submit button in footer
    const submitBtn = screen.getByRole('button', { name: 'buttons.consumeResource' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConsumeResource).toHaveBeenCalledWith(
        expect.objectContaining({
          projectTaskId: 'task-1',
          resourceId: 'res-1',
          quantity: 16,
          unitCost: 75,
          unitPrice: 150,
          description: 'SCADA panel wiring and validation',
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('supports rate overrides for unit cost and unit price', async () => {
    render(
      <ConsumeProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResourceIds={['res-1', 'res-2', 'res-3']}
        currency="USD"
        consumeResource={mockConsumeResource}
        onSuccess={mockOnSuccess}
      />
    );

    // Select contractor resource
    fireEvent.click(screen.getByText('Apex Electrical Contractors'));

    // Override rates
    const costInput = screen.getByLabelText(/columns\.unitCost/i);
    fireEvent.change(costInput, { target: { value: '110' } });

    const priceInput = screen.getByLabelText(/columns\.unitPrice/i);
    fireEvent.change(priceInput, { target: { value: '195' } });

    const qtyInput = screen.getByLabelText(/columns\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '10' } });

    const submitBtn = screen.getByRole('button', { name: 'buttons.consumeResource' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConsumeResource).toHaveBeenCalledWith(
        expect.objectContaining({
          projectTaskId: 'task-1',
          resourceId: 'res-2',
          quantity: 10,
          unitCost: 110,
          unitPrice: 195,
        })
      );
    });
  });

  it('allows selecting an unassigned resource from the search-select and submitting', async () => {
    render(
      <ConsumeProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        projectId="prj-1"
        projectNumber="PRJ-001"
        tasks={mockTasks}
        resources={mockResources}
        assignedResourceIds={['res-1', 'res-2', 'res-3']}
        currency="USD"
        consumeResource={mockConsumeResource}
        onSuccess={mockOnSuccess}
      />
    );

    // Search for unassigned resource in the AsyncSelect search input
    const searchInput = screen.getByPlaceholderText('resources.selectUnassignedPlaceholder');
    fireEvent.change(searchInput, { target: { value: 'External' } });

    // Wait for dropdown result to appear and select it via mouseDown
    await waitFor(() => {
      expect(screen.getByText('External Field Specialist')).toBeInTheDocument();
    });
    fireEvent.mouseDown(screen.getByText('External Field Specialist'));

    // Wait for selected resource details and quantity input to render
    await waitFor(() => {
      expect(screen.getByLabelText(/columns\.quantity/i)).toBeInTheDocument();
    });

    // Submit
    const qtyInput = screen.getByLabelText(/columns\.quantity/i);
    fireEvent.change(qtyInput, { target: { value: '8' } });

    const submitBtn = screen.getByRole('button', { name: 'buttons.consumeResource' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockConsumeResource).toHaveBeenCalledWith(
        expect.objectContaining({
          projectTaskId: 'task-1',
          resourceId: 'res-4',
          quantity: 8,
          unitCost: 110,
          unitPrice: 220,
        })
      );
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });
});
