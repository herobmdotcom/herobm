'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';
import type { StocktakeItem } from '../types';

interface StocktakeStickyFooterProps {
  selectedItem: StocktakeItem | null;
  isBlindCount?: boolean;
  onUpdateCount: (itemId: string, newCount: number | null) => void;
  onIncrement: (itemId: string, delta: number) => void;
  onUpdateNotes: (itemId: string, notes: string) => void;
}

export default function StocktakeStickyFooter({
  selectedItem,
  onUpdateCount,
  onIncrement,
  onUpdateNotes,
}: StocktakeStickyFooterProps) {
  const t = useTranslations('stocktake');
  const tCommon = useTranslations('common');
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(selectedItem?.notes || '');

  useEffect(() => {
    setNoteValue(selectedItem?.notes || '');
    setIsEditingNote(false);
  }, [selectedItem?.id, selectedItem?.notes]);

  if (!selectedItem) {
    return null;
  }

  const isCounted = selectedItem.countedQuantity !== null;
  const counted = selectedItem.countedQuantity ?? 0;

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateNotes(selectedItem.id, noteValue.trim());
    setIsEditingNote(false);
  };

  return (
    <div className="sticky bottom-0 z-20 mt-auto pt-2 pointer-events-none">
      <div className={`max-w-7xl mx-auto w-full flex ${isEditingNote ? 'justify-stretch' : 'justify-end'}`}>
        {isEditingNote ? (
          /* Full-width Note Editor (hides other buttons) */
          <div className="card pointer-events-auto border-[var(--accent)]/40 bg-[var(--bg-card)]/95 backdrop-blur-md shadow-2xl p-4 rounded-2xl w-full flex flex-col gap-3">
            <div className="flex items-center gap-2 border-b border-[var(--border)] pb-2 min-w-0">
              <span className="font-mono font-bold text-sm text-[var(--accent)]">
                {selectedItem.productNumber}
              </span>
              <span className="text-xs text-[var(--text-secondary)] truncate">
                {selectedItem.productName}
              </span>
            </div>

            <form
              id={`footer-note-form-${selectedItem.id}`}
              onSubmit={handleNoteSubmit}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full"
            >
              <input
                type="text"
                value={noteValue}
                onChange={(e) => setNoteValue(e.target.value)}
                placeholder={t('notesPlaceholder')}
                className="flex-1 input h-12 text-sm px-4"
                autoFocus
              />
              <div className="flex items-center gap-2 shrink-0 justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsEditingNote(false)}
                  className="h-12 px-5 text-sm font-semibold"
                >
                  {tCommon('cancel')}
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="h-12 px-6 text-sm font-bold"
                >
                  {t('saveNote')}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          /* 50% Bigger Action Buttons with 2x2 Grid */
          <div className="card pointer-events-auto border-[var(--accent)]/30 bg-[var(--bg-card)]/95 backdrop-blur-md shadow-2xl p-3 sm:p-4 rounded-2xl flex items-center gap-2.5 sm:gap-3">
            {/* Secondary Utilities Column (Notes & Clear) */}
            <div className="flex flex-col gap-2.5 sm:gap-3 shrink-0">
              {/* Notes button (Icon only, 50% bigger) */}
              <Button
                type="button"
                variant={selectedItem.notes ? 'primary' : 'secondary'}
                icon="sticky_note_2"
                iconClassName="text-[28px] sm:text-[32px]"
                onClick={() => setIsEditingNote(true)}
                aria-label="Add or edit item notes"
                title={selectedItem.notes ? selectedItem.notes : t('itemNotesTooltip')}
                className="w-16 h-16 sm:w-20 sm:h-20 p-0 flex items-center justify-center rounded-2xl"
              />

              {/* Clear button (X icon, same size as Note) */}
              <Button
                type="button"
                variant="secondary"
                icon="close"
                iconClassName="text-[28px] sm:text-[32px]"
                disabled={!isCounted}
                onClick={() => onUpdateCount(selectedItem.id, null)}
                aria-label="Clear count"
                title={t('resetCountTooltip')}
                className="w-16 h-16 sm:w-20 sm:h-20 p-0 flex items-center justify-center rounded-2xl"
              />
            </div>

            {/* 2x2 Action Grid for Right-Thumb Ergonomics (50% bigger) */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              {/* Top-Left: +5 */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => onIncrement(selectedItem.id, 5)}
                aria-label="Add 5 to count"
                className="w-24 h-16 sm:w-30 sm:h-20 font-black text-xl sm:text-2xl rounded-2xl"
              >
                +5
              </Button>

              {/* Top-Right: +10 */}
              <Button
                type="button"
                variant="secondary"
                onClick={() => onIncrement(selectedItem.id, 10)}
                aria-label="Add 10 to count"
                className="w-24 h-16 sm:w-30 sm:h-20 font-black text-xl sm:text-2xl rounded-2xl"
              >
                +10
              </Button>

              {/* Bottom-Left: 0 and -1 split pair */}
              <div className="w-24 h-16 sm:w-30 sm:h-20 flex gap-1.5 sm:gap-2">
                <Button
                  type="button"
                  variant="danger"
                  onClick={() => onUpdateCount(selectedItem.id, 0)}
                  aria-label="Set count to 0"
                  title={t('setZeroTooltip')}
                  className="flex-1 h-full font-black text-lg sm:text-xl rounded-xl sm:rounded-2xl p-0 flex items-center justify-center"
                >
                  0
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!isCounted || counted <= 0}
                  onClick={() => onIncrement(selectedItem.id, -1)}
                  aria-label="Subtract 1 from count"
                  className="flex-1 h-full font-black text-lg sm:text-xl rounded-xl sm:rounded-2xl p-0 flex items-center justify-center"
                >
                  -1
                </Button>
              </div>

              {/* Bottom-Right: +1 (Primary) */}
              <Button
                type="button"
                variant="primary"
                onClick={() => onIncrement(selectedItem.id, 1)}
                aria-label="Add 1 to count"
                className="w-24 h-16 sm:w-30 sm:h-20 font-black text-2xl sm:text-3xl rounded-2xl shadow-md"
              >
                +1
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
