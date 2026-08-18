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
    <div
      className={`card flex flex-col items-center justify-center p-3 h-full relative transition-colors ${
        isDragOver ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="relative group w-36 h-36 sm:w-40 sm:h-40 shrink-0 rounded-xl overflow-hidden">
        <ProductImage
          imagePath={imagePath}
          alt={productName || t('images.title')}
          size="full"
          showPreviewOnClick={Boolean(imagePath)}
          className="w-full h-full rounded-xl shadow-xs"
        />

        {!disabled && (
          <div
            className="absolute bottom-1.5 right-1.5 flex items-center gap-1 bg-black/60 backdrop-blur-xs border border-white/10 rounded-lg p-0.5 shadow-md transition-opacity duration-150 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              type="button"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title={imagePath ? t('images.change') : t('images.upload')}
              className="text-white hover:text-[var(--accent)] hover:bg-white/10 transition-colors p-1 h-7 w-7 flex items-center justify-center rounded-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
            </Button>

            {imagePath && (
              <Button
                variant="ghost"
                type="button"
                size="sm"
                onClick={handleRemove}
                disabled={isDeleting || isUploading}
                title={t('images.remove')}
                className="text-white hover:text-red-400 hover:bg-white/10 transition-colors p-1 h-7 w-7 flex items-center justify-center rounded-md cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">
                  delete
                </span>
              </Button>
            )}
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isUploading}
      />
    </div>
  );
}
