'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import * as api from '@herobm/sdk';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { getErrorMessage } from '@herobm/shared';
import { reportError } from '@/lib/api';
import { Button } from '@/components/shared/Button';

interface CopyProductModalProps {
  product: {
    productId: string;
    productNumber: string;
    name: string;
  };
  isOpen: boolean;
  onClose: () => void;
}

export default function CopyProductModal({
  product,
  isOpen,
  onClose,
}: CopyProductModalProps) {
  const router = useRouter();
  const t = useTranslations('products');
  const [productNumber, setProductNumber] = useState('');
  const [name, setName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && product) {
      setProductNumber(`${product.productNumber}-COPY`);
      setName(`${product.name} (Copy)`);
      setSubmitting(false);
    }
  }, [isOpen, product]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productNumber.trim() || !name.trim() || submitting) return;
    setSubmitting(true);

    try {
      const res = await api.productsControllerCopy(product.productId, {
        productNumber: productNumber.trim(),
        name: name.trim(),
      });
      toast.success(t('toast.productCopied'));
      onClose();
      router.push(`/products/${res.data.productId}`);
    } catch (err: unknown) {
      reportError(err, 'CopyProductModal.handleSubmit');
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = productNumber.trim() !== '' && name.trim() !== '';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 pt-10">
      <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl max-w-[500px] w-full flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)] shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--accent)] text-[22px]">
              content_copy
            </span>
            <h3 className="font-bold text-lg text-[var(--text-primary)] font-['Manrope',sans-serif]">
              {t('copyModal.title')}
            </h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]"
            onClick={onClose}
            disabled={submitting}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </Button>
        </div>

        {/* Product Context Banner */}
        <div className="bg-[var(--bg-secondary)] border-b border-[var(--border)] px-6 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[var(--text-muted)] text-[18px]">
              inventory_2
            </span>
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
              {product.productNumber}
            </div>
            <div className="text-sm font-semibold text-[var(--text-primary)] truncate">
              {product.name}
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-[var(--bg-card)]">
          <p className="text-xs text-[var(--text-muted)]">
            {t('copyModal.description', {
              productNumber: product.productNumber,
              name: product.name,
            })}
          </p>

          <div>
            <label className="block text-xs font-bold tracking-wide uppercase text-[var(--text-muted)] mb-1.5">
              {t('copyModal.productNumber')} *
            </label>
            <input
              type="text"
              required
              className="input w-full"
              value={productNumber}
              onChange={(e) => setProductNumber(e.target.value)}
              disabled={submitting}
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-bold tracking-wide uppercase text-[var(--text-muted)] mb-1.5">
              {t('copyModal.productName')} *
            </label>
            <input
              type="text"
              required
              className="input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-4 flex items-center justify-end gap-2 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              {t('copyModal.cancel')}
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting}
              disabled={!isValid || submitting}
            >
              {submitting ? t('copyModal.copying') : t('copyModal.copy')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
