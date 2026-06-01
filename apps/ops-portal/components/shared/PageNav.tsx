import React, { useState } from 'react';

export interface PageSection {
  id: string;
  label: string;
  show?: boolean;
  isSubPage?: boolean;
  isActive?: boolean;
  onClick?: () => void;
  subtargets?: PageSection[];
}

interface PageNavProps {
  sections: PageSection[];
}

export default function PageNav({ sections }: PageNavProps) {
  const [hoveredSubId, setHoveredSubId] = useState<string | null>(null);
  const visibleSections = sections.filter(s => s.show !== false);
  
  if (visibleSections.length === 0) return null;
  
  return (
    <div
        className="flex flex-col gap-1 items-start [@media(any-pointer:fine)]:lg:items-end self-center w-full [@media(any-pointer:fine)]:lg:w-auto relative"
        onMouseLeave={() => setHoveredSubId(null)}
    >
        {/* Top Row: Sub-pages & Direct anchors */}
        <div 
            className="flex items-center gap-1 [@media(any-pointer:fine)]:lg:gap-0.5 px-2 [@media(any-pointer:fine)]:lg:px-1.5 rounded-md overflow-x-auto transition-all w-full h-[40px] [@media(any-pointer:fine)]:lg:h-[32px]"
            style={{ border: '1px solid var(--accent)', msOverflowStyle: 'none', scrollbarWidth: 'none' }}
        >
            {visibleSections.map((section) => {
              const isSub = section.isSubPage;
              const isActive = section.isActive;
              
              return (
                  <button
                      key={section.id}
                      className={`text-[13px] [@media(any-pointer:fine)]:lg:text-[11px] px-3 py-1.5 [@media(any-pointer:fine)]:lg:px-1.5 [@media(any-pointer:fine)]:lg:py-0.5 rounded transition-all whitespace-nowrap ${isSub ? 'font-bold' : ''} ${isActive ? 'bg-[rgba(0,107,92,0.1)] text-[var(--accent)]' : ''}`}
                      style={{
                          background: isActive && isSub ? 'rgba(0,107,92,0.1)' : 'none',
                          border: 'none',
                          color: isActive && isSub ? 'var(--accent)' : 'var(--text-muted)',
                          cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => { 
                          e.currentTarget.style.color = 'var(--accent)'; 
                          e.currentTarget.style.background = 'rgba(0,107,92,0.08)'; 
                          if (isSub) setHoveredSubId(section.id);
                      }}
                      onMouseLeave={(e) => { 
                          e.currentTarget.style.color = (isActive && isSub) ? 'var(--accent)' : 'var(--text-muted)'; 
                          e.currentTarget.style.background = (isActive && isSub) ? 'rgba(0,107,92,0.1)' : 'none'; 
                      }}
                      onClick={() => {
                          if (section.onClick) {
                              section.onClick();
                          } else if (!isSub) {
                              const el = document.getElementById(section.id);
                              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                          }
                      }}
                  >
                      {section.label}
                  </button>
              );
            })}
        </div>

        {/* Bottom Row: Hovered/Active Subtargets */}
        {(() => {
            const visibleSubtargets = visibleSections.flatMap(section => {
              const isSub = section.isSubPage;
              const isActive = section.isActive;

              const shouldShowSubtargets = isSub && section.subtargets && (
                  hoveredSubId === section.id || (hoveredSubId === null && isActive)
              );

              if (!shouldShowSubtargets) return [];
              return section.subtargets!.filter(s => s.show !== false);
            });

            if (visibleSubtargets.length === 0) return null;

            return (
                <div 
                    className="flex items-center gap-1 [@media(any-pointer:fine)]:lg:gap-0.5 px-2 [@media(any-pointer:fine)]:lg:px-1.5 rounded-md overflow-x-auto transition-all min-h-[32px] [@media(any-pointer:fine)]:lg:min-h-[24px] w-full [@media(any-pointer:fine)]:lg:w-max [@media(any-pointer:fine)]:lg:max-w-none [@media(any-pointer:fine)]:lg:absolute [@media(any-pointer:fine)]:lg:top-[100%] [@media(any-pointer:fine)]:lg:right-0 [@media(any-pointer:fine)]:lg:mt-1 [@media(any-pointer:fine)]:lg:z-50"
                    style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}
                >
                    {visibleSubtargets.map((sub) => (
                        <button
                          key={sub.id}
                          className="text-[13px] [@media(any-pointer:fine)]:lg:text-[11px] px-3 py-1.5 [@media(any-pointer:fine)]:lg:px-1.5 [@media(any-pointer:fine)]:lg:py-0.5 rounded transition-colors whitespace-nowrap"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; e.currentTarget.style.background = 'rgba(0,107,92,0.08)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                          onClick={() => {
                              if (sub.onClick) {
                                  sub.onClick();
                              } else {
                                  const el = document.getElementById(sub.id);
                                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }
                          }}
                        >
                          {sub.label}
                        </button>
                    ))}
                </div>
            );
        })()}
    </div>
  );
}
