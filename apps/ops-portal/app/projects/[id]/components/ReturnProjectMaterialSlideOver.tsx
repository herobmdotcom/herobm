'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import * as api from '@herobm/sdk';
import SlideOver from '@/components/shared/SlideOver';
import { Button } from '@/components/shared/Button';
import LocationSelect from '@/components/shared/LocationSelect';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import type { StagedMaterialOption } from './ConsumeProjectMaterialSlideOver';

interface ReturnProjectMaterialSlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  projectNumber?: string;
  stagingLocationId?: string | null;
  availableMaterials?: StagedMaterialOption[];
  onSuccess: () => Promise<void>;
}

export function ReturnProjectMaterialSlideOver({
  isOpen,
  onClose,
  projectId,
  projectNumber,
  stagingLocationId,
  availableMaterials = [],
  onSuccess,
}: ReturnProjectMaterialSlideOverProps) {
  const t = useTranslations('projects');
  const tCommon = useTranslations('common');

  const [sourceLocationId, setSourceLocationId] = useState(stagingLocationId || '');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [memo, setMemo] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync source location with staging location
  useEffect(() => {
    if (stagingLocationId && !sourceLocationId) {
      setSourceLocationId(stagingLocationId);
    }
  }, [stagingLocationId, sourceLocationId]);

  // Only allow returning materials that currently have positive available balance staged
  const returnableMaterials = useMemo(() => {
    return availableMaterials.filter((m) => m.availableQty > 0);
  }, [availableMaterials]);

  // Reset / initialize state when opening
  useEffect(() => {
    if (isOpen) {
      setSourceLocationId(stagingLocationId || '');
      setDestinationLocationId('');
      setMemo('');
      if (returnableMaterials.length === 1) {
        setSelectedProductId(returnableMaterials[0].productId);
        setQuantity(String(Math.min(1, returnableMaterials[0].availableQty)));
      } else {
        setSelectedProductId('');
        setQuantity('1');
      }
    }
  }, [isOpen, stagingLocationId, returnableMaterials]);

  const selectedMaterial = useMemo(() => {
    return returnableMaterials.find((m) => m.productId === selectedProductId) || null;
  }, [returnableMaterials, selectedProductId]);

  const maxAvailable = selectedMaterial ? selectedMaterial.availableQty : 0;
  const numQty = parseFloat(quantity);
  const isQtyPositive = !isNaN(numQty) && numQty > 0;
  const isQtyExceeding = !isNaN(numQty) && numQty > maxAvailable;
  const isQtyInvalid = quantity !== '' && (!isQtyPositive || isQtyExceeding);
  const isQtyValid = isQtyPositive && !isQtyExceeding;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedMaterial) {
      toast.error('Please select a staged material to return.');
      return;
    }
    const srcLoc = sourceLocationId || stagingLocationId;
    if (!srcLoc) {
      toast.error('Source staging location is required.');
      return;
    }
    if (!destinationLocationId) {
      toast.error('Destination warehouse location is required.');
      return;
    }
    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error(t('errors.quantityMustBePositive'));
      return;
    }
    if (qty > maxAvailable) {
      toast.error(t('errors.quantityExceedsAvailable', { max: maxAvailable.toLocaleString() }));
      return;
    }

    setLoading(true);
    try {
      await api.transfersControllerCreate({
        sourceLocationId: srcLoc,
        destinationLocationId,
        projectId,
        isProjectReturn: true,
        notes: memo.trim() || `Project ${projectNumber || projectId} - Material Return`,
        lines: [
          {
            productId: selectedMaterial.productId,
            quantity: String(qty),
          },
        ],
      });

      toast.success('Return transfer order created. Stock credit will post upon putaway confirmation.');
      setSelectedProductId('');
      setQuantity('1');
      setMemo('');
      setDestinationLocationId('');
      await onSuccess();
      onClose();
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || 'Failed to create return transfer order');
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    Boolean(selectedMaterial) &&
    Boolean(destinationLocationId) &&
    Boolean(sourceLocationId || stagingLocationId) &&
    isQtyValid;

  return (
    <SlideOver
      isOpen={isOpen}
      onClose={onClose}
      title={t('buttons.returnMaterial')}
      width="max-w-2xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button type="button" variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            {tCommon('buttons.cancel')}
          </Button>
          <Button
            type="submit"
            form="return-material-form"
            variant="primary"
            size="sm"
            disabled={loading || !isFormValid}
          >
            {loading ? t('buttons.saving') : t('buttons.returnMaterial')}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {returnableMaterials.length === 0 ? (
          <div className="p-6 text-center text-sm text-[var(--text-muted)] border border-[var(--border)] rounded-lg">
            <span className="material-symbols-outlined text-3xl mb-2 text-amber-500 block">
              inventory_2
            </span>
            <p className="font-medium text-[var(--text-primary)]">No staged materials available to return</p>
            <p className="text-xs mt-1">
              There is currently no staged stock with an available balance on this project site.
            </p>
          </div>
        ) : (
          <form id="return-material-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Staged Product Selection (Strictly limited to staged stock) */}
            <div>
              <label htmlFor="return-material-select" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                Staged Material to Return *
              </label>
              <select
                id="return-material-select"
                required
                className="input w-full text-xs"
                value={selectedProductId}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelectedProductId(newId);
                  const mat = returnableMaterials.find((m) => m.productId === newId);
                  if (mat) {
                    setQuantity(String(Math.min(1, mat.availableQty)));
                  } else {
                    setQuantity('1');
                  }
                }}
              >
                <option value="">{t('placeholders.selectStagedStock')}</option>
                {returnableMaterials.map((m) => (
                  <option key={m.productId} value={m.productId}>
                    {m.productNumber} — {m.productDescription} (Available: {m.availableQty.toLocaleString()})
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity and Notes (Immediately below Material Selection) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="return-quantity-input" className="block text-xs font-medium text-[var(--text-muted)]">
                    {t('labels.quantity')} *
                  </label>
                  {selectedMaterial && maxAvailable > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => setQuantity(String(maxAvailable))}
                      className="!p-0 !h-auto text-[11px] font-mono font-medium text-[var(--accent)] hover:underline cursor-pointer"
                    >
                      {t('labels.max', { qty: maxAvailable.toLocaleString() })}
                    </Button>
                  )}
                </div>
                <input
                  id="return-quantity-input"
                  type="number"
                  step="any"
                  min="0.0001"
                  max={maxAvailable > 0 ? maxAvailable : undefined}
                  required
                  className={`input w-full text-xs ${isQtyInvalid ? '!border-red-500 !focus:border-red-500 !ring-1 !ring-red-500' : ''}`}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  disabled={!selectedMaterial}
                />
                {quantity !== '' && !isQtyPositive && (
                  <p className="text-xs text-red-500 mt-1 font-medium">
                    {t('errors.quantityMustBePositive')}
                  </p>
                )}
                {isQtyExceeding && (
                  <p className="text-xs text-red-500 mt-1 font-medium">
                    {t('errors.quantityExceedsAvailable', { max: maxAvailable.toLocaleString() })}
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="return-reference-input" className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  {t('labels.reference')}
                </label>
                <input
                  id="return-reference-input"
                  type="text"
                  className="input w-full text-xs"
                  placeholder="e.g. Unused stock return to warehouse"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            </div>

            {/* Location Routing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {!stagingLocationId ? (
                <div>
                  <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                    Source Staging Location *
                  </label>
                  <LocationSelect
                    value={sourceLocationId || null}
                    onChange={(locId) => setSourceLocationId(locId || '')}
                    placeholder="Select staging location..."
                    className="input w-full text-xs"
                  />
                </div>
              ) : null}
              <div className={stagingLocationId ? 'col-span-2' : ''}>
                <label className="block text-xs font-medium mb-1.5 text-[var(--text-muted)]">
                  Destination Warehouse Location *
                </label>
                <LocationSelect
                  value={destinationLocationId || null}
                  onChange={(locId) => setDestinationLocationId(locId || '')}
                  placeholder="Select receiving warehouse location..."
                  className="input w-full text-xs"
                />
              </div>
            </div>
          </form>
        )}
      </div>
    </SlideOver>
  );
}
