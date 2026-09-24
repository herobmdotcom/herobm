'use client';

import React, { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import LocationSelect from '@/components/shared/LocationSelect';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface CreateStocktakeSlideOverProps {
  open: boolean;
  onClose: () => void;
  onCreated: (stocktakeId?: string) => void;
}

export default function CreateStocktakeSlideOver({
  open,
  onClose,
  onCreated,
}: CreateStocktakeSlideOverProps) {
  const t = useTranslations('stocktakes.createSlideOver');
  const tScopes = useTranslations('stocktakes.scopes');
  const tCommon = useTranslations('common');

  const [name, setName] = useState('');
  const [locationId, setLocationId] = useState('');
  const [scopeType, setScopeType] = useState<'full' | 'zone' | 'bin_pattern' | 'manual'>('full');
  const [zoneFilter, setZoneFilter] = useState('');
  const [binPattern, setBinPattern] = useState('');
  const [isBlindCount, setIsBlindCount] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setLocationId('');
      setScopeType('full');
      setZoneFilter('');
      setBinPattern('');
      setIsBlindCount(false);
      setNotes('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Please enter a stocktake title');
      return;
    }
    if (!locationId) {
      toast.error('Please select a fulfillment location');
      return;
    }
    if (scopeType === 'zone' && !zoneFilter.trim()) {
      toast.error('Please enter a zone filter');
      return;
    }
    if (scopeType === 'bin_pattern' && !binPattern.trim()) {
      toast.error('Please enter a bin pattern prefix');
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await api.stocktakesControllerCreate({
        name: name.trim(),
        locationId,
        scopeType,
        zoneFilter: scopeType === 'zone' ? zoneFilter.trim() : undefined,
        binPattern: scopeType === 'bin_pattern' ? binPattern.trim() : undefined,
        isBlindCount,
        notes: notes.trim() || undefined,
      });

      toast.success(`Stocktake ${res.data.stocktakeNumber} created`);
      onClose();
      onCreated(res.data.stocktakeId);
    } catch (err) {
      toast.error(getErrorMessage(err) || 'Failed to create stocktake');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SlideOver
      isOpen={open}
      onClose={onClose}
      title={t('title')}
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            type="submit"
            form="create-stocktake-form"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('creating') : t('createButton')}
          </Button>
        </div>
      }
    >
      <form id="create-stocktake-form" onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('nameLabel')}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('namePlaceholder')}
            className="input w-full"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('locationLabel')}
          </label>
          <LocationSelect
            className="w-full"
            value={locationId}
            onChange={(val) => setLocationId(val || '')}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('scopeLabel')}
          </label>
          <select
            value={scopeType}
            onChange={(e) =>
              setScopeType(
                e.target.value as 'full' | 'zone' | 'bin_pattern' | 'manual',
              )
            }
            className="input w-full"
          >
            <option value="full">{tScopes('full')}</option>
            <option value="zone">{tScopes('zone')}</option>
            <option value="bin_pattern">{tScopes('bin_pattern')}</option>
            <option value="manual">{tScopes('manual')}</option>
          </select>
        </div>

        {scopeType === 'zone' && (
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('zoneLabel')}
            </label>
            <input
              type="text"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              placeholder={t('zonePlaceholder')}
              className="input w-full font-mono uppercase"
              required
            />
          </div>
        )}

        {scopeType === 'bin_pattern' && (
          <div>
            <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
              {t('binPatternLabel')}
            </label>
            <input
              type="text"
              value={binPattern}
              onChange={(e) => setBinPattern(e.target.value)}
              placeholder={t('binPatternPlaceholder')}
              className="input w-full font-mono uppercase"
              required
            />
          </div>
        )}

        <div className="flex items-start gap-3">
          <div className="flex h-5 items-center">
            <input
              id="isBlindCount"
              type="checkbox"
              checked={isBlindCount}
              onChange={(e) => setIsBlindCount(e.target.checked)}
              className="w-4 h-4 rounded border-[var(--border)] accent-[var(--accent)] cursor-pointer"
            />
          </div>
          <div className="text-sm">
            <label htmlFor="isBlindCount" className="font-medium text-[var(--text-primary)] cursor-pointer">
              {t('blindCountLabel')}
            </label>
            <p className="text-xs text-[var(--text-muted)] mt-0.5">
              {t('blindCountDesc')}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5 text-[var(--text-muted)]">
            {t('notesLabel')}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('notesPlaceholder')}
            rows={3}
            className="input w-full"
          />
        </div>
      </form>
    </SlideOver>
  );
}
