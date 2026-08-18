'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../../lib/api';
import { Button } from './Button';
import { useTranslations } from 'next-intl';
import { useRef, useLayoutEffect, useEffect, useState } from 'react';
import { useAuth } from './AuthGate';
import UserPreferencesModal from './UserPreferencesModal';

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

export default function Sidebar({ title, subtitle, sections }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('common.auth');
  const { username, displayName } = useAuth();
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [isPrefsOpen, setIsPrefsOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const rawName = displayName?.trim() || username?.trim() || 'User';
  const firstName = rawName.split(/\s+/)[0];
  const initial = firstName.charAt(0).toUpperCase();

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen]);

  useLayoutEffect(() => {
    setExpanded(prev => {
      const next = { ...prev };
      let changed = false;
      
      sections.forEach((section, si) => {
        if (!section.label) return;
        const allItems = sections.flatMap((s) => s.items);
        const isSectionActive = section.items.some(item => {
          return item.href === '/'
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
        });
        
        if (isSectionActive && !next[si]) {
          next[si] = true;
          changed = true;
        }
      });
      
      return changed ? next : prev;
    });
  }, [pathname, sections]);

  return (
    <aside
      className="w-60 h-full flex flex-col print:hidden bg-[var(--bg-secondary)] border-r border-[var(--border)]"
    >
      <div className="px-5 py-5">
        <Link href="/" className="flex items-center gap-2 no-underline hover:opacity-80 transition-opacity">
          <div className="flex items-center justify-center w-7 h-7 rounded border-2 border-[var(--accent)] text-[var(--accent)] font-extrabold text-lg">
            H
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
            {title}
          </h1>
        </Link>
        <p className="text-[11px] mt-1 text-[var(--text-muted)]">
          {subtitle}
        </p>
      </div>
      <nav className="flex-1 px-3 mt-2 overflow-y-auto">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'mt-4' : ''}>
            {section.label && (
              <div 
                className="flex items-center justify-between px-3 mb-1 cursor-pointer group"
                onClick={() => setExpanded(prev => ({ ...prev, [si]: !prev[si] }))}
              >
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider transition-colors group-hover:text-[var(--text-primary)] text-[var(--text-muted)]"
                >
                  {section.label}
                </p>
                <span className="material-symbols-outlined text-[14px] opacity-0 group-hover:opacity-50 transition-opacity text-[var(--text-muted)]">
                  {/* eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
                  {!expanded[si] ? 'expand_more' : 'expand_less'}
                </span>
              </div>
            )}
            {(!section.label || expanded[si]) && section.items.map((item) => {
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 relative ${
                      isActive
                        ? 'bg-[var(--accent-glow)] text-[var(--accent)] font-semibold'
                        : 'bg-transparent text-[var(--text-secondary)] font-normal'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-[18px] ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}>{item.icon}</span>
                    <span className="flex-1">{item.label}</span>
                    {item.subItems && (
                      <span className="material-symbols-outlined text-[16px] opacity-70">
                        {/* eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., Material UI Icon). */}
                        {isActive ? 'expand_less' : 'expand_more'}
                      </span>
                    )}
                  </Link>
                  
                  {item.subItems && isActive && (
                    <div className="ml-9 mt-1 mb-2 flex flex-col gap-0.5 border-l-2 pl-3 py-1 border-[var(--border)]">
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
                            className={`text-xs py-1.5 px-3 rounded-md transition-colors ${
                              isSubActive
                                ? 'bg-[var(--bg-secondary-hover)] text-[var(--text-primary)] font-semibold'
                                : 'bg-transparent text-[var(--text-muted)] font-normal'
                            }`}
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
      <div className="px-3 py-2.5 border-t border-[var(--border)] relative">
        {/* User Menu Popover */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            className="absolute bottom-full left-3 right-3 mb-1.5 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl p-1.5 z-50 flex flex-col gap-0.5 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <Button
              variant="secondary"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setIsPrefsOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer !border-0 text-left justify-start"
            >

              <span className="material-symbols-outlined text-[18px] text-[var(--text-muted)]">
                tune
              </span>
              <span>{t('settings')}</span>
            </Button>
            <div className="h-[1px] bg-[var(--border)] my-0.5" />
            <Button
              variant="secondary"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-lg text-[var(--danger)] hover:bg-[rgba(239,68,68,0.1)] transition-colors cursor-pointer !border-0 text-left justify-start"
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined text-[18px] text-[var(--danger)]">
                logout
              </span>
              <span>{t('signOut')}</span>
            </Button>
          </div>
        )}

        {/* User Button */}
        <Button
          ref={triggerRef}
          variant="ghost"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left transition-colors bg-transparent hover:bg-[var(--bg-secondary-hover)] cursor-pointer !border-0 justify-start shadow-none group"
        >
          <div className="w-6 h-6 rounded-full bg-[var(--bg-card)] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] font-medium text-[11px] flex items-center justify-center shrink-0 border border-[var(--border)] transition-colors">
            {initial}
          </div>
          <span className="text-xs font-medium text-[var(--text-muted)] group-hover:text-[var(--text-primary)] truncate flex-1 transition-colors">
            {firstName}
          </span>

          <span
            className={`material-symbols-outlined text-[16px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-all duration-150 ${
              isMenuOpen ? 'rotate-180 text-[var(--text-primary)]' : ''
            }`}
          >
            unfold_more
          </span>
        </Button>
      </div>
      <UserPreferencesModal
        isOpen={isPrefsOpen}
        onClose={() => setIsPrefsOpen(false)}
      />
    </aside>
  );
}
