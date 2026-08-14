'use client';

import React from 'react';
import SlideOver from '@/components/shared/SlideOver';

export interface SlideOverEvent {
  outboxId: string;
  eventType: string;
  entityType?: string;
  aggregateType?: string;
  entityId?: string;
  aggregateId?: string;
  createdOn: string | number | Date;
  payload?: unknown;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  event: SlideOverEvent | null;
}

export default function EventPayloadSlideOver({ isOpen, onClose, event }: Props) {
  if (!event) return null;

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Event Message Payload">
      <div className="flex flex-col gap-4 h-full">
        <div className="px-4 py-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg">
          <div className="text-xs mb-2 font-semibold tracking-wider uppercase text-[var(--text-muted)]">Metadata</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="opacity-60">ID:</span> {event.outboxId}</div>
            <div><span className="opacity-60">Type:</span> {event.eventType}</div>
            <div><span className="opacity-60">Entity:</span> {event.entityType || event.aggregateType}:{event.entityId || event.aggregateId}</div>
            <div><span className="opacity-60">Created:</span> {new Date(event.createdOn).toLocaleString()}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="text-xs font-semibold tracking-wider uppercase text-[var(--text-muted)]">Full Payload</div>
          <pre 
            className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-4 text-xs font-mono overflow-y-auto text-[var(--text-secondary)] flex-1 m-0"
          >
            {JSON.stringify(event.payload || event, null, 2)}
          </pre>
        </div>
      </div>
    </SlideOver>
  );
}
