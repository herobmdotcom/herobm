'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useState, useEffect, useCallback, useMemo } from 'react';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { ContentPageHeader } from '@/components/shared/ContentPageHeader';
import { SchemaBuilder } from '@/components/SchemaBuilder';
import { Button } from '@/components/shared/Button';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';

export type EntityCategory =
  | 'sales'
  | 'purchasing'
  | 'manufacturing'
  | 'inventory'
  | 'projects'
  | 'crm'
  | 'finance';

export interface ConfigurableEntity {
  id: string;
  labelKey: string;
  descriptionKey: string;
  category: EntityCategory;
  icon: string;
  fetchSchema: () => Promise<Record<string, unknown>>;
  saveSchema: (schema: Record<string, unknown>) => Promise<void>;
}

const CATEGORIES: EntityCategory[] = [
  'sales',
  'purchasing',
  'manufacturing',
  'inventory',
  'projects',
  'crm',
  'finance',
];

export default function CustomFieldsSettingsPage() {
  const t = useTranslations('admin.settings.customFields');
  useDocumentTitle(t('title'));

  const entities: ConfigurableEntity[] = useMemo(
    () => [
      {
        id: 'customers',
        labelKey: 'entities.customers.label',
        descriptionKey: 'entities.customers.description',
        category: 'sales',
        icon: 'storefront',
        fetchSchema: async () => {
          const res = await api.organizationsControllerGetSettings();
          return (
            (res.data?.customerMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.organizationsControllerUpdateSettings({
            customerMetadataSchema: schema,
          });
        },
      },
      {
        id: 'salesOrders',
        labelKey: 'entities.salesOrders.label',
        descriptionKey: 'entities.salesOrders.description',
        category: 'sales',
        icon: 'shopping_cart',
        fetchSchema: async () => {
          const res = await api.ordersControllerGetSettings();
          return (
            (res.data?.salesOrderMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.ordersControllerUpdateSettings({
            salesOrderMetadataSchema: schema,
          });
        },
      },
      {
        id: 'salesInvoices',
        labelKey: 'entities.salesInvoices.label',
        descriptionKey: 'entities.salesInvoices.description',
        category: 'sales',
        icon: 'receipt_long',
        fetchSchema: async () => {
          const res = await api.ordersControllerGetSettings();
          return (
            (res.data?.salesInvoiceMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.ordersControllerUpdateSettings({
            salesInvoiceMetadataSchema: schema,
          });
        },
      },
      {
        id: 'salesCreditNotes',
        labelKey: 'entities.salesCreditNotes.label',
        descriptionKey: 'entities.salesCreditNotes.description',
        category: 'sales',
        icon: 'assignment_return',
        fetchSchema: async () => {
          const res = await api.ordersControllerGetSettings();
          return (
            (res.data?.creditNoteMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.ordersControllerUpdateSettings({
            creditNoteMetadataSchema: schema,
          });
        },
      },
      {
        id: 'suppliers',
        labelKey: 'entities.suppliers.label',
        descriptionKey: 'entities.suppliers.description',
        category: 'purchasing',
        icon: 'factory',
        fetchSchema: async () => {
          const res = await api.organizationsControllerGetSettings();
          return (
            (res.data?.supplierMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.organizationsControllerUpdateSettings({
            supplierMetadataSchema: schema,
          });
        },
      },
      {
        id: 'purchaseOrders',
        labelKey: 'entities.purchaseOrders.label',
        descriptionKey: 'entities.purchaseOrders.description',
        category: 'purchasing',
        icon: 'receipt',
        fetchSchema: async () => {
          const res = await api.purchaseOrdersControllerGetSettings();
          return (
            (res.data?.purchaseOrderMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.purchaseOrdersControllerUpdateSettings({
            purchaseOrderMetadataSchema: schema,
          });
        },
      },
      {
        id: 'purchaseDebitNotes',
        labelKey: 'entities.purchaseDebitNotes.label',
        descriptionKey: 'entities.purchaseDebitNotes.description',
        category: 'purchasing',
        icon: 'assignment_returned',
        fetchSchema: async () => {
          const res = await api.purchaseOrdersControllerGetSettings();
          return (
            (res.data?.debitNoteMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.purchaseOrdersControllerUpdateSettings({
            debitNoteMetadataSchema: schema,
          });
        },
      },
      {
        id: 'workOrders',
        labelKey: 'entities.workOrders.label',
        descriptionKey: 'entities.workOrders.description',
        category: 'manufacturing',
        icon: 'precision_manufacturing',
        fetchSchema: async () => {
          const res = await api.workOrdersControllerGetSettings();
          return (
            (res.data?.workOrderMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.workOrdersControllerUpdateSettings({
            workOrderMetadataSchema: schema,
          });
        },
      },
      {
        id: 'products',
        labelKey: 'entities.products.label',
        descriptionKey: 'entities.products.description',
        category: 'inventory',
        icon: 'category',
        fetchSchema: async () => {
          const res = await api.productsControllerGetSettings();
          return (
            (res.data?.productMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.productsControllerUpdateSettings({
            productMetadataSchema: schema,
          });
        },
      },
      {
        id: 'projects',
        labelKey: 'entities.projects.label',
        descriptionKey: 'entities.projects.description',
        category: 'projects',
        icon: 'assignment',
        fetchSchema: async () => {
          const res = await api.projectsControllerGetSettings();
          return (
            (res.data?.projectMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.projectsControllerUpdateSettings({
            projectMetadataSchema: schema,
          });
        },
      },
      {
        id: 'organizations',
        labelKey: 'entities.organizations.label',
        descriptionKey: 'entities.organizations.description',
        category: 'crm',
        icon: 'business',
        fetchSchema: async () => {
          const res = await api.organizationsControllerGetSettings();
          return (
            (res.data?.organizationMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.organizationsControllerUpdateSettings({
            organizationMetadataSchema: schema,
          });
        },
      },
      {
        id: 'opportunities',
        labelKey: 'entities.opportunities.label',
        descriptionKey: 'entities.opportunities.description',
        category: 'crm',
        icon: 'trending_up',
        fetchSchema: async () => {
          const res = await api.organizationsControllerGetSettings();
          return (
            (res.data?.opportunityMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.organizationsControllerUpdateSettings({
            opportunityMetadataSchema: schema,
          });
        },
      },
      {
        id: 'contacts',
        labelKey: 'entities.contacts.label',
        descriptionKey: 'entities.contacts.description',
        category: 'crm',
        icon: 'contacts',
        fetchSchema: async () => {
          const res = await api.organizationsControllerGetSettings();
          return (
            (res.data?.contactMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.organizationsControllerUpdateSettings({
            contactMetadataSchema: schema,
          });
        },
      },
      {
        id: 'glAccounts',
        labelKey: 'entities.glAccounts.label',
        descriptionKey: 'entities.glAccounts.description',
        category: 'finance',
        icon: 'account_balance',
        fetchSchema: async () => {
          const res = await api.glControllerGetSettings();
          return (
            (res.data?.accountMetadataSchema as Record<string, unknown>) || {
              type: 'object',
              properties: {},
            }
          );
        },
        saveSchema: async (schema) => {
          await api.glControllerUpdateSettings({
            accountMetadataSchema: schema,
          });
        },
      },
    ],
    [],
  );

  const [selectedEntityId, setSelectedEntityId] = useState<string>(entities[0].id);
  const [schemas, setSchemas] = useState<Record<string, Record<string, unknown>>>({});
  const [initialSchemas, setInitialSchemas] = useState<Record<string, Record<string, unknown>>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const activeEntity = useMemo(
    () => entities.find((e) => e.id === selectedEntityId) || entities[0],
    [entities, selectedEntityId],
  );

  const loadAllSchemas = useCallback(async () => {
    try {
      setLoading(true);
      const loaded: Record<string, Record<string, unknown>> = {};
      await Promise.all(
        entities.map(async (entity) => {
          const schema = await entity.fetchSchema();
          loaded[entity.id] = schema || { type: 'object', properties: {} };
        }),
      );
      setSchemas(loaded);
      setInitialSchemas(JSON.parse(JSON.stringify(loaded)));
    } catch (err: unknown) {
      reportError(err, 'CustomFieldsSettingsPage:loadAllSchemas');
      toast.error(t('loadFailed', { error: getErrorMessage(err) }));
    } finally {
      setLoading(false);
    }
  }, [entities, t]);

  useEffect(() => {
    loadAllSchemas();
  }, [loadAllSchemas]);

  const currentSchema = useMemo(
    () => schemas[selectedEntityId] || { type: 'object', properties: {} },
    [schemas, selectedEntityId],
  );

  const currentFieldCount = useMemo(() => {
    const props = (currentSchema as { properties?: Record<string, unknown> })?.properties;
    return props && typeof props === 'object' ? Object.keys(props).length : 0;
  }, [currentSchema]);

  const isDirty = useMemo(() => {
    const initial = initialSchemas[selectedEntityId];
    const current = schemas[selectedEntityId];
    return JSON.stringify(initial) !== JSON.stringify(current);
  }, [initialSchemas, schemas, selectedEntityId]);

  const handleSchemaChange = (newSchema: Record<string, unknown>) => {
    setSchemas((prev) => ({
      ...prev,
      [selectedEntityId]: newSchema,
    }));
  };

  const handleDiscard = () => {
    setSchemas((prev) => ({
      ...prev,
      [selectedEntityId]: JSON.parse(
        JSON.stringify(initialSchemas[selectedEntityId] || { type: 'object', properties: {} }),
      ),
    }));
  };

  const handleSave = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic i18n key lookup
    const entityLabel = t(activeEntity.labelKey as any);
    try {
      setSaving(true);
      await activeEntity.saveSchema(currentSchema);
      setInitialSchemas((prev) => ({
        ...prev,
        [selectedEntityId]: JSON.parse(JSON.stringify(currentSchema)),
      }));
      toast.success(t('saveSuccess', { entity: entityLabel }));
    } catch (err: unknown) {
      reportError(err, `CustomFieldsSettingsPage:saveSchema:${activeEntity.id}`);
      toast.error(t('saveFailed', { entity: entityLabel, error: getErrorMessage(err) }));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 w-full h-full bg-[var(--bg-primary)] px-4 lg:px-8 py-6 overflow-y-auto">
      <ContentPageHeader
        title={t('title')}
        subtitle={t('subtitle')}
      />

      {loading ? (
        <div className="flex items-center justify-center p-16 text-muted">
          <div className="flex flex-col items-center gap-3">
            {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
            <span className="material-symbols-outlined animate-spin text-3xl">sync</span>
            <span>{t('loading')}</span>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
          {/* ── Left Sidebar: Entity Category Navigation ────────────────────── */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="card p-3 flex flex-col gap-5">
              {CATEGORIES.map((cat) => {
                const catEntities = entities.filter((e) => e.category === cat);
                if (catEntities.length === 0) return null;

                return (
                  <div key={cat} className="flex flex-col gap-1">
                    <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)]">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic i18n key lookup */}
                      {t(`categories.${cat}` as any)}
                    </div>
                    <div className="flex flex-col gap-1">
                      {catEntities.map((ent) => {
                        const isSelected = ent.id === selectedEntityId;
                        const props = (schemas[ent.id] as { properties?: Record<string, unknown> })?.properties;
                        const count = props && typeof props === 'object' ? Object.keys(props).length : 0;

                        return (
                          <Button
                            key={ent.id}
                            type="button"
                            variant="ghost"
                            onClick={() => setSelectedEntityId(ent.id)}
                            className={`w-full justify-between px-3 py-2.5 rounded-lg text-sm transition-all text-left font-normal border-0 shadow-none ${
                              isSelected
                                ? 'bg-[var(--accent)] text-white font-medium hover:bg-[var(--accent)] hover:text-white'
                                : 'text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span
                                className={`material-symbols-outlined text-[20px] ${
                                  isSelected ? 'text-white' : 'text-[var(--text-muted)]'
                                }`}
                              >
                                {ent.icon}
                              </span>
                              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic i18n key lookup */}
                              <span>{t(ent.labelKey as any)}</span>
                            </div>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                isSelected
                                  ? 'bg-white/20 text-white font-semibold'
                                  : 'bg-[var(--bg-secondary)] text-[var(--text-muted)] border border-[var(--border)]'
                              }`}
                            >
                              {count === 1 ? t('oneField') : t('fieldsCount', { count })}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Right Panel: Active Schema Builder & Actions ────────────────── */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="card flex flex-col gap-6">
              {/* Header */}
              <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 border-b border-[var(--border)] gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--accent)]">
                    <span className="material-symbols-outlined text-2xl">
                      {activeEntity.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic i18n key lookup */}
                      <span>{t(activeEntity.labelKey as any)}</span>
                    </h3>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] font-medium px-2.5 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)]">
                    {currentFieldCount === 1
                      ? t('fieldDefined', { count: currentFieldCount })
                      : t('fieldsDefined', { count: currentFieldCount })}
                  </span>
                </div>
              </div>

              {/* Schema Builder Canvas */}
              <div className="flex flex-col">
                <SchemaBuilder
                  value={currentSchema}
                  onChange={handleSchemaChange}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border)] mt-2">
                <div>
                  {isDirty && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">info</span>
                      <span>{t('unsavedChanges')}</span>
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleDiscard}
                    disabled={!isDirty || saving}
                  >
                    {t('discard')}
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!isDirty || saving}
                  >
                    {saving ? t('saving') : t('save')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
