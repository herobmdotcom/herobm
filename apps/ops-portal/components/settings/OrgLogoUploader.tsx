'use client';

import React, { useRef, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { apiUpload } from '@/lib/api';
import * as api from '@herobm/sdk';
import { getErrorMessage } from '@herobm/shared';
import { Button } from '@/components/shared/Button';

interface OrgLogoUploaderProps {
  logoUrl?: string | null;
  companyName?: string;
  onLogoUpdated?: (newLogoUrl: string | null) => void;
  disabled?: boolean;
}

export default function OrgLogoUploader({
  logoUrl,
  companyName = '',
  onLogoUpdated,
  disabled = false,
}: OrgLogoUploaderProps) {
  const t = useTranslations('admin.settings.logo');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [cacheBuster, setCacheBuster] = useState(Date.now());

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  const getImageUrl = () => {
    if (!logoUrl) return null;
    if (logoUrl.startsWith('http://') || logoUrl.startsWith('https://')) {
      return logoUrl;
    }
    const cleanPath = logoUrl
      .replace(/^(\/api)?\/storage\/images\//, '')
      .replace(/^(\/api)?\/products\/images\//, '');
    return `/api/storage/images/${cleanPath}?t=${cacheBuster}`;
  };

  const imageUrl = getImageUrl();

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
      toast.error(t('maxSize'));
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
      toast.error(t('maxSize'));
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const updated = await apiUpload<{ logoUrl?: string | null }>(
        '/api/settings/organization/logo',
        formData,
      );
      setCacheBuster(Date.now());
      toast.success(t('uploadSuccess'));
      onLogoUpdated?.(updated.logoUrl ?? null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('uploadError'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = async () => {
    if (disabled || isDeleting || isUploading) return;
    if (!confirm(t('confirmRemove'))) return;

    setIsDeleting(true);
    try {
      await api.organizationControllerRemoveLogo();
      toast.success(t('removeSuccess'));
      onLogoUpdated?.(null);
    } catch (err: unknown) {
      toast.error(getErrorMessage(err) || t('uploadError'));
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
      className={`card flex flex-col items-center justify-center p-4 relative transition-colors ${
        isDragOver ? 'border-[var(--accent)] bg-[var(--accent)]/5' : ''
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="relative group w-44 h-36 shrink-0 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-card)] flex items-center justify-center">
        {imageUrl && !hasError ? (
          <img
            src={imageUrl}
            alt={companyName || t('title')}
            className="w-full h-full object-contain p-2 cursor-pointer hover:opacity-90 transition-opacity"
            onError={() => setHasError(true)}
            onClick={() => setIsPreviewOpen(true)}
            loading="lazy"
          />
        ) : (
          <div
            className="flex flex-col items-center justify-center gap-2 p-3 text-[var(--text-muted)] cursor-pointer select-none"
            onClick={() => !disabled && fileInputRef.current?.click()}
          >
            <svg
              className="w-10 h-10 opacity-40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
              />
            </svg>
            <span className="text-xs font-medium text-center opacity-70">
              {t('upload')}
            </span>
          </div>
        )}

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
              title={logoUrl ? t('change') : t('upload')}
              className="text-white hover:text-[var(--accent)] hover:bg-white/10 transition-colors p-1 h-7 w-7 flex items-center justify-center rounded-md cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">
                edit
              </span>
            </Button>

            {logoUrl && (
              <Button
                variant="ghost"
                type="button"
                size="sm"
                onClick={handleRemove}
                disabled={isDeleting || isUploading}
                title={t('remove')}
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

      {isPreviewOpen && imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
          onClick={() => setIsPreviewOpen(false)}
        >
          <div
            className="relative max-w-3xl max-h-[85vh] bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl shadow-2xl p-3 flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-2 right-2">
              <Button
                variant="ghost"
                size="sm"
                className="p-1 h-8 w-8 rounded-md"
                onClick={() => setIsPreviewOpen(false)}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </Button>
            </div>
            <div className="text-sm font-semibold mb-2 text-[var(--text-main)] max-w-md truncate">
              {companyName || t('title')}
            </div>
            <img
              src={imageUrl}
              alt={companyName || t('title')}
              className="max-w-full max-h-[70vh] object-contain rounded-lg p-2 bg-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
