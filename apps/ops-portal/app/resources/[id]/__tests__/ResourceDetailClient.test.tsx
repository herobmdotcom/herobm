import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import ResourceDetailClient from '../ResourceDetailClient';
import * as api from '@herobm/sdk';
import { RESOURCE_TYPE } from '@herobm/shared';

const mockPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    const fn = (key: string, params?: Record<string, string>) => {
      if (params && params.name) {
        return `${ns}.${key} ${params.name}`;
      }
      return `${ns}.${key}`;
    };
    fn.has = () => true;
    return fn;
  },
}));

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('@/components/SettingsProvider', () => ({
  useSettings: () => ({ baseCurrency: 'USD' }),
}));

jest.mock('@/components/shared/AuthGate', () => ({
  useAuth: () => ({
    permissions: [
      { resource: 'projects', action: 'read', effect: 'allow' },
      { resource: 'projects', action: 'write', effect: 'allow' },
      { resource: 'projects', action: 'archive', effect: 'allow' },
    ],
  }),
}));

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  projectsControllerFindResourceById: jest.fn(),
  projectsControllerUpdateResource: jest.fn(),
  projectsControllerArchiveResource: jest.fn(),
  projectsControllerUnarchiveResource: jest.fn(),
  projectsControllerDeleteResource: jest.fn(),
  usersControllerFindAll: jest.fn(),
  suppliersControllerFindAll: jest.fn(),
  productsControllerFindAll: jest.fn(),
  projectsControllerFindAllResources: jest.fn(),
  productsControllerGetServiceMembers: jest.fn(),
  productsControllerAddServiceMember: jest.fn(),
  productsControllerRemoveServiceMember: jest.fn(),
  uomDictionaryControllerFindAll: jest.fn(),
}));

describe('ResourceDetailClient', () => {
  const mockResource: api.ProjectResourceResponseDto = {
    resourceId: 'res-1',
    resourceNumber: 'RES-0001',
    name: 'Lead Controls Engineer',
    resourceType: RESOURCE_TYPE.PERSON,
    userId: 'user-1',
    baseUom: 'HOUR',
    directUnitCost: '80.00',
    unitPrice: '160.00',
    isActive: true,
    createdOn: '2026-01-01T00:00:00Z',
    user: {
      userId: 'user-1',
      displayName: 'John Doe',
      username: 'jdoe',
      email: 'jdoe@company.com',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.projectsControllerFindResourceById as jest.Mock).mockResolvedValue({
      data: mockResource,
    });
    (api.usersControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.suppliersControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.projectsControllerFindAllResources as jest.Mock).mockResolvedValue({ data: [] });
    (api.productsControllerGetServiceMembers as jest.Mock).mockResolvedValue({ data: [] });
    (api.uomDictionaryControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        { uomCode: 'HOUR', description: 'Labor Hours', category: 'service' },
        { uomCode: 'DAY', description: 'Labor Days', category: 'service' },
        { uomCode: 'EA', description: 'Each', category: 'goods' },
      ],
    });
  });

  it('renders resource details, rates, and linked user in standard layout', async () => {
    render(<ResourceDetailClient resourceId="res-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('RES-0001').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByDisplayValue('Lead Controls Engineer')).toBeInTheDocument();
      expect(screen.getByDisplayValue('80.00')).toBeInTheDocument();
      expect(screen.getByDisplayValue('160.00')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText(/jdoe@company\.com/)).toBeInTheDocument();
    });
  });

  it('inline updates resource name on blur with auto-save', async () => {
    (api.projectsControllerUpdateResource as jest.Mock).mockResolvedValue({
      data: {
        ...mockResource,
        name: 'Principal Controls Engineer',
      },
    });

    render(<ResourceDetailClient resourceId="res-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('Lead Controls Engineer')).toBeInTheDocument();
    });

    const nameInput = screen.getByDisplayValue('Lead Controls Engineer');
    fireEvent.change(nameInput, { target: { value: 'Principal Controls Engineer' } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(api.projectsControllerUpdateResource).toHaveBeenCalledWith(
        'res-1',
        expect.objectContaining({
          name: 'Principal Controls Engineer',
        })
      );
    });
  });

  it('inline updates resource code on blur with auto-save', async () => {
    (api.projectsControllerUpdateResource as jest.Mock).mockResolvedValue({
      data: {
        ...mockResource,
        resourceNumber: 'RES-0099',
      },
    });

    render(<ResourceDetailClient resourceId="res-1" />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('RES-0001')).toBeInTheDocument();
    });

    const codeInput = screen.getByDisplayValue('RES-0001');
    fireEvent.change(codeInput, { target: { value: 'RES-0099' } });
    fireEvent.blur(codeInput);

    await waitFor(() => {
      expect(api.projectsControllerUpdateResource).toHaveBeenCalledWith(
        'res-1',
        expect.objectContaining({
          resourceNumber: 'RES-0099',
        })
      );
    });
  });

  it('archives resource when active, then unarchives when restored', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

    (api.projectsControllerArchiveResource as jest.Mock).mockResolvedValue({
      data: { ...mockResource, isActive: false },
    });

    render(<ResourceDetailClient resourceId="res-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('RES-0001').length).toBeGreaterThanOrEqual(1);
    });

    const archiveBtn = screen.getByRole('button', { name: 'projects.buttons.archiveResource' });
    fireEvent.click(archiveBtn);

    expect(confirmSpy).toHaveBeenCalledWith('projects.resources.confirmArchive Lead Controls Engineer');
    expect(api.projectsControllerArchiveResource).toHaveBeenCalledWith('res-1', {});

    confirmSpy.mockRestore();
  });

  it('deletes resource and navigates back to /resources', async () => {
    const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);
    (api.projectsControllerDeleteResource as jest.Mock).mockResolvedValue({
      data: { deleted: true, resourceId: 'res-1' },
    });

    render(<ResourceDetailClient resourceId="res-1" />);

    await waitFor(() => {
      expect(screen.getAllByText('RES-0001').length).toBeGreaterThanOrEqual(1);
    });

    const deleteBtn = screen.getByTitle('projects.buttons.deleteResource');
    fireEvent.click(deleteBtn);

    expect(confirmSpy).toHaveBeenCalledWith('projects.resources.confirmDelete Lead Controls Engineer');

    await waitFor(() => {
      expect(api.projectsControllerDeleteResource).toHaveBeenCalledWith('res-1');
      expect(mockPush).toHaveBeenCalledWith('/resources');
    });

    confirmSpy.mockRestore();
  });
});
