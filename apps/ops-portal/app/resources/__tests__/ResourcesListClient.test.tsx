import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ResourcesListClient from '../ResourcesListClient';
import * as api from '@herobm/sdk';

const mockGet = jest.fn().mockReturnValue(null);
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  useSearchParams: () => ({ get: mockGet }),
}));

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      'resources.title': 'Resources',
      'resources.filterAllTypes': 'All Types',
      'resources.typePerson': 'Person',
      'resources.typeContractor': 'External Contractor',
      'resources.typeEquipment': 'Equipment',
      'resources.filterAllStatuses': 'All Statuses',
      'resources.filterActive': 'Active',
      'resources.filterArchived': 'Archived',
      'resources.ratesHeading': 'Rate & Cost Configuration',
      'columns.resourceCode': 'Resource Code',
      'columns.resourceName': 'Resource Name',
      'columns.resourceType': 'Type',
      'columns.linkedEntity': 'Linked Entity',
      'columns.baseUom': 'Base UOM',
      'columns.unitCost': 'Unit Cost',
      'columns.unitPrice': 'Unit Price',
      'columns.status': 'Status',
      'placeholders.searchResources': 'Search resources...',
      'placeholders.resourceNamePlaceholder': 'e.g. Lead Controls Engineer',
      'placeholders.resourcePersonPlaceholder': 'e.g. Sarah Jenkins',
      'placeholders.resourceContractorPlaceholder': 'e.g. John Doe or Apex Rigging',
      'placeholders.resourceEquipmentPlaceholder': 'e.g. 25-Ton Mobile Crane Rig',
      'placeholders.selectResourceUser': 'Select user...',
      'placeholders.selectResourceVendor': 'Select vendor...',
      'placeholders.selectResourceProduct': 'Select product...',
      'labels.noUserAccount': 'None (No user account)',
      'labels.unlinkedContractor': 'None (Unlinked Contractor)',
      'labels.customEquipment': 'None (Custom Equipment)',
      'labels.customRates': 'None (Custom Rates)',
      'labels.userAccount': 'User Account',
      'labels.linkedSupplier': 'Linked Supplier',
      'labels.equipmentSku': 'Equipment SKU',
      'labels.serviceRole': 'Service Role / Rate Card',
      'buttons.createResource': 'Create Resource',
      'buttons.cancel': 'Cancel',
      'buttons.saving': 'Saving...',
      'resources.createTitle': 'Create Resource',
    };
    return translations[key] || key;
  },
}));

let capturedGridProps: Record<string, unknown> = {};

jest.mock('@/components/DataGrid', () => {
  return function DummyDataGrid(props: Record<string, unknown>) {
    capturedGridProps = props;
    return (
      <div data-testid="datagrid-mock">
        <div data-testid="datagrid-page-title">{props.pageTitle as string}</div>
        <div data-testid="datagrid-endpoint">{props.endpoint as string}</div>
        <div data-testid="datagrid-header-filters">{props.headerFilters as React.ReactNode}</div>
        <div data-testid="datagrid-header-actions">{props.headerActions as React.ReactNode}</div>
      </div>
    );
  };
});

jest.mock('@herobm/sdk', () => ({
  ...jest.requireActual('@herobm/sdk'),
  projectsControllerCreateResource: jest.fn(),
  usersControllerFindAll: jest.fn(),
  suppliersControllerFindAll: jest.fn(),
  suppliersControllerFindByProduct: jest.fn(),
  productsControllerFindAll: jest.fn(),
  uomDictionaryControllerFindAll: jest.fn(),
}));

describe('ResourcesListClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (api.usersControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.suppliersControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.productsControllerFindAll as jest.Mock).mockResolvedValue({ data: [] });
    (api.uomDictionaryControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        { uomCode: 'HOUR', description: 'Labor Hours', category: 'service' },
        { uomCode: 'DAY', description: 'Labor Days', category: 'service' },
        { uomCode: 'EA', description: 'Each', category: 'goods' },
      ],
    });
  });

  it('renders the DataGrid with plain text column valueFormatters (no badges)', async () => {
    render(<ResourcesListClient />);

    expect(screen.getByTestId('datagrid-mock')).toBeInTheDocument();
    expect(screen.getByTestId('datagrid-page-title')).toHaveTextContent('Resources');
    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent('/api/projects/resources?status=active');

    // Verify rowHref generator
    const rowHrefFn = capturedGridProps.rowHref as (row: { resourceId: string }) => string;
    expect(rowHrefFn).toBeDefined();
    expect(rowHrefFn({ resourceId: 'res-123' })).toBe('/resources/res-123');

    const columns = capturedGridProps.columns as Array<{
      field?: string;
      headerName?: string;
      valueFormatter?: (params: { value?: unknown }) => string;
      cellRenderer?: unknown;
    }>;

    // Verify resourceType column uses valueFormatter with plain text
    const typeCol = columns.find((c) => c.field === 'resourceType');
    expect(typeCol).toBeDefined();
    expect(typeCol?.valueFormatter).toBeDefined();
    expect(typeCol?.cellRenderer).toBeUndefined();
    expect(typeCol?.valueFormatter?.({ value: 'person' })).toBe('Person');
    expect(typeCol?.valueFormatter?.({ value: 'contractor' })).toBe('External Contractor');
    expect(typeCol?.valueFormatter?.({ value: 'equipment' })).toBe('Equipment');

    // Verify isActive column uses valueFormatter with plain text
    const statusCol = columns.find((c) => c.field === 'isActive');
    expect(statusCol).toBeDefined();
    expect(statusCol?.valueFormatter).toBeDefined();
    expect(statusCol?.cellRenderer).toBeUndefined();
    expect(statusCol?.valueFormatter?.({ value: true })).toBe('Active');
    expect(statusCol?.valueFormatter?.({ value: false })).toBe('Archived');
  });

  it('updates endpoint when resource type or status filters change', () => {
    render(<ResourcesListClient />);

    const typeSelect = screen.getByLabelText('Filter by resource type');
    fireEvent.change(typeSelect, { target: { value: 'contractor' } });

    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent(
      '/api/projects/resources?resourceType=contractor&status=active'
    );

    const statusSelect = screen.getByLabelText('Filter by status');
    fireEvent.change(statusSelect, { target: { value: 'all' } });

    expect(screen.getByTestId('datagrid-endpoint')).toHaveTextContent(
      '/api/projects/resources?resourceType=contractor'
    );
  });

  it('opens create modal with rates divider, submits new resource, and triggers create API', async () => {
    (api.projectsControllerCreateResource as jest.Mock).mockResolvedValue({
      data: { resourceId: 'res-3', name: 'New Controls Engineer' },
    });

    render(<ResourcesListClient />);

    const createBtn = screen.getByRole('button', { name: '+ Create Resource' });
    fireEvent.click(createBtn);

    expect(screen.getByRole('heading', { name: 'Create Resource' })).toBeInTheDocument();
    expect(screen.getByText('Rate & Cost Configuration')).toBeInTheDocument();

    const nameInput = screen.getByPlaceholderText('e.g. Sarah Jenkins');
    fireEvent.change(nameInput, { target: { value: 'New Controls Engineer' } });

    const submitBtn = screen.getByRole('button', { name: 'Create Resource' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.projectsControllerCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'New Controls Engineer',
          resourceType: 'person',
        })
      );
    });
  });

  it('handles linked entity lookups correctly', async () => {
    (api.usersControllerFindAll as jest.Mock).mockResolvedValue({
      data: [{ userId: 'user-1', displayName: 'Jane Doe', username: 'jdoe' }],
    });

    render(<ResourcesListClient />);

    await waitFor(() => {
      const columns = capturedGridProps.columns as Array<{
        headerName: string;
        valueGetter?: (params: { data: Record<string, unknown> }) => string;
      }>;
      expect(columns).toBeDefined();

      const linkedEntityCol = columns.find((col) => col.headerName === 'Linked Entity');
      expect(linkedEntityCol).toBeDefined();
      expect(linkedEntityCol?.valueGetter).toBeDefined();

      // Test Person lookup with user object
      const personResult = linkedEntityCol?.valueGetter?.({
        data: {
          resourceType: 'person',
          user: { displayName: 'Jane Doe' },
        },
      });
      expect(personResult).toBe('Jane Doe');

      // Test Contractor lookup with vendor object
      const contractorResult = linkedEntityCol?.valueGetter?.({
        data: {
          resourceType: 'contractor',
          vendor: { supplierName: 'Acme Contracting' },
        },
      });
      expect(contractorResult).toBe('Acme Contracting');

      // Test Equipment lookup with service product
      const equipmentResult = linkedEntityCol?.valueGetter?.({
        data: {
          resourceType: 'equipment',
          serviceProduct: { name: 'Laser Welder 3000', productNumber: 'EQ-001' },
        },
      });
      expect(equipmentResult).toBe('Laser Welder 3000 (EQ-001)');
    });
  });

  it('auto-fills Name field when a user account is selected in create modal', async () => {
    (api.usersControllerFindAll as jest.Mock).mockResolvedValue({
      data: [{ userId: 'user-42', displayName: 'Dr. Sarah Connor', username: 'sconnor', email: 'sarah@example.com' }],
    });

    render(<ResourcesListClient />);

    const createBtn = screen.getByRole('button', { name: '+ Create Resource' });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByText('Dr. Sarah Connor (sarah@example.com)')).toBeInTheDocument();
    });

    const userSelect = screen.getByDisplayValue('None (No user account)');
    fireEvent.change(userSelect, { target: { value: 'user-42' } });

    const nameInput = screen.getByPlaceholderText('e.g. Sarah Jenkins') as HTMLInputElement;
    expect(nameInput.value).toBe('Dr. Sarah Connor');
  });

  it('searches service rate cards using ProductSelect and auto-populates rates', async () => {
    (api.productsControllerFindAll as jest.Mock).mockImplementation((params) => {
      if (params?.productType === 'service') {
        return Promise.resolve({
          data: [
            {
              productId: 'srv-1',
              productNumber: 'SRV-ENG',
              name: 'Lead Engineer',
              baseUom: 'HOUR',
              standardCost: '80.00',
              listPrice: '160.00',
              productType: 'service',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(<ResourcesListClient />);

    const createBtn = screen.getByRole('button', { name: '+ Create Resource' });
    fireEvent.click(createBtn);

    const rateCardInput = screen.getByPlaceholderText('None (Custom Rates)');
    fireEvent.change(rateCardInput, { target: { value: 'Lead' } });

    await waitFor(() => {
      expect(api.productsControllerFindAll).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'Lead',
          productType: 'service',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByText('Lead Engineer')).toBeInTheDocument();
    });

    fireEvent.mouseDown(screen.getByText('Lead Engineer'));

    const nameInput = screen.getByPlaceholderText('e.g. Sarah Jenkins') as HTMLInputElement;
    expect(nameInput.value).toBe('Lead Engineer');
  });

  it('automatically opens create modal when create=true query param is present', async () => {
    mockGet.mockImplementation((param: string) => (param === 'create' ? 'true' : null));

    render(<ResourcesListClient />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Create Resource' })).toBeInTheDocument();
    });
  });

  it('loads contracted supplier cost when contractor resource has linked supplier and service product', async () => {
    (api.suppliersControllerFindAll as jest.Mock).mockResolvedValue({
      data: [
        {
          vendorId: 'vendor-rexroth',
          supplierNumber: 'V-REX',
          name: 'Bosch Rexroth Pty Ltd',
        },
      ],
    });

    (api.productsControllerFindAll as jest.Mock).mockImplementation((params) => {
      if (params?.productType === 'service') {
        return Promise.resolve({
          data: [
            {
              productId: 'srv-eng-snr',
              productNumber: 'SERV-ENG-SENIOR',
              name: 'Senior Service Engineer',
              baseUom: 'HOUR',
              standardCost: '500.00',
              listPrice: '800.00',
              productType: 'service',
            },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });

    (api.suppliersControllerFindByProduct as jest.Mock).mockResolvedValue({
      data: [
        {
          vendorId: 'vendor-rexroth',
          costPrice: '600.00',
          discountPercent: '0',
          supplierPartNumber: 'RR-SERV-SNR',
        },
      ],
    });

    (api.projectsControllerCreateResource as jest.Mock).mockResolvedValue({
      data: { resourceId: 'res-contractor-1', name: 'Senior Service Engineer' },
    });

    render(<ResourcesListClient />);

    const createBtn = screen.getByRole('button', { name: '+ Create Resource' });
    fireEvent.click(createBtn);

    // Switch to External Contractor inside the modal
    const typeSelect = screen.getByDisplayValue('Person');
    fireEvent.change(typeSelect, { target: { value: 'contractor' } });

    // Select Supplier
    const supplierInput = screen.getByPlaceholderText('None (Unlinked Contractor)');
    fireEvent.change(supplierInput, { target: { value: 'Bosch' } });

    await waitFor(() => {
      expect(screen.getByText('Bosch Rexroth Pty Ltd')).toBeInTheDocument();
    });
    fireEvent.mouseDown(screen.getByText('Bosch Rexroth Pty Ltd'));

    // Select Service Role
    const serviceInput = screen.getByPlaceholderText('None (Custom Rates)');
    fireEvent.change(serviceInput, { target: { value: 'Senior' } });

    await waitFor(() => {
      expect(screen.getByText('Senior Service Engineer')).toBeInTheDocument();
    });
    fireEvent.mouseDown(screen.getByText('Senior Service Engineer'));

    // Verify directUnitCost was populated with 600.00
    await waitFor(() => {
      const directUnitCostInput = screen.getByDisplayValue('600.00');
      expect(directUnitCostInput).toBeInTheDocument();
    });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: 'Create Resource' });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(api.projectsControllerCreateResource).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Bosch Rexroth Pty Ltd',
          resourceType: 'contractor',
          vendorId: 'vendor-rexroth',
          serviceProductId: 'srv-eng-snr',
          directUnitCost: 600,
          unitPrice: 800,
        })
      );
    });
  });
});
