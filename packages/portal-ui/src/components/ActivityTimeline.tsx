'use client';

import React from 'react';

export interface TimelineEvent {
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
  actor: string;
  createdOn: string;
}

export function EventIcon({ type }: { type: string }) {
  const t = (type || '').toLowerCase();

  // Common emoji mappings
  if (t.includes('shipment')) return <span>🚚</span>;
  if (t.includes('picking')) return <span>📦</span>;
  if (t.includes('return')) return <span>↩️</span>;
  if (t.includes('auto_status')) return <span>⚡</span>;
  if (t.includes('price')) return <span>💰</span>;
  if (t.includes('stock') || t.includes('inventory')) return <span>🏢</span>;
  if (t.includes('invoice')) return <span>🧾</span>;
  if (t.includes('payment')) return <span>💳</span>;

  const icons: Record<string, string> = {
    created: '🆕',
    updated: '✏️',
    status_changed: '🔄',
    line_added: '➕',
    line_updated: '📝',
    line_removed: '🗑️',
    quoted: '📨',
    confirmed: '✅',
    cancelled: '❌',
    processed: '✅',
    shipped: '🚚',
    picked: '📦',
  };
  return <span>{icons[t] || '📌'}</span>;
}

export interface ActivityTimelineProps {
  events: TimelineEvent[];
  title?: string;
  emptyMessage?: string;
  defaultOpen?: boolean;
}

export default function ActivityTimeline({
  events,
  title = 'Activity Timeline',
  emptyMessage = 'No events recorded',
  defaultOpen = true,
}: ActivityTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="card">
        <h3
          className="text-sm font-semibold mb-4"
          style={{
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {title}
        </h3>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {emptyMessage}
        </p>
      </div>
    );
  }

  return (
    <details className="card" open={defaultOpen}>
      <summary
        className="text-sm font-semibold cursor-pointer select-none flex items-center gap-2"
        style={{
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          listStyle: 'none',
        }}
      >
        <span className="details-chevron" style={{ fontSize: 10, transition: 'transform 200ms' }}>▶</span>
        {title}
        <span style={{ fontSize: 11, fontWeight: 400 }}>({events.length})</span>
      </summary>
      <div className="space-y-3" style={{ marginTop: 16 }}>
        {[...events].reverse().map((event) => {
          const hasPayload = event.payload && Object.keys(event.payload).length > 0;
          return (
            <details
              key={event.eventId}
              className="text-sm"
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(30,58,95,0.3)',
              }}
            >
              <summary
                className="flex items-center gap-3"
                style={{ cursor: hasPayload ? 'pointer' : 'default', userSelect: 'none', listStyle: 'none' }}
              >
                <EventIcon type={event.eventType} />
                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                  {event.eventType.replace(/_/g, ' ')}
                </span>
                <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                  by {event.actor}
                </span>
                <span className="ml-auto text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {new Date(event.createdOn).toLocaleString()}
                </span>
                {hasPayload && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: 10 }}>▶</span>
                )}
              </summary>
              {hasPayload && (
                <div
                  className="mt-2 text-xs grid gap-y-1"
                  style={{ marginLeft: 28, color: 'var(--text-secondary)' }}
                >
                  {Object.entries(event.payload).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span style={{ color: 'var(--text-muted)', minWidth: 100, fontWeight: 500 }}>
                        {key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                      </span>
                      <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {typeof value === 'object' && value !== null
                          ? Object.entries(value as Record<string, unknown>)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(', ')
                          : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </details>
          );
        })}
      </div>
    </details>
  );
}
