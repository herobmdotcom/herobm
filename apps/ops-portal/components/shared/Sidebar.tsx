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
    setExpanded((prev) => {
      const next = { ...prev };
      let changed = false;

      sections.forEach((section, si) => {
        if (!section.label) return;
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
      className="w-60 h-full flex flex-col print:hidden bg-[#F8FAFC] text-[#0F172A] border-r border-[#E2E8F0] select-none"
    >
      {/* Brand Header */}
      <div className="px-5 py-4 border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <Link href="/" className="flex items-center gap-2.5 no-underline hover:opacity-85 transition-opacity">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-[#006B5C] text-white font-extrabold text-sm shadow-xs">
            H
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-[#0F172A] leading-tight">
              {title}
            </h1>
            <p className="text-[10px] text-[#64748B] tracking-normal font-medium">
              {subtitle}
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation Groups */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-3 bg-[#F8FAFC]">
        {sections.map((section, si) => {
          const sectionExpandIcon = expanded[si] ? 'expand_less' : 'expand_more';
          return (
            <div key={si} className="space-y-0.5">
              {section.label && (
                <div
                  className="flex items-center justify-between px-2.5 py-1 cursor-pointer group"
                  onClick={() => setExpanded((prev) => ({ ...prev, [si]: !prev[si] }))}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] group-hover:text-[#475569] transition-colors">
                    {section.label}
                  </p>
                  <span className="material-symbols-outlined text-[14px] text-[#94A3B8] group-hover:text-[#475569] transition-colors">
                    {sectionExpandIcon}
                  </span>
                </div>
              )}
              {(!section.label || expanded[si]) &&
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
                            ? 'bg-[#006B5C]/10 text-[#006B5C] font-semibold'
                            : 'bg-transparent text-[#475569] hover:text-[#0F172A] hover:bg-[#E2E8F0]/70 font-normal'
                        }`}
                      >
                        <span
                          className={`material-symbols-outlined text-[17px] ${
                            isActive ? 'text-[#006B5C]' : 'text-[#64748B]'
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
                        <div className="ml-5 mt-1 mb-1.5 flex flex-col gap-0.5 border-l border-[#CBD5E1] pl-2.5 py-0.5">
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
                                    ? 'bg-[#006B5C]/15 text-[#006B5C] font-semibold'
                                    : 'text-[#64748B] hover:text-[#0F172A] hover:bg-[#E2E8F0]/70'
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
      <div className="px-3 py-3 border-t border-[#E2E8F0] flex items-center gap-2 bg-[#F8FAFC] relative">
        {/* User Menu Popover */}
        {isMenuOpen && (
          <div
            ref={menuRef}
            role="menu"
            aria-orientation="vertical"
            className="absolute bottom-full left-3 right-3 mb-2 bg-white border border-[#CBD5E1] rounded-xl shadow-xl p-1.5 z-50 flex flex-col gap-1 text-[#0F172A] animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            <Button
              variant="secondary"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                setIsPrefsOpen(true);
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[#334155] hover:text-[#0F172A] hover:bg-[#F1F5F9] transition-colors cursor-pointer !border-0 text-left justify-start shadow-none"
            >
              <span className="material-symbols-outlined text-[16px] text-[#64748B]">
                tune
              </span>
              <span>{t('settings')}</span>
            </Button>
            <div className="h-[1px] bg-[#E2E8F0] my-0.5" />
            <Button
              variant="secondary"
              role="menuitem"
              onClick={() => {
                setIsMenuOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium rounded-lg text-[#DC2626] hover:bg-[#DC2626]/10 transition-colors cursor-pointer !border-0 text-left justify-start shadow-none"
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
              <span className="material-symbols-outlined text-[16px] text-[#DC2626]">
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
          className={`h-10 flex-1 flex items-center gap-2 px-2 rounded-lg bg-transparent border border-[#CBD5E1] text-left overflow-hidden cursor-pointer shadow-none justify-start transition-all !p-1.5 ${
            isMenuOpen
              ? 'border-[#006B5C] bg-[#006B5C]/10 ring-2 ring-[#006B5C]/15'
              : 'hover:border-[#94A3B8] hover:bg-[#E2E8F0]/70'
          }`}
        >
          <div className="w-6 h-6 rounded-md bg-[#006B5C] text-white font-medium text-xs flex items-center justify-center shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-normal text-[#0F172A] truncate">
              {rawName}
            </p>
          </div>
          <span className="material-symbols-outlined text-[15px] text-[#94A3B8] shrink-0">
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
          className="h-10 w-10 rounded-lg bg-transparent hover:bg-[#E2E8F0]/70 text-[#006B5C] hover:text-[#005145] border border-[#CBD5E1] hover:border-[#006B5C] flex items-center justify-center shrink-0 cursor-pointer shadow-none !p-0 font-medium text-xs transition-all"
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
