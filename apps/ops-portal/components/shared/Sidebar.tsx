'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../../lib/api';
import { Button } from './Button';
import { useTranslations } from 'next-intl';
import { useRef, useLayoutEffect, useEffect, useState } from 'react';
import { useAuth } from './AuthGate';
import UserPreferencesModal from './UserPreferencesModal';
import { useHelp } from '@/components/help/HelpContext';

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

const HELP_SYMBOL = '?';

export default function Sidebar({ title, subtitle, sections }: SidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('common.auth');
  const tHelp = useTranslations('help');
  const { toggleHelp, contextTopic } = useHelp();
  const { username, displayName } = useAuth();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
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
    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;

      sections.forEach((section, si) => {
        if (!section.label) return;
        const sectionKey = section.label || `unlabeled-${si}`;
        const allItems = sections.flatMap((s) => s.items);
        const isSectionActive = section.items.some((item) => {
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

        if (isSectionActive && !next[sectionKey]) {
          next[sectionKey] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [pathname, sections]);

  return (
    <aside
      className="w-60 h-full flex flex-col print:hidden bg-[var(--bg-primary)] text-[var(--text-primary)] border-r border-[var(--border)] select-none"
    >
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-[var(--border)] bg-[var(--bg-primary)]">
        <Link href="/" className="flex items-center gap-2.5 no-underline hover:opacity-85 transition-opacity">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[var(--accent)] text-white font-extrabold text-sm shadow-xs">
            H
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-[var(--text-primary)] leading-tight">
              {title}
            </h1>
            <p className="text-[10px] text-[var(--text-muted)] tracking-normal font-medium">
              {subtitle}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-3 bg-[var(--bg-primary)]">
        {sections.map((section, si) => {
          const sectionKey = section.label || `unlabeled-${si}`;
          const isExpanded = !section.label || expanded[sectionKey];
          const sectionExpandIcon = expanded[sectionKey] ? 'expand_less' : 'expand_more';
          return (
            <div key={sectionKey} className="space-y-0.5">
              {section.label && (
                <div
                  className="flex items-center justify-between px-2.5 py-1 cursor-pointer group"
                  onClick={() => setExpanded((prev) => ({ ...prev, [sectionKey]: !prev[sectionKey] }))}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
                    {section.label}
                  </p>
                  <span className="material-symbols-outlined text-[14px] text-[var(--text-muted)] group-hover:text-[var(--text-secondary)] transition-colors">
                    {sectionExpandIcon}
                  </span>
                </div>
              )}
              {isExpanded &&
                section.items.map((item) => {
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
                  const itemExpandIcon = isActive ? 'expand_less' : 'expand_more';

                  return (
                    <div key={item.href} className="mb-0.5">
                      <Link
                        href={item.href}
                        scroll={false}
                        className={`flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-all duration-150 relative no-underline ${
                          isActive
                            ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-semibold'
                            : 'bg-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] font-normal'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[17px] ${
                            isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                          }`}
                        >
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.subItems && (
                          <span className="material-symbols-outlined text-[15px] opacity-70">
                            {itemExpandIcon}
                          </span>
                        )}
                      </Link>

                      {item.subItems && isActive && (
                        <div className="ml-5 mt-1 mb-1.5 flex flex-col gap-0.5 border-l border-[var(--border)] pl-2.5 py-0.5">
                          {item.subItems.map((sub) => {
                            const isSubActive =
                              sub.href === '/'
                                ? pathname === '/'
                                : (pathname === sub.href || pathname.startsWith(sub.href + '/')) &&
                                  !item.subItems!.some(
                                    (other) =>
                                      other.href !== sub.href &&
                                      other.href.length > sub.href.length &&
                                      (pathname === other.href || pathname.startsWith(other.href + '/')),
                                  );
                            return (
                              <Link
                                key={sub.href}
                                href={sub.href}
                                scroll={false}
                                className={`text-[11px] py-1 px-2 rounded-md transition-colors no-underline truncate ${
                                  isSubActive
                                    ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-semibold'
                                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)]'
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
          );
        })}
      </nav>

      {/* Footer: User Button & Help Button */}
      <div className="px-3 py-3 border-t border-[var(--border)] flex items-center gap-2 bg-[var(--bg-primary)] relative">
        {/* User Menu Popover */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            className="absolute bottom-full left-3 right-3 mb-2 bg-[var(--bg-card)] border border-[var(--border)] rounded-xl shadow-xl p-1.5 z-50 flex flex-col gap-1 text-[var(--text-primary)] animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <Button
              variant="secondary"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setIsPrefsOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer !border-0 text-left justify-start shadow-none"
            >
              <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)]">
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
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors cursor-pointer !border-0 text-left justify-start shadow-none"
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined text-[16px] text-[var(--danger)]">
                logout
              </span>
              <span>{t('signOut')}</span>
            </Button>
          </div>
        )}

        {/* User Button (Left, h-10, Transparent BG, Unbolded Name) */}
        <Button
          ref={triggerRef}
          variant="ghost"
          size="sm"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          aria-expanded={isMenuOpen}
          aria-haspopup="menu"
          aria-label={rawName}
          title={rawName}
          className={`h-10 flex-1 flex items-center gap-2 px-2 rounded-lg bg-transparent border border-[var(--border)] text-left overflow-hidden cursor-pointer shadow-none justify-start transition-all !p-1.5 ${
            isMenuOpen
              ? 'border-[var(--accent)] bg-[var(--accent)]/10 ring-2 ring-[var(--accent)]/20'
              : 'hover:border-[var(--border)] hover:bg-[var(--bg-card-hover)]'
          }`}
        >
          <div className="w-6 h-6 rounded-md bg-[var(--accent)]/15 text-[var(--accent)] font-bold text-xs flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-normal text-[var(--text-primary)] truncate">
              {rawName}
            </p>
          </div>
          <span className="material-symbols-outlined text-[15px] text-[var(--text-muted)] shrink-0">
            unfold_more
          </span>
        </Button>

        {/* Help Button (Right, h-10 w-10, Transparent BG) */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleHelp}
          aria-label={tHelp('title')}
          title={contextTopic ? `${tHelp('manual')}: ${contextTopic.title}` : tHelp('manual')}
          className="h-10 w-10 rounded-lg bg-transparent hover:bg-[var(--bg-card-hover)] text-[var(--accent)] hover:text-[var(--accent-hover)] border border-[var(--border)] hover:border-[var(--accent)] flex items-center justify-center shrink-0 cursor-pointer shadow-none !p-0 font-bold text-xs transition-all"
        >
          {HELP_SYMBOL}
        </Button>
      </div>

      <UserPreferencesModal
        isOpen={isPrefsOpen}
        onClose={() => setIsPrefsOpen(false)}
      />
    </aside>
  );
}
