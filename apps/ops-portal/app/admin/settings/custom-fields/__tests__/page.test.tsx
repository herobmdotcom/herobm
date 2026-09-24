import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import CustomFieldsSettingsPage from '../page';
import * as api from '@herobm/sdk';

jest.mock('@/hooks/useDocumentTitle', () => ({
  useDocumentTitle: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('@/lib/api', () => ({
  reportError: jest.fn(),
}));

const translations: Record<string, string> = {
  'admin.settings.customFields.title': 'Custom Fields Settings',
  'admin.settings.customFields.subtitle': 'Configure user-defined metadata schemas',
  'admin.settings.customFields.loading': 'Loading custom field configurations...',
  'admin.settings.customFields.categories.sales': 'Sales',
  'admin.settings.customFields.categories.inventory': 'Warehouse',
  'admin.settings.customFields.categories.purchasing': 'Purchasing',
  'admin.settings.customFields.categories.manufacturing': 'Manufacturing',
  'admin.settings.customFields.categories.projects': 'Projects',
  'admin.settings.customFields.categories.crm': 'CRM',
  'admin.settings.customFields.categories.finance': 'Finance',
  'admin.settings.customFields.entities.customers.label': 'Customers',
  'admin.settings.customFields.entities.customers.description': 'Custom attributes for customers',
  'admin.settings.customFields.entities.salesOrders.label': 'Sales Orders',
  'admin.settings.customFields.entities.salesOrders.description': 'Custom attributes for sales orders',
  'admin.settings.customFields.entities.salesInvoices.label': 'Sales Invoices',
  'admin.settings.customFields.entities.salesInvoices.description': 'Custom attributes for sales invoices',
  'admin.settings.customFields.entities.salesCreditNotes.label': 'Credit Notes',
  'admin.settings.customFields.entities.salesCreditNotes.description': 'Custom attributes for credit notes',
  'admin.settings.customFields.entities.products.label': 'Products',
  'admin.settings.customFields.entities.products.description': 'Custom attributes for products',
  'admin.settings.customFields.entities.suppliers.label': 'Suppliers',
  'admin.settings.customFields.entities.suppliers.description': 'Custom attributes for suppliers',
  'admin.settings.customFields.entities.purchaseOrders.label': 'Purchase Orders',
  'admin.settings.customFields.entities.purchaseOrders.description': 'Custom attributes for purchase orders',
  'admin.settings.customFields.entities.purchaseDebitNotes.label': 'Debit Notes',
  'admin.settings.customFields.entities.purchaseDebitNotes.description': 'Custom attributes for debit notes',
  'admin.settings.customFields.entities.workOrders.label': 'Work Orders',
  'admin.settings.customFields.entities.workOrders.description': 'Custom attributes for work orders',
  'admin.settings.customFields.entities.projects.label': 'Projects',
  'admin.settings.customFields.entities.projects.description': 'Custom attributes for projects',
  'admin.settings.customFields.entities.organizations.label': 'Organizations',
  'admin.settings.customFields.entities.organizations.description': 'Custom attributes for organizations',
  'admin.settings.customFields.entities.opportunities.label': 'Opportunities',
  'admin.settings.customFields.entities.opportunities.description': 'Custom attributes for opportunities',
  'admin.settings.customFields.entities.contacts.label': 'Contacts',
  'admin.settings.customFields.entities.contacts.description': 'Custom attributes for contacts',
  'admin.settings.customFields.entities.glAccounts.label': 'GL Accounts',
  'admin.settings.customFields.entities.glAccounts.description': 'Custom attributes for gl accounts',
  'admin.settings.customFields.fieldDefined': '1 Field Defined',
  'admin.settings.customFields.fieldsDefined': '{count} Fields Defined',
  'admin.settings.customFields.oneField': '1 field',
  'admin.settings.customFields.fieldsCount': '{count} fields',
  'admin.settings.customFields.save': 'Save Schema',
  'admin.settings.customFields.saving': 'Saving Schema...',
  'admin.settings.customFields.discard': 'Discard Changes',
  'admin.settings.customFields.unsavedChanges': 'Unsaved schema modifications',
  'admin.settings.customFields.saveSuccess': '{entity} custom fields saved successfully',
  'admin.settings.customFields.saveFailed': 'Failed to save schema',
};

const tInstances = new Map<string, (key: string, params?: Record<string, unknown>) => string>();

jest.mock('next-intl', () => ({
  useTranslations: (ns: string) => {
    if (!tInstances.has(ns)) {
      tInstances.set(ns, (key: string, params?: Record<string, unknown>) => {
        const fullKey = ns ? `${ns}.${key}` : key;
        let text = translations[fullKey] || key;
        if (params) {
          Object.entries(params).forEach(([k, v]) => {
            text = text.replace(`{${k}}`, String(v));
          });
        }
        return text;
      });
    }
    return tInstances.get(ns);
  },
}));

jest.mock('@/components/SchemaBuilder', () => ({
  SchemaBuilder: ({
    value,
    onChange,
  }: {
    value: Record<string, unknown>;
    onChange: (val: Record<string, unknown>) => void;
  }) => (
    <div data-testid="schema-builder">
      <span data-testid="schema-props-count">
        {Object.keys((value?.properties as Record<string, unknown>) || {}).length}
      </span>
      <button
        type="button"
        data-testid="add-dummy-prop"
        onClick={() =>
          onChange({
            type: 'object',
            properties: {
              ...(value?.properties as Record<string, unknown>),
              testField: { type: 'string', title: 'Test Field' },
            },
          })
        }
      >
        Add Prop
      </button>
    </div>
  ),
}));

jest.mock('@herobm/sdk', () => ({
  organizationsControllerGetSettings: jest.fn(),
  organizationsControllerUpdateSettings: jest.fn(),
  ordersControllerGetSettings: jest.fn(),
  ordersControllerUpdateSettings: jest.fn(),
  purchaseOrdersControllerGetSettings: jest.fn(),
  purchaseOrdersControllerUpdateSettings: jest.fn(),
  workOrdersControllerGetSettings: jest.fn(),
  workOrdersControllerUpdateSettings: jest.fn(),
  productsControllerGetSettings: jest.fn(),
  productsControllerUpdateSettings: jest.fn(),
  projectsControllerGetSettings: jest.fn(),
  projectsControllerUpdateSettings: jest.fn(),
  glControllerGetSettings: jest.fn(),
  glControllerUpdateSettings: jest.fn(),
}));

describe('CustomFieldsSettingsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (api.organizationsControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        customerMetadataSchema: {
          type: 'object',
          properties: { loyaltyTier: { type: 'string' } },
        },
        supplierMetadataSchema: {
          type: 'object',
          properties: {},
        },
        organizationMetadataSchema: {
          type: 'object',
          properties: { industry: { type: 'string' } },
        },
        opportunityMetadataSchema: {
          type: 'object',
          properties: {},
        },
        contactMetadataSchema: {
          type: 'object',
          properties: {},
        },
      },
    });

    (api.ordersControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        salesOrderMetadataSchema: {
          type: 'object',
          properties: {},
        },
        salesInvoiceMetadataSchema: {
          type: 'object',
          properties: {},
        },
        creditNoteMetadataSchema: {
          type: 'object',
          properties: {},
        },
      },
    });

    (api.purchaseOrdersControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        purchaseOrderMetadataSchema: {
          type: 'object',
          properties: {},
        },
        debitNoteMetadataSchema: {
          type: 'object',
          properties: {},
        },
      },
    });

    (api.workOrdersControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        workOrderMetadataSchema: {
          type: 'object',
          properties: {},
        },
      },
    });

    (api.productsControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        productMetadataSchema: {
          type: 'object',
          properties: { barcodeExt: { type: 'string' } },
        },
      },
    });

    (api.projectsControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        projectMetadataSchema: {
          type: 'object',
          properties: {},
        },
      },
    });

    (api.glControllerGetSettings as jest.Mock).mockResolvedValue({
      data: {
        accountMetadataSchema: {
          type: 'object',
          properties: {},
        },
      },
    });
  });

  it('renders all sidebar categories and their corresponding entities in the left card', async () => {
    render(<CustomFieldsSettingsPage />);

    // Wait for schemas to load
    await waitFor(() => {
      expect(screen.queryByText('Loading custom field configurations...')).not.toBeInTheDocument();
    });

    // Check that all 7 sidebar category headings are present
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('Warehouse')).toBeInTheDocument();
    expect(screen.getByText('Purchasing')).toBeInTheDocument();
    expect(screen.getByText('Manufacturing')).toBeInTheDocument();
    expect(screen.getAllByText('Projects').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('CRM')).toBeInTheDocument();
    expect(screen.getByText('Finance')).toBeInTheDocument();

    // Check that entities are rendered in sidebar buttons
    expect(screen.getByRole('button', { name: /Customers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sales Orders/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sales Invoices/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Work Orders/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Products/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Suppliers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Purchase Orders/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Organizations/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Opportunities/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Contacts/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GL Accounts/i })).toBeInTheDocument();
  });

  it('selects an entity and loads its schema builder', async () => {
    render(<CustomFieldsSettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading custom field configurations...')).not.toBeInTheDocument();
    });

    // Initially Customers is selected in the right panel header
    expect(screen.getByRole('heading', { name: /Customers/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByTestId('schema-props-count')).toHaveTextContent('1');

    // Click on Products
    const productsBtn = screen.getByRole('button', { name: /Products/i });
    fireEvent.click(productsBtn);

    expect(screen.getByRole('heading', { name: /Products/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByTestId('schema-props-count')).toHaveTextContent('1');
  });

  it('supports modifying and saving schema', async () => {
    (api.organizationsControllerUpdateSettings as jest.Mock).mockResolvedValue({});

    render(<CustomFieldsSettingsPage />);

    await waitFor(() => {
      expect(screen.queryByText('Loading custom field configurations...')).not.toBeInTheDocument();
    });

    const addBtn = screen.getByTestId('add-dummy-prop');
    fireEvent.click(addBtn);

    // Should indicate unsaved changes
    expect(screen.getByText('Unsaved schema modifications')).toBeInTheDocument();

    const saveBtn = screen.getByRole('button', { name: /Save Schema/i });
    expect(saveBtn).not.toBeDisabled();

    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(api.organizationsControllerUpdateSettings).toHaveBeenCalledWith({
        customerMetadataSchema: {
          type: 'object',
          properties: {
            loyaltyTier: { type: 'string' },
            testField: { type: 'string', title: 'Test Field' },
          },
        },
      });
    });
  });
});
