'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/shared/Button';

interface ProductImageProps {
  imagePath?: string | null;
  alt?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full';
  className?: string;
  showPreviewOnClick?: boolean;
}

const sizeClasses: Record<string, string> = {
  xs: 'w-6 h-6 rounded text-xs',
  sm: 'w-9 h-9 rounded text-xs',
  md: 'w-12 h-12 rounded-md text-sm',
  lg: 'w-24 h-24 rounded-lg text-base',
  xl: 'w-48 h-48 rounded-xl text-lg',
  full: 'w-full h-full rounded-md',
};

const iconSizes: Record<string, string> = {
  xs: 'w-3.5 h-3.5',
  sm: 'sm:w-5 sm:h-5 w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-10 h-10',
  xl: 'w-16 h-16',
  full: 'w-12 h-12',
};

export default function ProductImage({
  imagePath,
  alt = 'Product image',
  size = 'md',
  className = '',
  showPreviewOnClick = false,
}: ProductImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [imagePath]);

  const imageUrl = imagePath ? `/api/products/images/${imagePath}` : null;
  const containerSize = sizeClasses[size] || sizeClasses.md;
  const iconSize = iconSizes[size] || iconSizes.md;

  if (!imageUrl || hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] text-[var(--text-muted)] shrink-0 select-none overflow-hidden ${containerSize} ${className}`}
        title={alt}
      >
        <svg
          className={`${iconSize} opacity-40`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      </div>
    );
  }

  return (
    <>
      <div
        className={`relative shrink-0 overflow-hidden bg-[var(--bg-card)] border border-[var(--border)] ${containerSize} ${
          showPreviewOnClick ? 'cursor-pointer hover:opacity-90 transition-opacity' : ''
        } ${className}`}
        onClick={() => {
          if (showPreviewOnClick) {
            setIsPreviewOpen(true);
          }
        }}
      >
        <img
          src={imageUrl}
          alt={alt}
          className="w-full h-full object-contain p-0.5"
          onError={() => setHasError(true)}
          loading="lazy"
        />
      </div>

      {showPreviewOnClick && isPreviewOpen && (
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
              {alt}
            </div>
            <img
              src={imageUrl}
              alt={alt}
              className="max-w-full max-h-[70vh] object-contain rounded-lg"
            />
          </div>
        </div>
      )}
    </>
  );
}
