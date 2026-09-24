import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AssignProjectResourceSlideOver } from '../AssignProjectResourceSlideOver';
import type { ProjectResource } from '../../useProject';

jest.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    const translations: Record<string, string> = {
      'resources.assignSlideOverTitle': 'Assign Resource to Project',
      'resources.selectResourcePrompt': 'Select a registered resource below:',
      'resources.filterAllTypes': 'All Types',
      'resources.typePerson': 'Person',
      'resources.typeContractor': 'External Contractor',
      'resources.typeEquipment': 'Equipment',
      'resources.createOnTheFly': '+ Create New Profile',
      'resources.availableToAssign': 'Available to Assign',
      'resources.alreadyAssignedSection': 'Already Assigned to Project',
      'resources.noAvailableResources': 'No available resources matching filters.',
      'resources.noMatchingResources': 'No matching resources found in pool.',
      'labels.alreadyAssigned': 'Already Assigned',
      'placeholders.searchResources': 'Search resources by code, name...',
      'buttons.assignToProject': 'Assign to Project',
      'buttons.saving': 'Saving...',
      'columns.notes': 'Notes',
      cancel: 'Cancel',
    };
    const t = (key: string) => translations[key] || (namespace ? `${namespace}.${key}` : key);
    t.has = (key: string) => Boolean(translations[key]);
    return t;
  },
}));

jest.mock('@herobm/sdk', () => ({
  projectsControllerFindAllResources: jest.fn().mockResolvedValue({ data: [] }),
}));

const mockResources: ProjectResource[] = [
  {
    resourceId: 'res-1',
    resourceNumber: 'RES-0001',
    name: 'Sarah Jenkins',
    resourceType: 'person',
    baseUom: 'HOUR',
    directUnitCost: '60.00',
    unitPrice: '120.00',
    isActive: true,
  },
  {
    resourceId: 'res-2',
    resourceNumber: 'RES-0002',
    name: 'Apex Rigging Contractor',
    resourceType: 'contractor',
    baseUom: 'HOUR',
    directUnitCost: '95.00',
    unitPrice: '190.00',
    isActive: true,
  },
];

describe('AssignProjectResourceSlideOver', () => {
  const mockOnClose = jest.fn();
  const mockOnAssign = jest.fn().mockResolvedValue(undefined);
  const mockOnSuccess = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <AssignProjectResourceSlideOver
        isOpen={false}
        onClose={mockOnClose}
        resources={mockResources}
        assignedResourceIds={['res-1']}
        onAssign={mockOnAssign}
        onSuccess={mockOnSuccess}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('separates assigned resources from unassigned resources into distinct sections', () => {
    render(
      <AssignProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        resources={mockResources}
        assignedResourceIds={['res-1']}
        onAssign={mockOnAssign}
        onSuccess={mockOnSuccess}
      />
    );

    // Verify Title
    expect(screen.getByText('Assign Resource to Project')).toBeInTheDocument();

    // Verify sections
    expect(screen.getByText(/Available to Assign \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Already Assigned to Project \(1\)/)).toBeInTheDocument();

    // Verify Sarah Jenkins is under Already Assigned, and Apex Rigging is under Available
    expect(screen.getByText('Sarah Jenkins')).toBeInTheDocument();
    expect(screen.getByText('Apex Rigging Contractor')).toBeInTheDocument();
    expect(screen.getByText('Already Assigned')).toBeInTheDocument();
  });

  it('allows selecting an unassigned resource and submitting the assignment', async () => {
    render(
      <AssignProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        resources={mockResources}
        assignedResourceIds={['res-1']}
        onAssign={mockOnAssign}
        onSuccess={mockOnSuccess}
      />
    );

    const assignBtn = screen.getByRole('button', { name: 'Assign to Project' });
    expect(assignBtn).toBeDisabled();

    // Click unassigned resource
    const unassignedCard = screen.getByText('Apex Rigging Contractor');
    fireEvent.click(unassignedCard);

    // Button should now be enabled
    expect(assignBtn).not.toBeDisabled();

    // Fill in notes
    const notesInput = screen.getByPlaceholderText('e.g. Lead electrical commissioning engineer');
    fireEvent.change(notesInput, { target: { value: 'Site rigging supervisor' } });

    // Submit
    fireEvent.click(assignBtn);

    await waitFor(() => {
      expect(mockOnAssign).toHaveBeenCalledWith({
        resourceId: 'res-2',
        notes: 'Site rigging supervisor',
      });
      expect(mockOnSuccess).toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('does not select an already assigned resource when clicked', () => {
    render(
      <AssignProjectResourceSlideOver
        isOpen={true}
        onClose={mockOnClose}
        resources={mockResources}
        assignedResourceIds={['res-1']}
        onAssign={mockOnAssign}
        onSuccess={mockOnSuccess}
      />
    );

    const assignedCard = screen.getByText('Sarah Jenkins');
    fireEvent.click(assignedCard);

    const assignBtn = screen.getByRole('button', { name: 'Assign to Project' });
    expect(assignBtn).toBeDisabled();
  });
});
