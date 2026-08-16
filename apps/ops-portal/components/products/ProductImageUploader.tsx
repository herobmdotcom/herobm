'use client';

import React, { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { apiUpload } from '@/lib/api';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';
import ProductImage from './ProductImage';

interface ProductImageUploaderProps {
  productId: string;
  imagePath?: string | null;
  productName?: string;
  onImageUpdated?: (newImagePath: string | null) => void;
  disabled?: boolean;
}

export default function ProductImageUploader({
  productId,
  imagePath,
  productName = '',
  onImageUpdated,
  disabled = false,
}: ProductImageUploaderProps) {
  const t = useTranslations('products');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await uploadFile(files[0]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const uploadFile = async (file: File) => {
    if (disabled || isUploading) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('images.maxSize'));
      return;
    }

    const validTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/svg+xml',
    ];
    if (!validTypes.includes(file.type.toLowerCase())) {
      toast.error(t('images.maxSize'));
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const updated = await apiUpload<{ imagePath: string | null }>(
        `/api/products/${productId}/image`,
        formData,
      );
      toast.success(t('images.uploadSuccess'));
      onImageUpdated?.(updated.imagePath);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('images.uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (disabled || isDeleting || isUploading) return;
    if (!confirm(t('images.confirmRemove'))) return;

    setIsDeleting(true);
    try {
      await api.productsControllerRemoveImage(productId);
      toast.success(t('images.removeSuccess'));
      onImageUpdated?.(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('images.uploadError'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled || isUploading) return;

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--text-main)]">
          {t('images.title')}
        </h3>
        {imagePath && !disabled && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={isDeleting || isUploading}
            className="text-xs text-red-500 hover:text-red-400 font-medium p-0 h-auto"
          >
            {t('images.remove')}
          </Button>
        )}
      </div>

      <div
        className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-3 transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-[var(--border)] hover:border-[var(--text-muted)] bg-[var(--bg-card)]'
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <ProductImage
          imagePath={imagePath}
          alt={productName || t('images.title')}
          size="lg"
          showPreviewOnClick={Boolean(imagePath)}
          className="rounded-lg mb-2 shadow-xs"
        />

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
          className="hidden"
          onChange={handleFileChange}
          disabled={disabled || isUploading}
        />

        {!disabled && (
          <div className="flex flex-col items-center text-center gap-1 mt-1">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="text-xs font-medium text-blue-500 hover:text-blue-400"
            >
              {isUploading
                ? t('images.uploading')
                : imagePath
                  ? t('images.change')
                  : t('images.upload')}
            </Button>
            <span className="text-[10px] text-[var(--text-muted)]">
              {t('images.maxSize')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
