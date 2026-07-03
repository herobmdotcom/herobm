import * as React from 'react';
import { Button } from './Button';

export interface PageHeaderAction {
  label: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-ghost' | 'ghost';
  disabled?: boolean;
  icon?: string;
}

export interface ContentPageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: PageHeaderAction[];
  children?: React.ReactNode;
}

export function ContentPageHeader({ title, subtitle, actions, children }: ContentPageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 shrink-0 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
        {subtitle && (
          <p className="text-sm mt-1 text-[var(--text-muted)]">
            {subtitle}
          </p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {children}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-3">
            {actions.map((action, idx) => (
            <Button
              key={idx}
              variant={action.variant || 'secondary'}
              onClick={action.onClick}
              disabled={action.disabled}
            >
              {action.icon && (
                <span className="material-symbols-outlined text-[18px]">{action.icon}</span>
              )}
              {action.label}
            </Button>
          ))}
        </div>
        )}
      </div>
    </div>
  );
}
