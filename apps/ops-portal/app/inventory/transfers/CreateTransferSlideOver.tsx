'use client';

import { useState, useEffect } from 'react';
import SlideOver from '@/components/shared/SlideOver';
import { useTranslations } from 'next-intl';
import LocationSelect from '@/components/shared/LocationSelect';
import ProductSearchInput from '@/components/shared/ProductSearchInput';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { getErrorMessage } from '@herobm/shared';

interface LineItem {
  productId: string;
  productNumber: string;
  name: string;
  quantity: number;
}

interface CreateTransferSlideOverProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTransferSlideOver({ open, onClose, onCreated }: CreateTransferSlideOverProps) {
  const t = useTranslations('transfers');
  const tCommon = useTranslations('common');
  
  const [sourceLocationId, setSourceLocationId] = useState('');
  const [destinationLocationId, setDestinationLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<LineItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      // Reset state
      setSourceLocationId('');
      setDestinationLocationId('');
      setNotes('');
      setLines([]);
    }
  }, [open]);

  const handleAddProduct = (product: { productId: string; productNumber: string; name: string }) => {
    // Check if product already exists
    const existingIndex = lines.findIndex(l => l.productId === product.productId);
    if (existingIndex >= 0) {
      updateLine(existingIndex, 'quantity', lines[existingIndex].quantity + 1);
    } else {
      setLines([...lines, { 
        productId: product.productId, 
        productNumber: product.productNumber,
        name: product.name,
        quantity: 1 
      }]);
    }
  };

  const handleRemoveLine = (index: number) => {
    setLines(lines.filter((_, i) => i !== index));
  };

  const updateLine = (index: number, field: 'quantity', value: number) => {
    const newLines = [...lines];
    newLines[index] = { ...newLines[index], [field]: value };
    setLines(newLines);
  };

  const handleSubmit = async () => {
    if (!sourceLocationId || !destinationLocationId) {
      toast.error('Source and destination locations are required.');
      return;
    }
    
    if (sourceLocationId === destinationLocationId) {
      toast.error('Source and destination locations must be different.');
      return;
    }

    const validLines = lines
      .filter(l => l.productId && l.quantity > 0)
      .map(l => ({
        productId: l.productId,
        quantity: l.quantity.toString()
      }));
    
    try {
      setIsSubmitting(true);
      await api.transfersControllerCreate({
        sourceLocationId,
        destinationLocationId,
        notes,
        lines: validLines
      });
      onCreated();
      onClose();
    } catch (e: unknown) {
      toast.error(getErrorMessage(e) || 'Failed to create transfer order');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SlideOver
      isOpen={open}
      onClose={onClose}
      title={t('createSlideOver.title')}
      subtitle={t('createSlideOver.subtitle')}
      width="max-w-3xl"
      footer={
        <div className="flex items-center justify-end gap-3 w-full">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSubmitting}>
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !sourceLocationId || !destinationLocationId}
            className="btn btn-primary bg-[#006b5c] hover:bg-[#005246] border-none text-white"
          >
            {isSubmitting ? (
              <><span className="loading loading-spinner loading-sm mr-2" />{tCommon('saving')}</>
            ) : (
              t('buttons.createTransfer')
            )}
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('columns.sourceLocation')} *
            </label>
            <LocationSelect
              className="w-full"
              value={sourceLocationId}
              onChange={(val) => setSourceLocationId(val || '')}
              placeholder={t('placeholders.selectSourceLocation')}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('columns.destinationLocation')} *
            </label>
            <LocationSelect
              className="w-full"
              value={destinationLocationId}
              onChange={(val) => setDestinationLocationId(val || '')}
              placeholder={t('placeholders.selectDestinationLocation')}
              required
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {t('columns.notes')}
          </label>
          <textarea
            className="input w-full"
            rows={3}
            placeholder={t('placeholders.notes')}
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        <div className="border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium text-lg">{t('lineItems')}</h4>
            <ProductSearchInput
              onSelect={handleAddProduct}
              placeholder="Search product..."
              style={{ width: 240 }}
              fulfillmentLocationId={sourceLocationId}
            />
          </div>

          <div className="space-y-3">
            {lines.map((line, index) => (
              <div key={index} className="flex gap-3 items-center">
                <div className="flex-1 text-sm">
                  <span className="font-semibold text-gray-900">{line.productNumber}</span>
                  <span className="text-gray-500 ml-2">{line.name}</span>
                </div>
                <div className="w-32">
                  <input
                    type="number"
                    min="1"
                    className="input w-full"
                    value={line.quantity || ''}
                    onChange={e => updateLine(index, 'quantity', parseFloat(e.target.value))}
                  />
                </div>
                <button
                  className="text-gray-400 hover:text-red-500"
                  onClick={() => handleRemoveLine(index)}
                >
                  { }
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            ))}
            {lines.length === 0 && (
              <div className="text-sm text-gray-500 italic">{t('noLinesAdded')}</div>
            )}
          </div>
        </div>
      </div>
    </SlideOver>
  );
}
