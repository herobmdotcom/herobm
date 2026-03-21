'use client';

/**
 * Shell — main app layout with sidebar and content area.
 * Accepts a sidebar as a prop so each portal can configure its own navigation.
 */
export default function Shell({
  sidebar,
  children,
}: {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen overflow-hidden">
      {sidebar}
      <main className="ml-60 flex-1 flex flex-col pt-8 pb-8 pl-8 pr-4 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
