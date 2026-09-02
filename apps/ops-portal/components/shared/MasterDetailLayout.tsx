import React, { ReactNode, useState, useEffect } from 'react';
import SlideOver from './SlideOver';

interface MasterDetailLayoutProps {
    /** Title element, usually `t('title')` */
    title: ReactNode;
    /** Any controls like select inputs, rendered in the header */
    controls?: ReactNode;
    /** The content for the left pane (Master list) */
    masterPane: ReactNode;
    /** The content for the right pane / slideover (Detail view) */
    detailPane: ReactNode;
    /** Whether the detail slideover is currently open */
    isDetailOpen: boolean;
    /** Callback to close the detail slideover */
    onCloseDetail: () => void;
    /** Title for the slideover header */
    detailTitle?: string;
    /** Tailwind classes for the master pane width on desktop (default: 'lg:w-1/3') */
    masterWidthClass?: string;
}

export default function MasterDetailLayout({
    title,
    controls,
    masterPane,
    detailPane,
    isDetailOpen,
    onCloseDetail,
    detailTitle = 'Details',
    masterWidthClass = 'lg:w-1/3'
}: MasterDetailLayoutProps) {
    const [isDesktop, setIsDesktop] = useState(true);

    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    return (
        <div className="h-full flex flex-col p-4 lg:p-6 bg-[var(--bg-primary)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 shrink-0 gap-3">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
                        {title}
                    </h1>
                </div>

                {controls && (
                    <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto">
                        {controls}
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 flex gap-6">
                {/* Left Pane: Master List */}
                <div className={`w-full ${masterWidthClass} flex flex-col lg:bg-[var(--bg-card)] lg:border lg:border-[var(--border)] lg:rounded-xl lg: overflow-hidden`}>
                    {masterPane}
                </div>

                {/* Right Pane: Detail (Desktop) */}
                <div className="hidden lg:flex flex-1 flex-col bg-[var(--bg-card)] border border-[var(--border)] lg:rounded-xl overflow-hidden">
                    {detailPane}
                </div>

                {/* SlideOver: Detail (Mobile) */}
                {!isDesktop && (
                    <SlideOver
                        isOpen={isDetailOpen}
                        onClose={onCloseDetail}
                        title={detailTitle}
                    >
                        {detailPane}
                    </SlideOver>
                )}
            </div>
        </div>
    );
}
