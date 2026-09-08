'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { OpportunityResponseDto } from '@herobm/sdk';
import { OpportunityKanbanCard } from './OpportunityKanbanCard';
import { useSettings } from '@/components/SettingsProvider';
import { Button } from '@/components/shared/Button';

interface StageConfig {
  value: string;
  label?: string;
}

interface OpportunityKanbanBoardProps {
  opportunities: OpportunityResponseDto[];
  stages: StageConfig[];
  onMoveStage: (opportunityId: string, newStage: string) => void;
  loading?: boolean;
}

export function OpportunityKanbanBoard({
  opportunities,
  stages,
  onMoveStage,
  loading = false,
}: OpportunityKanbanBoardProps) {
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, stageValue: string) => {
    e.preventDefault();
    if (dragOverColumn !== stageValue) {
      setDragOverColumn(stageValue);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, stageValue: string) => {
    if (dragOverColumn === stageValue) {
      setDragOverColumn(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, stageValue: string) => {
    e.preventDefault();
    setDragOverColumn(null);
    const opportunityId = e.dataTransfer.getData('text/plain');
    if (opportunityId) {
      onMoveStage(opportunityId, stageValue);
    }
  };

  // Group opportunities by status/stage
  const grouped = React.useMemo(() => {
    const map = new Map<string, OpportunityResponseDto[]>();
    for (const stage of stages) {
      map.set(stage.value.toLowerCase(), []);
    }

    for (const opp of opportunities) {
      const stageKey = (opp.status || '').toLowerCase();
      if (!map.has(stageKey)) {
        map.set(stageKey, []);
      }
      map.get(stageKey)!.push(opp);
    }

    return map;
  }, [opportunities, stages]);

  const { baseCurrency } = useSettings();

  const formatStageTotal = (items: OpportunityResponseDto[]) => {
    const total = items.reduce((sum, item) => sum + (Number(item.estimatedValue) || 0), 0);
    if (total === 0) return null;
    const curr = items[0]?.currencyCode || baseCurrency;
    if (!curr) return total.toLocaleString();
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: 0,
    }).format(total);
  };

  if (stages.length === 0) {
    return (
      <div className="h-full min-h-[450px] flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-subtle)]">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center mb-4">
          <span className="material-symbols-outlined text-[28px]">view_kanban</span>
        </div>
        <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">
          No Opportunity Stages Configured
        </h3>
        <p className="text-xs text-[var(--text-muted)] max-w-md mb-6 leading-relaxed">
          The Kanban pipeline requires opportunity stages to group and track your deals. Please configure stages in CRM Settings to enable this view.
        </p>
        <Button asChild variant="primary" size="sm">
          <Link href="/admin/settings/crm">
            Configure CRM Settings
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex gap-4 overflow-x-auto pb-2 pt-1 items-stretch min-h-[450px]">
      {stages.map((stage) => {
        const stageKey = stage.value.toLowerCase();
        const items = grouped.get(stageKey) || [];
        const isOver = dragOverColumn === stage.value;
        const totalFormatted = formatStageTotal(items);

        return (
          <div
            key={stage.value}
            data-stage={stage.value}
            onDragOver={(e) => handleDragOver(e, stage.value)}
            onDragLeave={(e) => handleDragLeave(e, stage.value)}
            onDrop={(e) => handleDrop(e, stage.value)}
            className={`flex flex-col flex-1 min-w-[280px] max-w-[340px] h-full rounded-xl border transition-colors ${
              isOver
                ? 'border-[var(--accent)] bg-[var(--accent-subtle)]'
                : 'border-[var(--border)] bg-[var(--surface-subtle)]'
            }`}
          >
            {/* Column Header */}
            <div className="p-3.5 border-b border-[var(--border)] flex flex-col gap-1 bg-[var(--surface)] rounded-t-xl">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[var(--text-primary)]">
                  {stage.label || stage.value}
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--surface-muted)] text-[var(--text-secondary)]">
                  {items.length}
                </span>
              </div>
              {totalFormatted && (
                <div className="text-xs font-medium text-[var(--text-muted)]">
                  {totalFormatted}
                </div>
              )}
            </div>

            {/* Cards Container */}
            <div className="flex-1 min-h-0 p-2.5 flex flex-col gap-2.5 overflow-y-auto">
              {items.map((opp) => (
                <OpportunityKanbanCard
                  key={opp.opportunityId}
                  opportunity={opp}
                  stages={stages}
                  onMoveStage={onMoveStage}
                />
              ))}

              {items.length === 0 && (
                <div className="flex-1 min-h-[120px] flex items-center justify-center border-2 border-dashed border-[var(--border)] rounded-lg text-xs text-[var(--text-muted)]">
                  Drop deals here
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
