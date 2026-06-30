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
        <div style={{ padding: '12px 16px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px' }}>
          <div className="text-xs mb-2 font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Metadata</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><span className="opacity-60">ID:</span> {event.outboxId}</div>
            <div><span className="opacity-60">Type:</span> {event.eventType}</div>
            <div><span className="opacity-60">Entity:</span> {event.entityType || event.aggregateType}:{event.entityId || event.aggregateId}</div>
            <div><span className="opacity-60">Created:</span> {new Date(event.createdOn).toLocaleString()}</div>
          </div>
        </div>

        <div className="flex flex-col gap-2 flex-1 min-h-0">
          <div className="text-xs font-semibold tracking-wider uppercase" style={{ color: 'var(--text-muted)' }}>Full Payload</div>
          <pre 
            style={{ 
              background: 'var(--bg-secondary)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px', 
              padding: '16px', 
              fontSize: '12px', 
              fontFamily: 'monospace', 
              overflowY: 'auto',
              color: 'var(--text-secondary)',
              flex: 1,
              margin: 0
            }}
          >
            {JSON.stringify(event.payload || event, null, 2)}
          </pre>
        </div>
      </div>
    </SlideOver>
  );
}
