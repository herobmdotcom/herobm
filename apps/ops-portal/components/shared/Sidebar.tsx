'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../../lib/api';
import { useTranslations } from 'next-intl';
import { useRef, useLayoutEffect, useState } from 'react';

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
  /** Portal title, e.g. "herobm" */
  title: string;
  /** Subtitle shown below the title, e.g. "Business Management" */
  subtitle: string;
  /** Navigation sections with grouped items */
  sections: NavSection[];
  /** Optional footer text, e.g. "Phase 3 • herobm" */
  footer?: string;
}

export default function Sidebar({ title, subtitle, sections, footer }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('common.auth');
  const [collapsed, setCollapsed] = useState<Record<number, boolean>>({});

  return (
    <aside
      className="w-60 h-full flex flex-col print:hidden"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center w-7 h-7 rounded border-2 border-[var(--accent)] text-[var(--accent)] font-extrabold text-lg" style={{ fontFamily: 'Manrope, sans-serif' }}>
            H
          </div>
          <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
            {title}
          </h1>
        </Link>
        <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      </div>
      <nav className="flex-1 px-3 mt-2 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            {section.label && (
              <div 
                className="flex items-center justify-between px-3 mb-1 cursor-pointer group"
                onClick={() => setCollapsed(prev => ({ ...prev, [si]: !prev[si] }))}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider transition-colors group-hover:text-[var(--text-primary)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  {section.label}
                </p>
                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-50 transition-opacity" style={{ color: 'var(--text-muted)' }}>
                  {/* eslint-disable-next-line no-restricted-syntax */}
                  {collapsed[si] ? 'expand_more' : 'expand_less'}
                </span>
              </div>
            )}
            {!collapsed[si] && section.items.map((item) => {
              const allItems = sections.flatMap((s) => s.items);
              const isActive =
                item.href === '/'
                  ? pathname === '/'
                  : item.subItems
                    ? item.subItems.some(
                        (sub) =>
                          pathname === sub.href ||
                          pathname.startsWith(sub.href + '/'),
                      )
                    : (pathname === item.href || pathname.startsWith(item.href + '/')) &&
                      !allItems.some(
                        (other) =>
                          other.href !== item.href &&
                          other.href.length > item.href.length &&
                          (pathname === other.href || pathname.startsWith(other.href + '/')),
                      );

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
                        {/* eslint-disable-next-line no-restricted-syntax */}
                        {isActive ? 'expand_less' : 'expand_more'}
                      </span>
                    )}
                  </Link>
                  
                  {item.subItems && isActive && (
                    <div className="ml-9 mt-1 mb-2 flex flex-col gap-0.5 border-l-2 pl-3 py-1" style={{ borderColor: 'var(--border)' }}>
                      {item.subItems.map(sub => {
                        const isSubActive =
                          sub.href === '/'
                            ? pathname === '/'
                            : (pathname === sub.href || pathname.startsWith(sub.href + '/')) &&
                              !item.subItems!.some(
                                (other) =>
                                  other.href !== sub.href &&
                                  other.href.length > sub.href.length &&
                                  (pathname === other.href || pathname.startsWith(other.href + '/'))
                              );
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
        {/* eslint-disable-next-line no-restricted-syntax */}
        <Link href="/" className="text-xs hover:opacity-80 transition-opacity" style={{ color: 'var(--text-muted)' }}>{footer || 'herobm'}</Link>
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
