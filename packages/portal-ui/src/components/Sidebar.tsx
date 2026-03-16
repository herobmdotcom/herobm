'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface SidebarProps {
  /** Portal title, e.g. "Sales Portal" */
  title: string;
  /** Subtitle shown below the title, e.g. "Order Management" */
  subtitle: string;
  /** Navigation items */
  navItems: NavItem[];
}

export default function Sidebar({ title, subtitle, navItems }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="w-60 h-screen fixed left-0 top-0 flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      <div className="px-5 py-5">
        <h1 className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
          💼 {title}
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </p>
      </div>
      <nav className="flex-1 px-3 mt-2">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all duration-150"
              style={{
                background: isActive ? 'var(--accent-glow)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Phase 3 • modbm</p>
      </div>
    </aside>
  );
}
