'use client';

import React, { useEffect, useRef } from 'react';

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
  width = 'max-w-xl'
}: SlideOverProps) {
  const panelRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 z-[9999] overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* Slide-over panel */}
      <div className="absolute inset-y-0 right-0 flex max-w-full sm:pl-10 pointer-events-none">
        <div 
          ref={panelRef}
          className={`pointer-events-auto w-screen ${width} transform transition ease-in-out duration-300 bg-white shadow-2xl flex flex-col`}
          style={{ 
            animation: 'slideInRight 0.3s ease-out forwards'
          }}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b border-gray-200 flex items-center justify-between bg-white shrink-0">
            <div>
              <h3 className="font-bold text-xl text-[#041627]" style={{ fontFamily: 'Manrope, sans-serif' }}>
                {title}
              </h3>
              {subtitle && (
                <div className="mt-1 text-sm text-gray-500">
                  {subtitle}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {actions}
              <button 
                type="button" 
                className="btn btn-sm btn-circle btn-ghost text-gray-500 hover:text-gray-800 hover:bg-gray-100" 
                onClick={onClose}
              >
                {/* eslint-disable-next-line i18next/no-literal-string */}
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto w-full p-3 sm:p-6">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0">
              {footer}
            </div>
          )}
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </div>
  );
}
