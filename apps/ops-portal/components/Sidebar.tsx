'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/inventory', label: 'Inventory', icon: '📦' },
  { href: '/bins', label: 'Bin Contents', icon: '🗄️' },
  { href: '/products', label: 'Products', icon: '🏷️' },
  { href: '/accounts', label: 'Accounts', icon: '🏢' },
  { href: '/sales-orders', label: 'Orders', icon: '📋' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 h-screen fixed left-0 top-0 flex flex-col"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}>
      <div className="px-5 py-5">
        <h1 className="text-lg font-bold" style={{ color: 'var(--accent)' }}>
          ⚙️ Operations
        </h1>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Inventory Browser
        </p>
      </div>
      <nav className="flex-1 px-3 mt-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-sm transition-all duration-150"
              style={{
                background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
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
    </aside>
  );
}
