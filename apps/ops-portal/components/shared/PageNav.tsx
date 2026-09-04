import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const visibleSections = sections.filter(s => s.show !== false);

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimer();
    };
  }, [clearTimer]);

  const scheduleReset = useCallback((delay = 200) => {
    clearTimer();
    timeoutRef.current = setTimeout(() => {
      setHoveredSubId(null);
    }, delay);
  }, [clearTimer]);

  const handleSectionMouseEnter = useCallback((section: PageSection) => {
    clearTimer();
    if (section.isSubPage) {
      if (section.subtargets && section.subtargets.length > 0) {
        setHoveredSubId(section.id);
      } else {
        // Section has no subtargets: do not immediately wipe out an active subtarget menu
        // in case the user is traversing diagonally towards the second level.
        scheduleReset(200);
      }
    }
  }, [clearTimer, scheduleReset]);

  if (visibleSections.length === 0) return null;

  return (
    <div
      className="flex flex-col gap-1 items-start lg:items-end self-center w-full lg:w-auto relative"
      onMouseEnter={clearTimer}
      onMouseLeave={() => scheduleReset(200)}
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
              onMouseEnter={() => handleSectionMouseEnter(section)}
              onClick={() => {
                clearTimer();
                setHoveredSubId(null);
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
            className="flex items-center gap-1 lg:gap-0.5 px-2 lg:px-1.5 rounded-md overflow-x-auto transition-all min-h-[32px] lg:min-h-[24px] w-full lg:w-max lg:min-w-full lg:max-w-none lg:absolute lg:top-full lg:left-0 lg:pt-1 lg:z-50 hide-scrollbar before:absolute before:-top-2 before:left-0 before:right-0 before:h-2 before:content-['']"
            onMouseEnter={clearTimer}
            onMouseLeave={() => scheduleReset(200)}
          >
            {visibleSubtargets.map((sub) => (
              <Button
                key={sub.id}
                className="text-[13px] lg:text-[11px] px-3 py-1.5 lg:px-1.5 lg:py-0.5 rounded transition-colors whitespace-nowrap bg-transparent border-0 cursor-pointer text-[var(--text-muted)] hover:text-[var(--accent)] hover:bg-[rgba(0,107,92,0.08)]"
                onClick={() => {
                  clearTimer();
                  setHoveredSubId(null);
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
