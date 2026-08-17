/**
 * Canonical Application Route Definitions
 * Centralized, type-safe path builders for all portal routes.
 */

export const routes = {
  dashboard: () => '/',

  // Sales
  customers: {
    list: () => '/customers',
    detail: (id: string) => `/customers/${id}`,
    new: () => '/customers/new',
  },
  salesQuotes: {
    list: () => '/sales-quotes',
  },
  salesOrders: {
    list: () => '/sales-orders',
    detail: (id: string) => `/sales-orders/${id}`,
    new: (customerId?: string) =>
      customerId ? `/sales-orders/new?customerId=${customerId}` : '/sales-orders/new',
  },
  salesInvoices: {
    list: () => '/sales-invoices',
    detail: (id: string) => `/sales-invoices/${id}`,
  },
  salesReturns: {
    list: () => '/sales-returns',
    detail: (id: string) => `/sales-returns/${id}`,
  },
  salesCreditNotes: {
    list: () => '/sales-credit-notes',
    detail: (id: string) => `/sales-credit-notes/${id}`,
  },
  shipments: {
    list: () => '/shipments',
    detail: (id: string) => `/shipments/${id}`,
    returns: () => '/shipments/returns',
  },

  // Purchasing
  suppliers: {
    list: () => '/suppliers',
    detail: (id: string) => `/suppliers/${id}`,
    new: () => '/suppliers/new',
  },
  purchaseOrders: {
    list: () => '/purchase-orders',
    detail: (id: string) => `/purchase-orders/${id}`,
    new: () => '/purchase-orders/new',
    demands: () => '/purchase-orders/demands',
    returns: {
      list: () => '/purchase-orders/returns',
      detail: (id: string) => `/purchase-orders/returns/${id}`,
      new: (poId?: string) =>
        poId
          ? `/purchase-orders/returns/new?poId=${poId}`
          : '/purchase-orders/returns/new',
    },
  },
  supplierInvoices: {
    list: () => '/supplier-invoices',
    detail: (id: string) => `/supplier-invoices/${id}`,
    new: (purchaseOrderId?: string) =>
      purchaseOrderId
        ? `/supplier-invoices/new?purchaseOrderId=${purchaseOrderId}`
        : '/supplier-invoices/new',
  },
  purchaseDebitNotes: {
    list: () => '/purchase-debit-notes',
    detail: (id: string) => `/purchase-debit-notes/${id}`,
  },

  // Inventory & Warehouse
  products: {
    list: () => '/products',
    detail: (id: string, query?: { tab?: string }) =>
      query?.tab ? `/products/${id}?tab=${query.tab}` : `/products/${id}`,
    new: () => '/products/new',
  },
  inventory: {
    bins: () => '/inventory/bins',
    ledger: (entryId?: string) =>
      entryId ? `/inventory/ledger?entryId=${entryId}` : '/inventory/ledger',
    locations: () => '/inventory/locations',
    transfers: {
      list: () => '/inventory/transfers',
      detail: (id: string) => `/inventory/transfers/${id}`,
    },
    quarantine: () => '/inventory/quarantine',
    putaway: () => '/inventory/putaway',
    picking: () => '/inventory/picking',
    shipping: () => '/inventory/shipping',
  },
  receiving: {
    list: () => '/receiving',
    detail: (id: string) => `/receiving/${id}`,
    new: () => '/receiving/new',
    returns: () => '/receiving/returns',
    transfers: () => '/receiving/transfers',
  },

  // Manufacturing
  workOrders: {
    list: () => '/manufacturing/work-orders',
    detail: (id: string) => `/manufacturing/work-orders/${id}`,
    new: () => '/manufacturing/work-orders/new',
  },

  // CRM
  crm: {
    actors: {
      list: () => '/crm/actors',
      detail: (id: string) => `/crm/actors/${id}`,
      new: () => '/crm/actors/new',
    },
    contacts: {
      list: () => '/crm/contacts',
      detail: (id: string) => `/crm/contacts/${id}`,
      new: () => '/crm/contacts/new',
    },
    projects: {
      list: () => '/crm/projects',
      detail: (id: string) => `/crm/projects/${id}`,
      new: () => '/crm/projects/new',
    },
    map: () => '/crm/map',
  },

  // Finance
  generalLedger: {
    list: () => '/general-ledger',
    detail: (id: string) => `/general-ledger/${id}`,
    trialBalance: () => '/general-ledger/trial-balance',
    journalEntries: {
      list: () => '/general-ledger/journal-entries',
      new: () => '/general-ledger/journal-entries/new',
    },
  },
  balances: {
    customers: () => '/balances/customers',
    suppliers: () => '/balances/suppliers',
    tax: () => '/balances/tax',
  },
  payments: {
    list: (query?: { paymentId?: string }) =>
      query?.paymentId ? `/payments?paymentId=${query.paymentId}` : '/payments',
    detail: (id: string) => `/payments?paymentId=${id}`,
  },
  reconciliations: {
    list: () => '/reconciliations',
    detail: (id: string) => `/reconciliations/${id}`,
    new: () => '/reconciliations/new',
    profiles: () => '/reconciliations/profiles',
    rules: () => '/reconciliations/rules',
  },

  // Reporting
  reporting: {
    list: () => '/reporting',
    report: (slug: string, configId?: string) =>
      configId ? `/reporting/${slug}?configId=${configId}` : `/reporting/${slug}`,
    config: {
      list: () => '/reporting/config',
      detail: (id: string) => `/reporting/config/${id}`,
      new: () => '/reporting/config/new',
    },
  },

  // Admin
  admin: {
    customerGroups: () => '/admin/customer-groups',
    supplierGroups: () => '/admin/supplier-groups',
    productGroups: () => '/admin/product-groups',
    settings: {
      system: () => '/admin/settings/system',
      crm: () => '/admin/settings/crm',
      financial: () => '/admin/settings/financial',
      integrations: () => '/admin/settings/integrations',
      license: () => '/admin/settings/license',
      pdfHooks: () => '/admin/settings/pdf-hooks',
      pdfTemplates: {
        list: () => '/admin/settings/pdf-templates',
        detail: (id: string) => `/admin/settings/pdf-templates/${id}`,
        new: () => '/admin/settings/pdf-templates/new',
      },
    },
    users: {
      list: () => '/admin/users',
      roles: () => '/admin/users/roles',
    },
    developers: {
      list: () => '/admin/developers',
      apiReference: () => '/admin/developers/api-reference',
      webhooksApi: () => '/admin/developers/webhooks-api',
    },
    email: {
      outbox: () => '/admin/email/outbox',
      settings: () => '/admin/email/settings',
    },
    import: {
      csv: () => '/admin/import/csv',
      abm: () => '/admin/import/abm',
      odoo: () => '/admin/import/odoo',
    },
    eventQueue: () => '/admin/event-queue',
    systemLogs: () => '/admin/system-logs',
    version: () => '/admin/version',
  },
} as const;
