import React, { useState } from 'react';
import { Button } from './Button';

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
        className="flex flex-col gap-1 items-start lg:items-end self-center w-full lg:w-auto relative"
        onMouseLeave={() => setHoveredSubId(null)}
    >
        {/* Top Row: Sub-pages & Direct anchors */}
        <div 
            className="flex items-center gap-1 lg:gap-0.5 px-2 lg:px-1.5 rounded-md overflow-x-auto transition-all w-full h-[40px] lg:h-[32px] border border-[var(--accent)] hide-scrollbar"
        >
            {visibleSections.map((section) => {
              const isSub = section.isSubPage;
              const isActive = section.isActive;
              
              return (
                  <Button
                      key={section.id}
                      className={`text-[13px] lg:text-[11px] px-3 py-1.5 lg:px-1.5 lg:py-0.5 rounded transition-all whitespace-nowrap bg-transparent border-0 cursor-pointer hover:text-[var(--accent)] hover:bg-[rgba(0,107,92,0.08)] ${isSub ? 'font-bold' : ''} ${isActive && isSub ? 'bg-[rgba(0,107,92,0.1)] text-[var(--accent)]' : 'text-[var(--text-muted)]'}`}
                      onMouseEnter={() => { 
                          if (isSub) setHoveredSubId(section.id);
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
                  </Button>
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
                    className="flex items-center gap-1 lg:gap-0.5 px-2 lg:px-1.5 rounded-md overflow-x-auto transition-all min-h-[32px] lg:min-h-[24px] w-full lg:w-max lg:max-w-none lg:absolute lg:top-[100%] lg:left-0 lg:mt-1 lg:z-50 hide-scrollbar"
                >
                    {visibleSubtargets.map((sub) => (
                        <Button
                          key={sub.id}
                          className="text-[13px] lg:text-[11px] px-3 py-1.5 lg:px-1.5 lg:py-0.5 rounded transition-colors whitespace-nowrap bg-transparent border-0 cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[rgba(0,107,92,0.08)]"
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
                        </Button>
                    ))}
                </div>
            );
        })()}
    </div>
  );
}
