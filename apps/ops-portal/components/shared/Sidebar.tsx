'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { logout } from '../../lib/api';
import { useTranslations } from 'next-intl';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
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
        <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Manrope, sans-serif' }}>
          {title}
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
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
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm transition-all duration-150"
                  style={{
                    background: isActive ? 'var(--accent-glow)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: isActive ? 600 : 400,
                  }}
                >
                  <span className="material-symbols-outlined text-[18px]" style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)' }}>{item.icon}</span>
                  {item.label}
                </Link>
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
