'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../../lib/api';
import { useTranslations } from 'next-intl';
import { useRef, useLayoutEffect } from 'react';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  subItems?: { href: string; label: string }[];
}

export interface NavSection {
  /** Optional section header label, e.g. "Inventory" */
  label?: string;
  items: NavItem[];
}

export interface SidebarProps {
  /** Portal title, e.g. "modbm" */
  title: string;
  /** Subtitle shown below the title, e.g. "Business Management" */
  subtitle: string;
  /** Navigation sections with grouped items */
  sections: NavSection[];
  /** Optional footer text, e.g. "Phase 3 • modbm" */
  footer?: string;
}

export default function Sidebar({ title, subtitle, sections, footer }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('common.auth');

  return (
    <aside
      className="w-60 h-screen fixed left-0 top-0 flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-5 py-5">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-7 h-7 rounded border-2 border-[var(--accent)] text-[var(--accent)] font-extrabold text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            H
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
            {title}
          </h1>
        </div>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      </div>
      <nav className="flex-1 px-3 mt-2 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            {section.label && (
              <p
                className="text-[10px] font-semibold uppercase tracking-wider px-3 mb-1"
                style={{ color: 'var(--text-muted)' }}
              >
                {section.label}
              </p>
            )}
            {section.items.map((item) => {
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
              
              // Handle sub-item active states to ensure parent stays highlight correctly,
              // but we only exactly match if it's the exact path when subItems exist.
              const isParentExact = pathname === item.href;

              return (
                <div key={item.href} className="mb-0.5">
                  <Link
                    href={item.href}
                    scroll={false}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative"
                    style={{
                      background: isActive ? 'var(--accent-glow)' : 'transparent',
                      color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: isActive ? 600 : 400,
                    }}
                  >
                    <span className="material-symbols-outlined text-[18px]" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.subItems && (
                      <span className="material-symbols-outlined text-[16px] opacity-70">
                        {isActive ? 'expand_less' : 'expand_more'}
                      </span>
                    )}
                  </Link>
                  
                  {item.subItems && isActive && (
                    <div className="ml-9 mt-1 mb-2 flex flex-col gap-0.5 border-l-2 pl-3 py-1" style={{ borderColor: 'var(--border)' }}>
                      {item.subItems.map(sub => {
                        const isSubActive = pathname === sub.href;
                        return (
                          <Link
                            key={sub.href}
                            href={sub.href}
                            scroll={false}
                            className="text-xs py-1.5 px-3 rounded-md transition-colors"
                            style={{
                              background: isSubActive ? 'var(--bg-secondary-hover)' : 'transparent',
                              color: isSubActive ? 'var(--text-primary)' : 'var(--text-muted)',
                              fontWeight: isSubActive ? 600 : 400,
                            }}
                          >
                            {sub.label}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-5 py-4 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{footer || 'modbm'}</p>
        <button
          onClick={() => logout()}
          className="text-xs font-medium px-2 py-1 rounded transition-colors"
          style={{ 
            color: 'var(--text-muted)',
            backgroundColor: 'transparent',
            cursor: 'pointer'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          title={t('signOut')}
        >
          {t('signOut')}
        </button>
      </div>
    </aside>
  );
}
