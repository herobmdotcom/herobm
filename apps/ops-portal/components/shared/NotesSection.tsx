'use client';

import React, { useState } from 'react';
import { Button } from '@/components/shared/Button';

export interface NoteAuthor {
  userId?: string;
  displayName?: string | null;
  username?: string | null;
  email?: string | null;
}

export interface NoteItem {
  noteId: string;
  content: string;
  createdOn: string;
  createdById?: string | null;
  createdBy?: NoteAuthor | Record<string, unknown> | string | null;
}

export interface NotesSectionProps {
  id?: string;
  title?: string;
  icon?: string;
  placeholder?: string;
  notes?: NoteItem[];
  onAddNote: (content: string) => Promise<void> | void;
  onDeleteNote?: (noteId: string) => Promise<void> | void;
  isEditable?: boolean;
  addButtonLabel?: string;
  savingLabel?: string;
  className?: string;
}

export default function NotesSection({
  id = 'notes-section',
  title = 'Notes',
  icon = 'edit_note',
  placeholder = 'Type a note...',
  notes = [],
  onAddNote,
  onDeleteNote,
  isEditable = true,
  addButtonLabel = 'Add Note',
  savingLabel = 'Saving...',
  className = '',
}: NotesSectionProps) {
  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAdd = async () => {
    if (!content.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onAddNote(content);
      setContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAuthorName = (note: NoteItem): string => {
    if (note.createdBy) {
      if (typeof note.createdBy === 'object') {
        const cb = note.createdBy as Record<string, unknown>;
        if (typeof cb.displayName === 'string' && cb.displayName) return cb.displayName;
        if (typeof cb.username === 'string' && cb.username) return cb.username;
      } else if (typeof note.createdBy === 'string') {
        return note.createdBy;
      }
    }
    return note.createdById || '—';
  };

  return (
    <div id={id} className={`card flex flex-col gap-4 ${className}`}>
      <h3 className="section-heading mb-0">
        <span className="material-symbols-outlined">{icon}</span>
        {title}
      </h3>
      {isEditable && (
        <>
          <textarea
            className="input w-full min-h-[100px]"
            rows={3}
            placeholder={placeholder}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={isSubmitting || !content.trim()}
            >
              {isSubmitting ? savingLabel : addButtonLabel}
            </Button>
          </div>
        </>
      )}

      {notes && notes.length > 0 && (
        <div className="flex flex-col gap-2">
          {notes.map((n) => (
            <div
              key={n.noteId}
              className="p-4 flex flex-col gap-1 border border-[var(--border)] bg-[var(--surface)] rounded-xl shadow-none"
            >
              <div className="text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                {n.content}
              </div>
              <div className="text-xs text-[var(--text-muted)] flex justify-between items-center mt-2 pt-2 border-t border-[var(--border)]">
                <span>By: {getAuthorName(n)}</span>
                <div className="flex items-center gap-3">
                  <span>{new Date(n.createdOn).toLocaleString()}</span>
                  {isEditable && onDeleteNote && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      className="text-xs text-[var(--text-muted)] hover:text-red-500 cursor-pointer p-0 h-auto"
                      onClick={() => onDeleteNote(n.noteId)}
                      title="Delete note"
                    >
                      <span className="material-symbols-outlined text-[15px]">delete</span>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
