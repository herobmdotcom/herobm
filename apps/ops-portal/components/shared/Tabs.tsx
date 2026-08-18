'use client';

import React from 'react';
import { Button } from './Button';

export type TabColor =
  | 'accent'
  | 'emerald'
  | 'amber'
  | 'rose'
  | 'success'
  | 'warning'
  | 'danger';

export interface TabItem<T extends string = string> {
  id: T;
  label: React.ReactNode;
  icon?: string;
  badge?: React.ReactNode;
  disabled?: boolean;
  color?: TabColor;
}

export interface TabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (tabId: T) => void;
  className?: string;
  variant?: 'underline' | 'flat';
  size?: 'sm' | 'md';
  equalWidth?: boolean;
  actions?: React.ReactNode;
}

const colorStyles: Record<TabColor, { textActive: string; bar: string; iconActive: string }> = {
  accent: {
    textActive: 'text-[var(--accent)] font-bold hover:bg-transparent hover:text-[var(--accent)]',
    bar: 'bg-[var(--accent)]',
    iconActive: 'text-[var(--accent)]',
  },
  emerald: {
    textActive: 'text-emerald-600 dark:text-emerald-400 font-bold hover:bg-transparent hover:text-emerald-600',
    bar: 'bg-emerald-500',
    iconActive: 'text-emerald-600 dark:text-emerald-400',
  },
  success: {
    textActive: 'text-[var(--success)] font-bold hover:bg-transparent hover:text-[var(--success)]',
    bar: 'bg-[var(--success)]',
    iconActive: 'text-[var(--success)]',
  },
  amber: {
    textActive: 'text-amber-600 dark:text-amber-400 font-bold hover:bg-transparent hover:text-amber-600',
    bar: 'bg-amber-500',
    iconActive: 'text-amber-600 dark:text-amber-400',
  },
  warning: {
    textActive: 'text-[var(--warning)] font-bold hover:bg-transparent hover:text-[var(--warning)]',
    bar: 'bg-[var(--warning)]',
    iconActive: 'text-[var(--warning)]',
  },
  rose: {
    textActive: 'text-rose-600 dark:text-rose-400 font-bold hover:bg-transparent hover:text-rose-600',
    bar: 'bg-rose-500',
    iconActive: 'text-rose-600 dark:text-rose-400',
  },
  danger: {
    textActive: 'text-[var(--danger)] font-bold hover:bg-transparent hover:text-[var(--danger)]',
    bar: 'bg-[var(--danger)]',
    iconActive: 'text-[var(--danger)]',
  },
};

/**
 * Standard flat tab navigation component.
 * Default `underline` variant displays a sleek border-bottom layout with active indicator.
 */
export default function Tabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  variant = 'underline',
  size = 'md',
  equalWidth = false,
  actions,
}: TabsProps<T>) {
  const isSm = size === 'sm';

  if (variant === 'flat') {
    return (
      <div className={`flex items-center gap-1 p-1 bg-[var(--bg-muted)] rounded-lg ${className}`}>
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 rounded-md font-medium transition-colors border-none outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                isSm ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-sm'
              } ${
                isActive
                  ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-none'
                  : 'bg-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              {tab.icon && (
                <span className={`material-symbols-outlined ${isSm ? 'text-[16px]' : 'text-[18px]'}`}>
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.badge && <span className="ml-1">{tab.badge}</span>}
            </Button>
          );
        })}
      </div>
    );
  }

  // Default: 'underline' - Standard flat tab bar
  return (
    <div
      role="tablist"
      className={`flex flex-col sm:flex-row sm:items-end justify-between border-b border-[var(--border)] w-full gap-3 ${className}`}
    >
      <div
        className={`flex items-center ${
          equalWidth ? 'w-full gap-1' : 'gap-6 min-w-0'
        } overflow-x-auto overflow-y-hidden hide-scrollbar`}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;
          const style = colorStyles[tab.color || 'accent'];

          return (
            <Button
              key={tab.id}
              type="button"
              variant="ghost"
              role="tab"
              aria-selected={isActive}
              disabled={tab.disabled}
              onClick={() => onChange(tab.id)}
              className={`relative rounded-none h-auto transition-colors flex items-center gap-2 border-none bg-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed ${
                equalWidth ? 'flex-1 justify-center text-center px-2' : 'px-0'
              } ${
                isSm ? 'text-xs pb-2 pt-0.5' : 'text-sm pb-2.5 pt-1'
              } ${
                isActive
                  ? style.textActive
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-transparent font-semibold'
              }`}
            >
              {tab.icon && (
                <span
                  className={`material-symbols-outlined select-none ${
                    isSm ? 'text-[16px]' : 'text-[18px]'
                  } ${isActive ? style.iconActive : 'text-[var(--text-muted)]'}`}
                >
                  {tab.icon}
                </span>
              )}
              <span>{tab.label}</span>
              {tab.badge && <span className="ml-1">{tab.badge}</span>}
              {isActive && (
                <span
                  className={`absolute bottom-0 left-0 right-0 h-[2px] rounded-full ${style.bar}`}
                />
              )}
            </Button>
          );
        })}
      </div>

      {actions && (
        <div className="flex flex-wrap items-center gap-2 pb-1.5 w-full sm:w-auto justify-start sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
