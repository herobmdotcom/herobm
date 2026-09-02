'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface SlideOverProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export default function SlideOver({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  actions,
  footer,
  width = 'max-w-xl',
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  // Prevent scroll on body when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const content = (
    <div className="fixed inset-0 z-[9990] overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-xs transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 flex w-full justify-end pointer-events-none sm:pl-10">
        <div 
          ref={panelRef}
          className={`pointer-events-auto w-full ${width} bg-[var(--bg-card)] text-[var(--text-primary)] border-l border-[var(--border)] shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 ease-out`}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)] shrink-0">
            <div>
              <h3 className="font-bold text-lg sm:text-xl text-[var(--text-primary)]">
                {title}
              </h3>
              {subtitle && (
                <div className="mt-1 text-xs sm:text-sm text-[var(--text-muted)]">
                  {subtitle}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <Button 
                type="button" 
                variant="ghost"
                size="sm"
                className="btn-circle text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]" 
                onClick={onClose}
              >

                <span className="material-symbols-outlined text-[20px]">close</span>
              </Button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto w-full p-4 sm:p-6 relative">
            {children}
            <div className="h-10 w-full shrink-0"></div>
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-secondary)] shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (!mounted || typeof document === 'undefined') {
    return content;
  }

  return createPortal(content, document.body);
}
