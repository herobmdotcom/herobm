import { useMemo } from 'react';
import useSWR from 'swr';
import * as api from '@herobm/sdk';
import type { ColDef, ValueGetterParams, ValueFormatterParams } from 'ag-grid-community';
import { formatLocalDate } from '@/lib/date';
import { numericFormatter } from '@/components/shared/datagrid/DataGridFormatters';

export type CustomFieldEntityType =
  | 'products'
  | 'customers'
  | 'suppliers'
  | 'organizations'
  | 'opportunities'
  | 'contacts'
  | 'salesOrders'
  | 'salesInvoices'
  | 'salesCreditNotes'
  | 'purchaseOrders'
  | 'purchaseDebitNotes'
  | 'workOrders'
  | 'projects'
  | 'glAccounts';

export interface CustomFieldColumnOptions {
  /** Default visibility for generated custom field columns (default: true, meaning hidden) */
  defaultHide?: boolean;
  /** Prefix for colId to avoid clashes with native table column IDs (default: 'custom_') */
  prefixColId?: string;
  /** Root object property on the row where custom field values are stored (default: 'metadata') */
  rootField?: 'metadata' | 'customFields';
  /** Custom label for boolean true (default: 'Yes') */
  booleanTrueLabel?: string;
  /** Custom label for boolean false (default: 'No') */
  booleanFalseLabel?: string;
}

export interface CustomFieldPropertySchema {
  type?: string;
  title?: string;
  description?: string;
  format?: string;
  enum?: string[];
  [key: string]: unknown;
}

export interface CustomFieldJsonSchema {
  type?: string;
  properties?: Record<string, CustomFieldPropertySchema>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * Builds AG Grid ColDef array from a JSON Schema defining custom fields/metadata.
 */
export function buildCustomFieldColumns(
  schema?: CustomFieldJsonSchema | Record<string, unknown> | null,
  options: CustomFieldColumnOptions = {},
): ColDef[] {
  if (!schema || typeof schema !== 'object') return [];

  const properties = (schema as CustomFieldJsonSchema).properties;
  if (!properties || typeof properties !== 'object') return [];

  const {
    defaultHide = true,
    prefixColId = 'custom_',
    rootField = 'metadata',
    booleanTrueLabel = 'Yes',
    booleanFalseLabel = 'No',
  } = options;

  return Object.entries(properties).map(([key, propDef]: [string, CustomFieldPropertySchema]) => {
    const isNumber = propDef.type === 'number' || propDef.type === 'integer';
    const isBoolean = propDef.type === 'boolean';
    const isDate = propDef.format === 'date';

    const colDef: ColDef = {
      colId: `${prefixColId}${key}`,
      field: `${rootField}.${key}`,
      headerName: propDef.title || key,
      width: 140,
      hide: defaultHide,
      valueGetter: (params: ValueGetterParams) => {
        if (!params.data) return null;
        const root = (params.data as Record<string, unknown>)[rootField] as
          | Record<string, unknown>
          | undefined;
        const fallbackRoot =
          rootField === 'metadata'
            ? ((params.data as Record<string, unknown>).customFields as Record<string, unknown> | undefined)
            : ((params.data as Record<string, unknown>).metadata as Record<string, unknown> | undefined);

        const val = root?.[key] ?? fallbackRoot?.[key];
        return val ?? null;
      },
    };

    if (isNumber) {
      colDef.type = 'numericColumn';
      colDef.valueFormatter = (params: ValueFormatterParams) => {
        if (params.value == null || params.value === '') return '—';
        return numericFormatter(params);
      };
    } else if (isBoolean) {
      colDef.valueFormatter = (params: ValueFormatterParams) => {
        if (params.value === true) return booleanTrueLabel;
        if (params.value === false) return booleanFalseLabel;
        return '—';
      };
    } else if (isDate) {
      colDef.valueFormatter = (params: ValueFormatterParams) => {
        if (!params.value) return '—';
        return formatLocalDate(params.value as string);
      };
    } else {
      colDef.valueFormatter = (params: ValueFormatterParams) => {
        if (params.value == null || params.value === '') return '—';
        return String(params.value);
      };
    }

    return colDef;
  });
}

/**
 * React hook that memoizes custom field column definitions from a JSON Schema.
 */
export function useCustomFieldColumns(
  schema?: CustomFieldJsonSchema | Record<string, unknown> | null,
  options?: CustomFieldColumnOptions,
): ColDef[] {
  return useMemo(
    () => buildCustomFieldColumns(schema, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema, JSON.stringify(options)],
  );
}

interface EntitySettingsConfig {
  swrKey: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic settings DTO types across domains
  fetcher: () => Promise<{ data?: any }>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic settings DTO types across domains
  extractSchema: (data?: any) => CustomFieldJsonSchema | undefined;
}

const ENTITY_SETTINGS_CONFIG: Record<CustomFieldEntityType, EntitySettingsConfig> = {
  products: {
    swrKey: '/products/settings',
    fetcher: () => api.productsControllerGetSettings(),
    extractSchema: (d) => d?.productMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  customers: {
    swrKey: '/organizations/settings',
    fetcher: () => api.organizationsControllerGetSettings(),
    extractSchema: (d) => d?.customerMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  suppliers: {
    swrKey: '/organizations/settings',
    fetcher: () => api.organizationsControllerGetSettings(),
    extractSchema: (d) => d?.supplierMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  organizations: {
    swrKey: '/organizations/settings',
    fetcher: () => api.organizationsControllerGetSettings(),
    extractSchema: (d) => d?.organizationMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  opportunities: {
    swrKey: '/organizations/settings',
    fetcher: () => api.organizationsControllerGetSettings(),
    extractSchema: (d) => d?.opportunityMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  contacts: {
    swrKey: '/organizations/settings',
    fetcher: () => api.organizationsControllerGetSettings(),
    extractSchema: (d) => d?.contactMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  salesOrders: {
    swrKey: '/orders/settings',
    fetcher: () => api.ordersControllerGetSettings(),
    extractSchema: (d) => d?.salesOrderMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  salesInvoices: {
    swrKey: '/orders/settings',
    fetcher: () => api.ordersControllerGetSettings(),
    extractSchema: (d) => d?.salesInvoiceMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  salesCreditNotes: {
    swrKey: '/orders/settings',
    fetcher: () => api.ordersControllerGetSettings(),
    extractSchema: (d) => d?.creditNoteMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  purchaseOrders: {
    swrKey: '/purchase-orders/settings',
    fetcher: () => api.purchaseOrdersControllerGetSettings(),
    extractSchema: (d) => d?.purchaseOrderMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  purchaseDebitNotes: {
    swrKey: '/purchase-orders/settings',
    fetcher: () => api.purchaseOrdersControllerGetSettings(),
    extractSchema: (d) => d?.debitNoteMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  workOrders: {
    swrKey: '/work-orders/settings',
    fetcher: () => api.workOrdersControllerGetSettings(),
    extractSchema: (d) => d?.workOrderMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  projects: {
    swrKey: '/projects/settings',
    fetcher: () => api.projectsControllerGetSettings(),
    extractSchema: (d) => d?.projectMetadataSchema as CustomFieldJsonSchema | undefined,
  },
  glAccounts: {
    swrKey: '/gl/settings',
    fetcher: () => api.glControllerGetSettings(),
    extractSchema: (d) => d?.accountMetadataSchema as CustomFieldJsonSchema | undefined,
  },
};

/**
 * Hook to automatically fetch metadata schema and generate AG Grid ColDef columns for an entity type.
 */
export function useEntityCustomFields(
  entityType?: CustomFieldEntityType,
  options?: CustomFieldColumnOptions,
): {
  columns: ColDef[];
  isLoading: boolean;
  schema: CustomFieldJsonSchema | null;
} {
  const config = entityType ? ENTITY_SETTINGS_CONFIG[entityType] : null;

  const { data: res, isLoading } = useSWR(
    config ? config.swrKey : null,
    config ? config.fetcher : null,
    { revalidateOnFocus: false, dedupingInterval: 60000 },
  );

  const schema = useMemo(() => {
    if (!config || !res?.data) return null;
    return config.extractSchema(res.data) ?? null;
  }, [config, res]);

  const columns = useCustomFieldColumns(schema, options);

  return {
    columns,
    isLoading: Boolean(config && isLoading),
    schema,
  };
}
