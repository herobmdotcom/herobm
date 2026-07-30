import { useState, useEffect } from 'react';
import { Button } from '@/components/shared/Button';
import { InlineSettingsTable } from '@/components/shared/InlineSettingsTable';
import SlideOver from '@/components/shared/SlideOver';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { useTranslations } from 'next-intl';
import { TaxCategory } from './TaxSettingsSection';

interface TaxPositionsSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for dynamic typing
  appSettings: Record<string, any> | null;
  updateAppSetting: (field: string, value: unknown) => Promise<void>;
}

export function TaxPositionsSection({ appSettings, updateAppSetting }: TaxPositionsSectionProps) {
  const tSettings = useTranslations('admin.settings');
  const tCommon = useTranslations('admin.common');

  const [taxPositions, setTaxPositions] = useState<api.TaxPositionResponseDto[]>([]);
  const [taxPositionMappings, setTaxPositionMappings] = useState<api.TaxPositionMappingResponseDto[]>([]);
  const [taxPositionsLoading, setTaxPositionsLoading] = useState(true);
  const [selectedTaxPosition, setSelectedTaxPosition] = useState<api.TaxPositionResponseDto | null>(null);
  
  // We need categories for the dropdown in the mappings table
  const [categories, setCategories] = useState<TaxCategory[]>([]);

  const loadData = async () => {
    try {
      setTaxPositionsLoading(true);
      const [posRes, mapRes, catRes] = await Promise.all([
        api.taxPositionsControllerFindAll(),
        api.taxPositionMappingsControllerFindAll(),
        api.taxCategoriesControllerFindAll()
      ]);
      setTaxPositions((posRes.data as api.TaxPositionResponseDto[]).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
      setTaxPositionMappings(mapRes.data as api.TaxPositionMappingResponseDto[]);
      setCategories((catRes.data as unknown as TaxCategory[]).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
    } catch (err: unknown) {
      toast.error(tSettings('toasts.loadFailed', { area: tSettings('sections.taxPositions') }) + ': ' + getErrorMessage(err));
    } finally {
      setTaxPositionsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadTaxPositions = async () => {
    try {
      const [posRes, mapRes] = await Promise.all([
        api.taxPositionsControllerFindAll(),
        api.taxPositionMappingsControllerFindAll()
      ]);
      setTaxPositions((posRes.data as api.TaxPositionResponseDto[]).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })));
      setTaxPositionMappings(mapRes.data as api.TaxPositionMappingResponseDto[]);
    } catch (err: unknown) {
      toast.error('Failed to reload tax positions: ' + getErrorMessage(err));
    }
  };

  return (
    <>
      <div id="tax-positions-section" className="card relative mt-8">
        <InlineSettingsTable
          title={
            <div className="flex items-center justify-between">
              <h3 className="section-heading !mb-0 flex items-center gap-2">
                { }
                {/* eslint-disable-next-line no-restricted-syntax -- Hardcoded string for icon */}
                <span className="material-symbols-outlined">{'map'}</span>
                {tSettings('sections.taxPositions')}
              </h3>
            </div>
          }
          beforeTable={
            <div className="flex gap-8 mb-6 mt-4">
              <div className="flex flex-col gap-1 flex-1 max-w-sm">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Default Customer Tax Position
                </label>
                <select
                  className="input"
                  value={(appSettings?.defaultCustomerTaxPositionId as string) || ''}
                  onChange={(e) => updateAppSetting('defaultCustomerTaxPositionId', e.target.value)}
                >
                  <option value="">{tCommon('notConfigured')}</option>
                  {taxPositions.map(p => (
                    <option key={p.taxPositionId} value={p.taxPositionId}>{p.code} - {p.title}</option>
                  ))}
                </select>
              </div>
              
              <div className="flex flex-col gap-1 flex-1 max-w-sm">
                <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                  Default Supplier Tax Position
                </label>
                <select
                  className="input"
                  value={(appSettings?.defaultSupplierTaxPositionId as string) || ''}
                  onChange={(e) => updateAppSetting('defaultSupplierTaxPositionId', e.target.value)}
                >
                  <option value="">{tCommon('notConfigured')}</option>
                  {taxPositions.map(p => (
                    <option key={p.taxPositionId} value={p.taxPositionId}>{p.code} - {p.title}</option>
                  ))}
                </select>
              </div>
            </div>
          }
          data={taxPositions || []}
          rowKey={(r: api.TaxPositionResponseDto) => r.taxPositionId}
          onSave={async (row: api.TaxPositionResponseDto, isNew: boolean) => {
            if (!row.code || !row.title) {
              throw new Error(tCommon('errors.typeAndDateRequired') || 'Required');
            }
            const payload = {
              code: row.code.toUpperCase(),
              title: row.title,
            };
            if (isNew) {
              await api.taxPositionsControllerCreate(payload);
              toast.success('Tax Position created');
            } else {
              await api.taxPositionsControllerUpdate(row.taxPositionId, payload);
              toast.success('Tax Position updated');
            }
            loadTaxPositions();
          }}
          onDelete={async (row: api.TaxPositionResponseDto) => {
            if (!confirm('Delete Tax Position?')) return;
            await api.taxPositionsControllerRemove(row.taxPositionId);
            toast.success('Tax Position deleted');
            loadTaxPositions();
          }}
          onAdd={() => ({ code: '', title: '' } as unknown as api.TaxPositionResponseDto)}
          canEdit={() => true}
          canDelete={() => true}
          addLabel={tSettings('actions.create')}
          emptyLabel="No Tax Positions defined."
          columns={[
            {
              key: 'code',
              title: tSettings('labels.code'),
              type: 'text',
              width: 150,
              validate: (v: unknown) => v ? null : 'Required'
            },
            {
              key: 'title',
              title: tSettings('labels.title'),
              type: 'text',
              validate: (v: unknown) => v ? null : 'Required'
            },
            {
              key: 'mappings',
              title: 'Mappings',
              width: 120,
              render: (row, isEditing) => {
                if (isEditing) return <span className="text-xs text-muted">{tSettings('financialSettings.saveToMap')}</span>;
                return (
                  <Button
                    variant="secondary" size="xs"
                    onClick={() => setSelectedTaxPosition(row)}
                  >
                    {tCommon('map')}
                    {taxPositionMappings.some((m) => m.taxPositionId === row.taxPositionId) && (
                      <span className="inline-flex h-2 w-2 rounded-full bg-green-500 ml-2"></span>
                    )}
                  </Button>
                );
              }
            }
          ]}
        />
      </div>

      <SlideOver
        isOpen={!!selectedTaxPosition}
        onClose={() => setSelectedTaxPosition(null)}
        title={`${tCommon('map')}: ${selectedTaxPosition?.title || ''}`}
        width="max-w-3xl"
      >
        <div className="p-4 flex flex-col gap-6">
          <InlineSettingsTable
            title={<h3 className="section-heading !mb-0">{tSettings('labels.mappings')}</h3>}
            data={taxPositionMappings.filter(m => m.taxPositionId === selectedTaxPosition?.taxPositionId) || []}
            rowKey={(r: api.TaxPositionMappingResponseDto) => `${r.sourceTaxCategoryId}_${r.destinationTaxCategoryId}`}
            onSave={async (row: api.TaxPositionMappingResponseDto, isNew: boolean) => {
              if (!row.sourceTaxCategoryId || !row.destinationTaxCategoryId) {
                throw new Error(tCommon('errors.sourceAndDestRequired'));
              }
              const payload = {
                sourceTaxCategoryId: row.sourceTaxCategoryId,
                destinationTaxCategoryId: row.destinationTaxCategoryId,
              };
              if (isNew) {
                await api.taxPositionMappingsControllerCreate(selectedTaxPosition!.taxPositionId, payload);
                toast.success('Mapping created');
              } else {
                await api.taxPositionMappingsControllerRemove(selectedTaxPosition!.taxPositionId, row.sourceTaxCategoryId);
                await api.taxPositionMappingsControllerCreate(selectedTaxPosition!.taxPositionId, payload);
                toast.success('Mapping updated');
              }
              loadTaxPositions();
            }}
            onDelete={async (row: api.TaxPositionMappingResponseDto) => {
              if (!confirm('Delete mapping?')) return;
              await api.taxPositionMappingsControllerRemove(selectedTaxPosition!.taxPositionId, row.sourceTaxCategoryId);
              toast.success('Mapping deleted');
              loadTaxPositions();
            }}
            onAdd={() => ({ sourceTaxCategoryId: '', destinationTaxCategoryId: '' } as unknown as api.TaxPositionMappingResponseDto)}
            canEdit={() => true}
            canDelete={() => true}
            addLabel="Add Mapping"
            emptyLabel="No Mappings defined."
            columns={[
              {
                key: 'sourceTaxCategoryId',
                title: 'From (Product Default)',
                type: 'select',
                options: categories.map(c => ({ value: c.taxCategoryId, label: `${c.code} - ${c.title} (${Number(c.rate).toFixed(2)}%)` })),
                validate: (v: unknown) => v ? null : 'Required',
                width: 250
              },
              {
                key: 'destinationTaxCategoryId',
                title: 'To (Actual Applied)',
                type: 'select',
                options: categories.map(c => ({ value: c.taxCategoryId, label: `${c.code} - ${c.title} (${Number(c.rate).toFixed(2)}%)` })),
                validate: (v: unknown) => v ? null : 'Required',
                width: 250
              }
            ]}
          />
        </div>
      </SlideOver>
    </>
  );
}
