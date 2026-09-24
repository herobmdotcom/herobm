/* eslint-disable @typescript-eslint/no-explicit-any -- Temporary workaround for ReactFlow typing complexity */
'use client';
import { reportError } from '@/lib/api';
import { toast } from 'react-hot-toast';
import { getErrorMessage, formatAmount } from '@herobm/shared';
import * as api from '@herobm/sdk';

import React, { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  Handle,
  Position,
  NodeProps,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Button } from '@/components/shared/Button';
import OrganizationSelect, { Organization } from '@/components/shared/OrganizationSelect';
import dagre from 'dagre';

interface LayerToggleProps {
  label: string;
  icon: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  activeColorClass?: string;
}

function LayerToggle({ label, icon, checked, onChange, activeColorClass = 'bg-[var(--accent)]' }: LayerToggleProps) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] select-none px-2.5 py-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] transition-all">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="sr-only"
      />
      <span
        className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors duration-200 ease-in-out ${
          checked ? activeColorClass : 'bg-gray-300 dark:bg-gray-600'
        }`}
      >
        <span
          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
            checked ? 'translate-x-3.5' : 'translate-x-0.5'
          }`}
        />
      </span>
      <span className="flex items-center gap-1 text-[var(--text-primary)] font-medium">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
    </label>
  );
}

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  const nodeWidth = 260;

  dagreGraph.setGraph({ rankdir: direction, nodesep: 100, ranksep: 120 });

  nodes.forEach((node) => {
    const nodeHeight = node.type === 'salesOrderGroup' ? 100 : 85;
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const nodeHeight = node.type === 'salesOrderGroup' ? 100 : 85;
    return {
      ...node,
      position: {
        x: (nodeWithPosition?.x ?? 0) - nodeWidth / 2,
        y: (nodeWithPosition?.y ?? 0) - nodeHeight / 2,
      },
    };
  });

  const layoutedEdges = edges.map((edge) => {
    const sourceNode = dagreGraph.node(edge.source);
    const targetNode = dagreGraph.node(edge.target);
    
    let sourceHandle = 'bottom-source';
    let targetHandle = 'top-target';

    if (sourceNode && targetNode) {
      const dx = targetNode.x - sourceNode.x;
      const dy = targetNode.y - sourceNode.y;

      if (Math.abs(dy) < 50) {
        // Mostly horizontal
        if (dx > 0) {
          sourceHandle = 'right-source';
          targetHandle = 'left-target';
        } else {
          sourceHandle = 'left-source';
          targetHandle = 'right-target';
        }
      } else if (dy < 0) {
        // Target is ABOVE Source
        sourceHandle = 'top-source';
        targetHandle = 'bottom-target';
      }
    }
    
    return { ...edge, sourceHandle, targetHandle };
  });

  return { nodes: layoutedNodes, edges: layoutedEdges };
};

const formatYearMonth = (dateStr?: unknown) => {
  if (!dateStr || (typeof dateStr !== 'string' && typeof dateStr !== 'number' && !(dateStr instanceof Date))) {
    return { yearKey: 'other', monthKey: 'other', yearLabel: 'Other Orders', monthLabel: 'Other Orders' };
  }
  const d = new Date(dateStr as string | number | Date);
  if (isNaN(d.getTime())) return { yearKey: 'other', monthKey: 'other', yearLabel: 'Other Orders', monthLabel: 'Other Orders' };
  const year = d.getUTCFullYear();
  const month = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
  const monthNum = String(d.getUTCMonth() + 1).padStart(2, '0');
  return {
    yearKey: String(year),
    monthKey: `${year}-${monthNum}`,
    yearLabel: `${year}`,
    monthLabel: `${month} ${year}`,
  };
};

export type SalesOrderExpandMode = 'all' | 'month' | 'year';

export interface NodeData {
  id?: string;
  label?: string;
  rawId?: string;
  type?: string;
  group?: string;
  role?: string;
  isSubcontractor?: boolean;
  organizationId?: string;
  actorId?: string;
  name?: string;
  contactId?: string;
  firstName?: string;
  lastName?: string;
  opportunityId?: string;
  projectId?: string;
  salesOrderId?: string;
  orderNumber?: string;
  projectNumber?: string;
  stateCode?: string;
  stage?: string;
  billingType?: string;
  baseTotalAmount?: string | number | null;
  currencyCode?: string;
  industry?: string;
  title?: string;
  orderCount?: number;
  totalAmount?: string | number | null;
  isExpanded?: boolean;
  expandMode?: SalesOrderExpandMode | null;
  onExpand?: (id: string) => void;
  onSetGroupExpandMode?: (groupId: string, mode: SalesOrderExpandMode | null) => void;
  onToggleYear?: (id: string) => void;
  onToggleMonth?: (id: string) => void;
  [key: string]: unknown;
}

export interface EdgeData {
  sourceOrganizationId?: string;
  targetOrganizationId?: string;
  sourceActorId?: string;
  targetActorId?: string;
  organizationId?: string;
  actorId?: string;
  contactId?: string;
  opportunityId?: string;
  projectId?: string;
  salesOrderId?: string;
  fromId?: string;
  toId?: string;
  type?: string;
  primaryFor?: string[];
  roles?: string[];
}

export type CustomNode = Node<NodeData>;

const OrganizationNode = ({ data }: NodeProps<CustomNode>) => {
  const isExpanded = Boolean(data.isExpanded);
  const isLoading = Boolean(data.isLoading);
  const toggleIcon = isLoading ? null : (isExpanded ? '−' : '+');
  const toggleTitle = isExpanded ? 'Collapse connections' : 'Expand connections';
  const buttonClass = `nodrag absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 !p-0 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-[var(--border)] text-xs font-bold shadow-sm transition-opacity z-20 cursor-pointer ${
    isExpanded || isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  }`;

  return (
    <div className="px-4 py-2 rounded-md relative group w-[260px] min-h-[85px] flex flex-col justify-center bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex flex-col relative z-10 pr-6 overflow-hidden">
        <Link href={`/crm/organizations/${data.rawId}`} className="font-bold text-sm hover:underline line-clamp-2 text-[var(--text-primary)]" title={data.label}>
          🏢 {data.label}
        </Link>
        {data.industry ? <div className="text-xs line-clamp-1 text-[var(--text-muted)]" title={data.industry}>{data.industry}</div> : null}
      </div>
      
      <Button 
        variant="secondary"
        size="xs"
        loading={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          data.onExpand?.(data.rawId!);
        }} 
        className={buttonClass}
        title={toggleTitle}
      >
        {toggleIcon}
      </Button>
    </div>
  );
};

const ActorNode = OrganizationNode;

const ContactNode = ({ data }: NodeProps<CustomNode>) => {
  const isExpanded = Boolean(data.isExpanded);
  const isLoading = Boolean(data.isLoading);
  const toggleIcon = isLoading ? null : (isExpanded ? '−' : '+');
  const toggleTitle = isExpanded ? 'Collapse connections' : 'Expand connections';
  const buttonClass = `nodrag absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 !p-0 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] border border-[var(--border)] text-xs font-bold shadow-sm transition-opacity z-20 cursor-pointer ${
    isExpanded || isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  }`;

  return (
    <div className="px-4 py-2 rounded-full relative group w-[260px] min-h-[85px] flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] shadow-sm">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex items-center justify-center font-bold text-sm relative z-10 w-full px-6 overflow-hidden text-[var(--text-primary)]">
        <Link href={`/crm/contacts/${data.rawId}`} className="hover:underline line-clamp-2 w-full text-center" title={data.label}>
          👤 {data.label}
        </Link>
      </div>

      <Button 
        variant="secondary"
        size="xs"
        loading={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          data.onExpand?.(data.rawId!);
        }} 
        className={buttonClass}
        title={toggleTitle}
      >
        {toggleIcon}
      </Button>
    </div>
  );
};

const OpportunityNode = ({ data }: NodeProps<CustomNode>) => {
  const isExpanded = Boolean(data.isExpanded);
  const isLoading = Boolean(data.isLoading);
  const toggleIcon = isLoading ? null : (isExpanded ? '−' : '+');
  const toggleTitle = isExpanded ? 'Collapse connections' : 'Expand connections';
  const buttonClass = `nodrag absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 !p-0 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-purple-400 border border-purple-500/40 text-xs font-bold shadow-sm transition-opacity z-20 cursor-pointer ${
    isExpanded || isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  }`;

  return (
    <div className="px-4 py-2 rounded-lg relative group w-[260px] min-h-[85px] flex flex-col justify-center bg-[var(--bg-card)] border border-purple-500/40 hover:border-purple-500 shadow-sm transition-colors">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex flex-col relative z-10 pr-6 overflow-hidden">
        <Link href={`/crm/opportunities/${data.rawId}`} className="font-bold text-sm hover:underline line-clamp-2 text-purple-400" title={data.label}>
          📈 {data.label}
        </Link>
        <div className="text-xs text-[var(--text-muted)] flex items-center gap-1 mt-0.5">
          <span>Opportunity</span>
        </div>
      </div>

      <Button 
        variant="secondary"
        size="xs"
        loading={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          data.onExpand?.(data.rawId!);
        }} 
        className={buttonClass}
        title={toggleTitle}
      >
        {toggleIcon}
      </Button>
    </div>
  );
};

const SalesOrderGroupNode = ({ data }: NodeProps<CustomNode>) => {
  const expandMode = (data.expandMode as SalesOrderExpandMode | null) || null;
  const formattedTotal = data.totalAmount != null && data.currencyCode
    ? formatAmount(Number(data.totalAmount), String(data.currencyCode))
    : null;
  const countLabel = `${data.orderCount ?? 0} ${data.orderCount === 1 ? 'order' : 'orders'}`;

  return (
    <div className="px-3.5 py-2.5 rounded-lg relative group w-[260px] min-h-[95px] flex flex-col justify-between bg-[var(--bg-card)] border-2 border-emerald-500 hover:border-emerald-400 shadow-sm transition-all">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex flex-col relative z-10 overflow-hidden">
        <div className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 line-clamp-1" title={data.label}>
          <span>🛒</span>
          <span>{data.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5">
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {countLabel}
          </span>
          {formattedTotal ? (
            <span className="font-medium text-[var(--text-secondary)]">{formattedTotal}</span>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-1 mt-2 pt-1.5 border-t border-emerald-500/30">
        <Button
          variant={expandMode === 'year' ? 'primary' : 'secondary'}
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            data.onSetGroupExpandMode?.(String(data.rawId), expandMode === 'year' ? null : 'year');
          }}
          className={
            expandMode === 'year'
              ? 'nodrag !px-1.5 !py-0.5 !text-[11px] h-6 flex-1 justify-center !bg-emerald-600 !text-white hover:!bg-emerald-500 !border-emerald-600'
              : 'nodrag !px-1.5 !py-0.5 !text-[11px] h-6 flex-1 justify-center !bg-[var(--bg-secondary)] hover:!bg-emerald-500/15 !text-[var(--text-secondary)] hover:!text-emerald-300 !border-emerald-500/30'
          }
          title="Group orders by year"
        >
          Year
        </Button>
        <Button
          variant={expandMode === 'month' ? 'primary' : 'secondary'}
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            data.onSetGroupExpandMode?.(String(data.rawId), expandMode === 'month' ? null : 'month');
          }}
          className={
            expandMode === 'month'
              ? 'nodrag !px-1.5 !py-0.5 !text-[11px] h-6 flex-1 justify-center !bg-emerald-600 !text-white hover:!bg-emerald-500 !border-emerald-600'
              : 'nodrag !px-1.5 !py-0.5 !text-[11px] h-6 flex-1 justify-center !bg-[var(--bg-secondary)] hover:!bg-emerald-500/15 !text-[var(--text-secondary)] hover:!text-emerald-300 !border-emerald-500/30'
          }
          title="Group orders by month"
        >
          Month
        </Button>
        <Button
          variant={expandMode === 'all' ? 'primary' : 'secondary'}
          size="xs"
          onClick={(e) => {
            e.stopPropagation();
            data.onSetGroupExpandMode?.(String(data.rawId), expandMode === 'all' ? null : 'all');
          }}
          className={
            expandMode === 'all'
              ? 'nodrag !px-1.5 !py-0.5 !text-[11px] h-6 flex-1 justify-center !bg-emerald-600 !text-white hover:!bg-emerald-500 !border-emerald-600'
              : 'nodrag !px-1.5 !py-0.5 !text-[11px] h-6 flex-1 justify-center !bg-[var(--bg-secondary)] hover:!bg-emerald-500/15 !text-[var(--text-secondary)] hover:!text-emerald-300 !border-emerald-500/30'
          }
          title="Show all individual orders"
        >
          All
        </Button>
      </div>
    </div>
  );
};

const SalesOrderYearNode = ({ data }: NodeProps<CustomNode>) => {
  const isExpanded = Boolean(data.isExpanded);
  const formattedTotal = data.totalAmount != null && data.currencyCode
    ? formatAmount(Number(data.totalAmount), String(data.currencyCode))
    : null;
  const countLabel = `${data.orderCount ?? 0} ${data.orderCount === 1 ? 'order' : 'orders'}`;
  const toggleIcon = isExpanded ? '−' : '+';
  const toggleTitle = isExpanded ? 'Collapse year orders' : 'Expand year orders';

  return (
    <div className="px-4 py-2 rounded-lg relative group w-[260px] min-h-[85px] flex flex-col justify-center bg-[var(--bg-card)] border-2 border-dashed border-emerald-500/50 hover:border-emerald-500 shadow-sm transition-all">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex flex-col relative z-10 pr-6 overflow-hidden">
        <div className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 line-clamp-1" title={data.label}>
          <span>📆</span>
          <span>{data.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {countLabel}
          </span>
          {formattedTotal ? (
            <span className="font-medium text-[var(--text-secondary)]">{formattedTotal}</span>
          ) : null}
        </div>
      </div>

      <Button 
        variant="secondary"
        size="xs"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleYear?.(String(data.rawId));
        }} 
        className="nodrag absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 !p-0 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-emerald-400 border border-emerald-500/40 text-xs font-bold shadow-sm opacity-90 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
        title={toggleTitle}
      >
        {toggleIcon}
      </Button>
    </div>
  );
};

const SalesOrderMonthNode = ({ data }: NodeProps<CustomNode>) => {
  const isExpanded = Boolean(data.isExpanded);
  const formattedTotal = data.totalAmount != null && data.currencyCode
    ? formatAmount(Number(data.totalAmount), String(data.currencyCode))
    : null;
  const countLabel = `${data.orderCount ?? 0} ${data.orderCount === 1 ? 'order' : 'orders'}`;
  const toggleIcon = isExpanded ? '−' : '+';
  const toggleTitle = isExpanded ? 'Collapse month orders' : 'Expand month orders';

  return (
    <div className="px-4 py-2 rounded-lg relative group w-[260px] min-h-[85px] flex flex-col justify-center bg-[var(--bg-card)] border-2 border-dashed border-emerald-500/50 hover:border-emerald-500 shadow-sm transition-all">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex flex-col relative z-10 pr-6 overflow-hidden">
        <div className="font-bold text-sm text-emerald-400 flex items-center gap-1.5 line-clamp-1" title={data.label}>
          <span>📅</span>
          <span>{data.label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-1">
          <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            {countLabel}
          </span>
          {formattedTotal ? (
            <span className="font-medium text-[var(--text-secondary)]">{formattedTotal}</span>
          ) : null}
        </div>
      </div>

      <Button 
        variant="secondary"
        size="xs"
        onClick={(e) => {
          e.stopPropagation();
          data.onToggleMonth?.(String(data.rawId));
        }} 
        className="nodrag absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 !p-0 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-emerald-400 border border-emerald-500/40 text-xs font-bold shadow-sm opacity-90 group-hover:opacity-100 transition-opacity z-20 cursor-pointer"
        title={toggleTitle}
      >
        {toggleIcon}
      </Button>
    </div>
  );
};

const SalesOrderNode = ({ data }: NodeProps<CustomNode>) => {
  const isExpanded = Boolean(data.isExpanded);
  const isLoading = Boolean(data.isLoading);
  const toggleIcon = isLoading ? null : (isExpanded ? '−' : '+');
  const toggleTitle = isExpanded ? 'Collapse connections' : 'Expand connections';
  const buttonClass = `nodrag absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 !p-0 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-emerald-400 border border-emerald-500/40 text-xs font-bold shadow-sm transition-opacity z-20 cursor-pointer ${
    isExpanded || isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  }`;
  const formattedAmount = data.baseTotalAmount != null && data.currencyCode
    ? formatAmount(Number(data.baseTotalAmount), data.currencyCode)
    : null;

  return (
    <div className="px-4 py-2 rounded-lg relative group w-[260px] min-h-[85px] flex flex-col justify-center bg-[var(--bg-card)] border border-emerald-500/40 hover:border-emerald-500 shadow-sm transition-colors">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex flex-col relative z-10 pr-6 overflow-hidden">
        <Link href={`/sales-orders/${data.rawId}`} className="font-bold text-sm hover:underline line-clamp-1 text-emerald-400" title={data.label}>
          🛒 {data.label}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5">
          {data.stateCode ? (
            <span className="px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {data.stateCode}
            </span>
          ) : null}
          {formattedAmount ? (
            <span className="font-medium text-[var(--text-secondary)]">{formattedAmount}</span>
          ) : null}
        </div>
      </div>

      <Button 
        variant="secondary"
        size="xs"
        loading={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          data.onExpand?.(data.rawId!);
        }} 
        className={buttonClass}
        title={toggleTitle}
      >
        {toggleIcon}
      </Button>
    </div>
  );
};

const ProjectNode = ({ data }: NodeProps<CustomNode>) => {
  const isExpanded = Boolean(data.isExpanded);
  const isLoading = Boolean(data.isLoading);
  const toggleIcon = isLoading ? null : (isExpanded ? '−' : '+');
  const toggleTitle = isExpanded ? 'Collapse connections' : 'Expand connections';
  const buttonClass = `nodrag absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 !p-0 flex items-center justify-center rounded-full bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] text-amber-400 border border-amber-500/40 text-xs font-bold shadow-sm transition-opacity z-20 cursor-pointer ${
    isExpanded || isLoading ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
  }`;

  return (
    <div className="px-4 py-2 rounded-lg relative group w-[260px] min-h-[85px] flex flex-col justify-center bg-[var(--bg-card)] border border-amber-500/40 hover:border-amber-500 shadow-sm transition-colors">
      <Handle type="target" position={Position.Top} id="top-target" className="opacity-0" />
      <Handle type="source" position={Position.Top} id="top-source" className="opacity-0" />
      <Handle type="target" position={Position.Bottom} id="bottom-target" className="opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className="opacity-0" />
      <Handle type="target" position={Position.Left} id="left-target" className="opacity-0" />
      <Handle type="source" position={Position.Left} id="left-source" className="opacity-0" />
      <Handle type="target" position={Position.Right} id="right-target" className="opacity-0" />
      <Handle type="source" position={Position.Right} id="right-source" className="opacity-0" />

      <div className="flex flex-col relative z-10 pr-6 overflow-hidden">
        <Link href={`/projects/${data.rawId}`} className="font-bold text-sm hover:underline line-clamp-1 text-amber-400" title={data.label}>
          📁 {data.label}
        </Link>
        <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] mt-0.5">
          {data.stage ? (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {data.stage}
            </span>
          ) : null}
          {data.billingType ? (
            <span className="capitalize text-[11px] text-[var(--text-muted)]">
              {data.billingType.replace(/_/g, ' ')}
            </span>
          ) : null}
        </div>
      </div>

      <Button 
        variant="secondary"
        size="xs"
        loading={isLoading}
        onClick={(e) => {
          e.stopPropagation();
          data.onExpand?.(data.rawId!);
        }} 
        className={buttonClass}
        title={toggleTitle}
      >
        {toggleIcon}
      </Button>
    </div>
  );
};

const nodeTypes = {
  organization: OrganizationNode as any,
  actor: ActorNode as any,
  contact: ContactNode as any,
  opportunity: OpportunityNode as any,
  salesOrderGroup: SalesOrderGroupNode as any,
  salesOrderYear: SalesOrderYearNode as any,
  salesOrderMonth: SalesOrderMonthNode as any,
  salesOrder: SalesOrderNode as any,
  project: ProjectNode as any,
};

function mergePayloads(base: api.CrmMapResponseDto, subgraphs: api.CrmMapResponseDto[]): api.CrmMapResponseDto {
  const merged: api.CrmMapResponseDto = {
    nodes: {
      organizations: [...(base.nodes.organizations || [])],
      contacts: [...(base.nodes.contacts || [])],
      opportunities: [...(base.nodes.opportunities || [])],
      salesOrders: [...(base.nodes.salesOrders || [])],
      projects: [...(base.nodes.projects || [])],
    },
    edges: {
      organizationOrganization: [...(base.edges.organizationOrganization || [])],
      organizationContact: [...(base.edges.organizationContact || [])],
      opportunityOrganization: [...(base.edges.opportunityOrganization || [])],
      opportunityContact: [...(base.edges.opportunityContact || [])],
      organizationSalesOrder: [...(base.edges.organizationSalesOrder || [])],
      opportunitySalesOrder: [...(base.edges.opportunitySalesOrder || [])],
      organizationProject: [...(base.edges.organizationProject || [])],
      opportunityProject: [...(base.edges.opportunityProject || [])],
      referralOrganizationOrganization: [...(base.edges.referralOrganizationOrganization || [])],
      referralContactOrganization: [...(base.edges.referralContactOrganization || [])],
    },
  };

  for (const sub of subgraphs) {
    sub.nodes.organizations?.forEach((o) => {
      if (!merged.nodes.organizations!.some((x) => x.organizationId === o.organizationId)) {
        merged.nodes.organizations!.push(o);
      }
    });
    sub.nodes.contacts?.forEach((c) => {
      if (!merged.nodes.contacts!.some((x) => x.contactId === c.contactId)) {
        merged.nodes.contacts!.push(c);
      }
    });
    sub.nodes.opportunities?.forEach((opp) => {
      if (!merged.nodes.opportunities!.some((x) => x.opportunityId === opp.opportunityId)) {
        merged.nodes.opportunities!.push(opp);
      }
    });
    sub.nodes.salesOrders?.forEach((so) => {
      if (!merged.nodes.salesOrders!.some((x) => x.salesOrderId === so.salesOrderId)) {
        merged.nodes.salesOrders!.push(so);
      }
    });
    sub.nodes.projects?.forEach((p) => {
      if (!merged.nodes.projects!.some((x) => x.projectId === p.projectId)) {
        merged.nodes.projects!.push(p);
      }
    });

    sub.edges.organizationOrganization?.forEach((e) => {
      if (!merged.edges.organizationOrganization!.some((x) => x.sourceOrganizationId === e.sourceOrganizationId && x.targetOrganizationId === e.targetOrganizationId)) {
        merged.edges.organizationOrganization!.push(e);
      }
    });
    sub.edges.organizationContact?.forEach((e) => {
      if (!merged.edges.organizationContact!.some((x) => x.organizationId === e.organizationId && x.contactId === e.contactId)) {
        merged.edges.organizationContact!.push(e);
      }
    });
    sub.edges.opportunityOrganization?.forEach((e) => {
      if (!merged.edges.opportunityOrganization!.some((x) => x.opportunityId === e.opportunityId && x.organizationId === e.organizationId)) {
        merged.edges.opportunityOrganization!.push(e);
      }
    });
    sub.edges.opportunityContact?.forEach((e) => {
      if (!merged.edges.opportunityContact!.some((x) => x.opportunityId === e.opportunityId && x.contactId === e.contactId)) {
        merged.edges.opportunityContact!.push(e);
      }
    });
    sub.edges.organizationSalesOrder?.forEach((e) => {
      if (!merged.edges.organizationSalesOrder!.some((x) => x.organizationId === e.organizationId && x.salesOrderId === e.salesOrderId)) {
        merged.edges.organizationSalesOrder!.push(e);
      }
    });
    sub.edges.opportunitySalesOrder?.forEach((e) => {
      if (!merged.edges.opportunitySalesOrder!.some((x) => x.opportunityId === e.opportunityId && x.salesOrderId === e.salesOrderId)) {
        merged.edges.opportunitySalesOrder!.push(e);
      }
    });
    sub.edges.organizationProject?.forEach((e) => {
      if (!merged.edges.organizationProject!.some((x) => x.organizationId === e.organizationId && x.projectId === e.projectId)) {
        merged.edges.organizationProject!.push(e);
      }
    });
    sub.edges.opportunityProject?.forEach((e) => {
      if (!merged.edges.opportunityProject!.some((x) => x.opportunityId === e.opportunityId && x.projectId === e.projectId)) {
        merged.edges.opportunityProject!.push(e);
      }
    });
    sub.edges.referralOrganizationOrganization?.forEach((e) => {
      if (!merged.edges.referralOrganizationOrganization!.some((x) => x.sourceOrganizationId === e.sourceOrganizationId && x.targetOrganizationId === e.targetOrganizationId)) {
        merged.edges.referralOrganizationOrganization!.push(e);
      }
    });
    sub.edges.referralContactOrganization?.forEach((e) => {
      if (!merged.edges.referralContactOrganization!.some((x) => x.contactId === e.contactId && x.organizationId === e.organizationId)) {
        merged.edges.referralContactOrganization!.push(e);
      }
    });
  }

  return merged;
}

export default function MapContent() {
  const searchParams = useSearchParams();
  const queryOrgId = searchParams.get('organizationId') || searchParams.get('actorId') || searchParams.get('focalNodeId') || '';
  const [focalNodeId, setFocalNodeId] = useState<string>(queryOrgId);

  // Layer filter toggles
  const [showContacts, setShowContacts] = useState(true);
  const [showOpportunities, setShowOpportunities] = useState(true);
  const [showSalesOrders, setShowSalesOrders] = useState(true);
  const [showProjects, setShowProjects] = useState(true);

  // Expansion state for sales orders
  const [groupExpandModes, setGroupExpandModes] = useState<Record<string, SalesOrderExpandMode>>({});
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  // Expansion state for graph nodes
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(new Set());
  const [expandingNodeIds, setExpandingNodeIds] = useState<Set<string>>(new Set());
  const subgraphsRef = useRef<Map<string, api.CrmMapResponseDto>>(new Map());

  const handleSetGroupExpandMode = useCallback((groupId: string, mode: SalesOrderExpandMode | null) => {
    setGroupExpandModes((prev) => {
      const next = { ...prev };
      if (!mode) {
        delete next[groupId];
      } else {
        next[groupId] = mode;
      }
      return next;
    });
  }, []);

  const handleToggleYear = useCallback((yearNodeId: string) => {
    setExpandedYears((prev) => {
      const next = new Set(prev);
      if (next.has(yearNodeId)) {
        next.delete(yearNodeId);
      } else {
        next.add(yearNodeId);
      }
      return next;
    });
  }, []);

  const handleToggleMonth = useCallback((monthNodeId: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(monthNodeId)) {
        next.delete(monthNodeId);
      } else {
        next.add(monthNodeId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (queryOrgId && queryOrgId !== focalNodeId) {
      setFocalNodeId(queryOrgId);
    }
  }, [queryOrgId, focalNodeId]);

  useEffect(() => {
    setExpandedNodeIds(new Set());
    setExpandingNodeIds(new Set());
    subgraphsRef.current.clear();
  }, [focalNodeId]);
  
  // Fetch graph data
  const { data: mapData, isLoading, error } = useSWR(
    focalNodeId ? ['crm-map', focalNodeId] : null,
    async () => {
      const { data } = await api.crmMapControllerGetMap({ focalNodeId, maxDistance: 2 });
      return data;
    }
  );

  const focalOrgName = useMemo(() => {
    const orgs = mapData?.nodes?.organizations || [];
    return orgs.find((a) => a.organizationId === focalNodeId)?.name || '';
  }, [mapData, focalNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);

  const nodesRef = useRef(nodes);
  const edgesRef = useRef(edges);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  
  // Sync refs with state without triggering effects
  useEffect(() => {
    nodesRef.current = nodes;
    edgesRef.current = edges;
  }, [nodes, edges]);

  const rawGraphData = useMemo(() => {
    if (!mapData || !mapData.nodes || !mapData.edges) return null;
    if (expandedNodeIds.size === 0) return mapData;
    const activeSubgraphs: api.CrmMapResponseDto[] = [];
    expandedNodeIds.forEach((id) => {
      const sub = subgraphsRef.current.get(id);
      if (sub) {
        activeSubgraphs.push(sub);
      }
    });
    return mergePayloads(mapData, activeSubgraphs);
  }, [mapData, expandedNodeIds]);

  const processPayload = useCallback((
    payload: api.CrmMapResponseDto,
    onExpandCb: (id: string) => void,
    onSetGroupExpandModeCb: (groupId: string, mode: SalesOrderExpandMode | null) => void,
    onToggleYearCb: (id: string) => void,
    onToggleMonthCb: (id: string) => void,
    groupExpandModesMap: Record<string, SalesOrderExpandMode>,
    expandedYearSet: Set<string>,
    expandedMonthSet: Set<string>,
    expandedNodeIdSet: Set<string>,
    expandingNodeIdSet: Set<string>,
    filters = { showContacts: true, showOpportunities: true, showSalesOrders: true, showProjects: true }
  ) => {
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    const addedNodeIds = new Set<string>();

    const addNode = (node: Node) => {
      if (!addedNodeIds.has(node.id)) {
        addedNodeIds.add(node.id);
        newNodes.push(node);
      }
    };

    const orgNodes = payload.nodes.organizations || [];
    orgNodes.forEach((a) => {
      addNode({
        id: `organization-${a.organizationId}`,
        type: 'organization',
        position: { x: 0, y: 0 },
        data: {
          label: a.name,
          industry: a.industry,
          rawId: a.organizationId,
          isExpanded: expandedNodeIdSet.has(a.organizationId),
          isLoading: expandingNodeIdSet.has(a.organizationId),
          onExpand: onExpandCb,
        },
      });
    });

    if (filters.showContacts) {
      payload.nodes.contacts?.forEach((c) => {
        addNode({
          id: `contact-${c.contactId}`,
          type: 'contact',
          position: { x: 0, y: 0 },
          data: {
            label: `${c.firstName} ${c.lastName}`,
            rawId: c.contactId,
            isExpanded: expandedNodeIdSet.has(c.contactId),
            isLoading: expandingNodeIdSet.has(c.contactId),
            onExpand: onExpandCb,
          },
        });
      });
    }

    if (filters.showOpportunities) {
      const opps = payload.nodes.opportunities || [];
      opps.forEach((p) => {
        addNode({
          id: `opportunity-${p.opportunityId}`,
          type: 'opportunity',
          position: { x: 0, y: 0 },
          data: {
            label: p.name || 'Opportunity',
            rawId: p.opportunityId,
            isExpanded: expandedNodeIdSet.has(p.opportunityId),
            isLoading: expandingNodeIdSet.has(p.opportunityId),
            onExpand: onExpandCb,
          },
        });
      });
    }

    if (filters.showProjects) {
      const projects = payload.nodes.projects || [];
      projects.forEach((proj) => {
        addNode({
          id: `project-${proj.projectId}`,
          type: 'project',
          position: { x: 0, y: 0 },
          data: {
            label: proj.name || proj.projectNumber,
            projectNumber: proj.projectNumber,
            name: proj.name,
            stateCode: proj.stateCode,
            stage: proj.stage,
            billingType: proj.billingType,
            rawId: proj.projectId,
            isExpanded: expandedNodeIdSet.has(proj.projectId),
            isLoading: expandingNodeIdSet.has(proj.projectId),
            onExpand: onExpandCb,
          },
        });
      });
    }

    if (filters.showSalesOrders) {
      const soMap = new Map<string, api.CrmMapSalesOrderNodeDto>();
      (payload.nodes.salesOrders || []).forEach((so) => {
        soMap.set(so.salesOrderId, so);
      });

      interface SalesOrderTopGroup {
        id: string;
        parentId: string;
        label: string;
        orders: api.CrmMapSalesOrderNodeDto[];
        edgeLabel?: string;
        edgeColor: string;
      }

      const topGroups = new Map<string, SalesOrderTopGroup>();
      const handledSoIds = new Set<string>();

      // Group Organization -> Sales Orders
      const orgSOs = payload.edges.organizationSalesOrder || [];
      orgSOs.forEach((e) => {
        const so = soMap.get(e.salesOrderId);
        if (!so) return;
        handledSoIds.add(so.salesOrderId);

        const groupId = `so-group-org-${e.organizationId}`;
        if (!topGroups.has(groupId)) {
          topGroups.set(groupId, {
            id: groupId,
            parentId: `organization-${e.organizationId}`,
            label: 'Sales Orders',
            orders: [],
            edgeLabel: 'Sales Orders',
            edgeColor: '#10b981',
          });
        }
        topGroups.get(groupId)!.orders.push(so);
      });

      // Group Opportunity -> Sales Orders
      if (filters.showOpportunities) {
        const oppSOs = payload.edges.opportunitySalesOrder || [];
        oppSOs.forEach((e) => {
          const so = soMap.get(e.salesOrderId);
          if (!so) return;
          handledSoIds.add(so.salesOrderId);

          const groupId = `so-group-opp-${e.opportunityId}`;
          if (!topGroups.has(groupId)) {
            topGroups.set(groupId, {
              id: groupId,
              parentId: `opportunity-${e.opportunityId}`,
              label: 'Converted Orders',
              orders: [],
              edgeLabel: 'Converted Orders',
              edgeColor: '#8b5cf6',
            });
          }
          topGroups.get(groupId)!.orders.push(so);
        });
      }

      // Handle unlinked Sales Orders
      (payload.nodes.salesOrders || []).forEach((so) => {
        if (!handledSoIds.has(so.salesOrderId)) {
          const groupId = `so-group-unlinked`;
          if (!topGroups.has(groupId)) {
            topGroups.set(groupId, {
              id: groupId,
              parentId: '',
              label: 'Sales Orders',
              orders: [],
              edgeColor: '#10b981',
            });
          }
          topGroups.get(groupId)!.orders.push(so);
        }
      });

      topGroups.forEach((group) => {
        if (group.orders.length === 0) return;
        const totalAmount = group.orders.reduce((sum, o) => sum + (Number(o.baseTotalAmount) || 0), 0);
        const currencyCode = group.orders[0]?.currencyCode || 'USD';
        const expandMode = groupExpandModesMap[group.id] || null;

        // Emit the single top-level group node for this parent
        addNode({
          id: group.id,
          type: 'salesOrderGroup',
          position: { x: 0, y: 0 },
          data: {
            label: group.label,
            rawId: group.id,
            orderCount: group.orders.length,
            totalAmount: totalAmount > 0 ? totalAmount : null,
            currencyCode,
            expandMode,
            onSetGroupExpandMode: onSetGroupExpandModeCb,
          },
        });

        if (group.parentId) {
          newEdges.push({
            id: `edge-${group.parentId}-${group.id}`,
            source: group.parentId,
            target: group.id,
            style: { stroke: group.edgeColor, strokeWidth: 1.5 },
            label: group.edgeLabel,
          });
        }

        // Branch based on expandMode
        if (expandMode === 'all') {
          // Direct individual orders
          group.orders.forEach((so) => {
            addNode({
              id: `salesOrder-${so.salesOrderId}`,
              type: 'salesOrder',
              position: { x: 0, y: 0 },
              data: {
                label: so.orderNumber || 'Sales Order',
                orderNumber: so.orderNumber,
                stateCode: so.stateCode,
                baseTotalAmount: so.baseTotalAmount,
                currencyCode: so.currencyCode,
                name: so.name,
                rawId: so.salesOrderId,
                isExpanded: expandedNodeIdSet.has(so.salesOrderId),
                isLoading: expandingNodeIdSet.has(so.salesOrderId),
                onExpand: onExpandCb,
              },
            });

            newEdges.push({
              id: `edge-${group.id}-salesOrder-${so.salesOrderId}`,
              source: group.id,
              target: `salesOrder-${so.salesOrderId}`,
              style: { stroke: group.edgeColor, strokeWidth: 1.5, strokeDasharray: '4,4' },
            });
          });
        } else if (expandMode === 'month') {
          // Cluster by Month
          const monthMap = new Map<string, { key: string; label: string; orders: api.CrmMapSalesOrderNodeDto[] }>();
          group.orders.forEach((so) => {
            const { monthKey, monthLabel } = formatYearMonth(so.createdOn);
            if (!monthMap.has(monthKey)) {
              monthMap.set(monthKey, { key: monthKey, label: monthLabel, orders: [] });
            }
            monthMap.get(monthKey)!.orders.push(so);
          });

          const sortedMonths = Array.from(monthMap.values()).sort((a, b) => b.key.localeCompare(a.key));

          sortedMonths.forEach((m) => {
            const monthNodeId = `${group.id}-month-${m.key}`;
            const monthTotal = m.orders.reduce((sum, o) => sum + (Number(o.baseTotalAmount) || 0), 0);
            const isMonthExpanded = expandedMonthSet.has(monthNodeId);

            addNode({
              id: monthNodeId,
              type: 'salesOrderMonth',
              position: { x: 0, y: 0 },
              data: {
                label: m.label,
                rawId: monthNodeId,
                orderCount: m.orders.length,
                totalAmount: monthTotal > 0 ? monthTotal : null,
                currencyCode,
                isExpanded: isMonthExpanded,
                onToggleMonth: onToggleMonthCb,
              },
            });

            newEdges.push({
              id: `edge-${group.id}-${monthNodeId}`,
              source: group.id,
              target: monthNodeId,
              style: { stroke: group.edgeColor, strokeWidth: 1.5 },
            });

            if (isMonthExpanded) {
              m.orders.forEach((so) => {
                addNode({
                  id: `salesOrder-${so.salesOrderId}`,
                  type: 'salesOrder',
                  position: { x: 0, y: 0 },
                  data: {
                    label: so.orderNumber || 'Sales Order',
                    orderNumber: so.orderNumber,
                    stateCode: so.stateCode,
                    baseTotalAmount: so.baseTotalAmount,
                    currencyCode: so.currencyCode,
                    name: so.name,
                    rawId: so.salesOrderId,
                    isExpanded: expandedNodeIdSet.has(so.salesOrderId),
                    isLoading: expandingNodeIdSet.has(so.salesOrderId),
                    onExpand: onExpandCb,
                  },
                });

                newEdges.push({
                  id: `edge-${monthNodeId}-salesOrder-${so.salesOrderId}`,
                  source: monthNodeId,
                  target: `salesOrder-${so.salesOrderId}`,
                  style: { stroke: group.edgeColor, strokeWidth: 1.5, strokeDasharray: '4,4' },
                });
              });
            }
          });
        } else if (expandMode === 'year') {
          // Cluster by Year
          const yearMap = new Map<string, { key: string; label: string; orders: api.CrmMapSalesOrderNodeDto[] }>();
          group.orders.forEach((so) => {
            const { yearKey, yearLabel } = formatYearMonth(so.createdOn);
            if (!yearMap.has(yearKey)) {
              yearMap.set(yearKey, { key: yearKey, label: yearLabel, orders: [] });
            }
            yearMap.get(yearKey)!.orders.push(so);
          });

          const sortedYears = Array.from(yearMap.values()).sort((a, b) => b.key.localeCompare(a.key));

          sortedYears.forEach((y) => {
            const yearNodeId = `${group.id}-year-${y.key}`;
            const yearTotal = y.orders.reduce((sum, o) => sum + (Number(o.baseTotalAmount) || 0), 0);
            const isYearExpanded = expandedYearSet.has(yearNodeId);

            addNode({
              id: yearNodeId,
              type: 'salesOrderYear',
              position: { x: 0, y: 0 },
              data: {
                label: y.label,
                rawId: yearNodeId,
                orderCount: y.orders.length,
                totalAmount: yearTotal > 0 ? yearTotal : null,
                currencyCode,
                isExpanded: isYearExpanded,
                onToggleYear: onToggleYearCb,
              },
            });

            newEdges.push({
              id: `edge-${group.id}-${yearNodeId}`,
              source: group.id,
              target: yearNodeId,
              style: { stroke: group.edgeColor, strokeWidth: 1.5 },
            });

            if (isYearExpanded) {
              // Group year's orders by Month
              const yearMonthMap = new Map<string, { key: string; label: string; orders: api.CrmMapSalesOrderNodeDto[] }>();
              y.orders.forEach((so) => {
                const { monthKey, monthLabel } = formatYearMonth(so.createdOn);
                if (!yearMonthMap.has(monthKey)) {
                  yearMonthMap.set(monthKey, { key: monthKey, label: monthLabel, orders: [] });
                }
                yearMonthMap.get(monthKey)!.orders.push(so);
              });

              const sortedYearMonths = Array.from(yearMonthMap.values()).sort((a, b) => b.key.localeCompare(a.key));

              sortedYearMonths.forEach((ym) => {
                const ymNodeId = `${yearNodeId}-month-${ym.key}`;
                const ymTotal = ym.orders.reduce((sum, o) => sum + (Number(o.baseTotalAmount) || 0), 0);
                const isYmExpanded = expandedMonthSet.has(ymNodeId);

                addNode({
                  id: ymNodeId,
                  type: 'salesOrderMonth',
                  position: { x: 0, y: 0 },
                  data: {
                    label: ym.label,
                    rawId: ymNodeId,
                    orderCount: ym.orders.length,
                    totalAmount: ymTotal > 0 ? ymTotal : null,
                    currencyCode,
                    isExpanded: isYmExpanded,
                    onToggleMonth: onToggleMonthCb,
                  },
                });

                newEdges.push({
                  id: `edge-${yearNodeId}-${ymNodeId}`,
                  source: yearNodeId,
                  target: ymNodeId,
                  style: { stroke: group.edgeColor, strokeWidth: 1.5 },
                });

                if (isYmExpanded) {
                  ym.orders.forEach((so) => {
                    addNode({
                      id: `salesOrder-${so.salesOrderId}`,
                      type: 'salesOrder',
                      position: { x: 0, y: 0 },
                      data: {
                        label: so.orderNumber || 'Sales Order',
                        orderNumber: so.orderNumber,
                        stateCode: so.stateCode,
                        baseTotalAmount: so.baseTotalAmount,
                        currencyCode: so.currencyCode,
                        name: so.name,
                        rawId: so.salesOrderId,
                        isExpanded: expandedNodeIdSet.has(so.salesOrderId),
                        isLoading: expandingNodeIdSet.has(so.salesOrderId),
                        onExpand: onExpandCb,
                      },
                    });

                    newEdges.push({
                      id: `edge-${ymNodeId}-salesOrder-${so.salesOrderId}`,
                      source: ymNodeId,
                      target: `salesOrder-${so.salesOrderId}`,
                      style: { stroke: group.edgeColor, strokeWidth: 1.5, strokeDasharray: '4,4' },
                    });
                  });
                }
              });
            }
          });
        }
      });
    }

    const orgOrgEdges = payload.edges.organizationOrganization || [];
    orgOrgEdges.forEach((e) => {
      newEdges.push({
        id: `oo-${e.sourceOrganizationId}-${e.targetOrganizationId}`,
        source: `organization-${e.sourceOrganizationId}`,
        target: `organization-${e.targetOrganizationId}`,
        animated: true,
      });
    });

    if (filters.showContacts) {
      const orgContactEdges = payload.edges.organizationContact || [];
      orgContactEdges.forEach((e) => {
        newEdges.push({
          id: `oc-${e.organizationId}-${e.contactId}`,
          source: `organization-${e.organizationId}`,
          target: `contact-${e.contactId}`,
          label: e.primaryFor?.length ? `Primary for: ${e.primaryFor.join(', ')}` : undefined,
        });
      });
    }

    if (filters.showOpportunities) {
      const oppOrgs = payload.edges.opportunityOrganization || [];
      oppOrgs.forEach((e) => {
        newEdges.push({
          id: `po-${e.opportunityId}-${e.organizationId}`,
          source: `opportunity-${e.opportunityId}`,
          target: `organization-${e.organizationId}`,
          label: e.roles?.length ? e.roles.join(', ') : undefined,
        });
      });

      if (filters.showContacts) {
        const oppContacts = payload.edges.opportunityContact || [];
        oppContacts.forEach((e) => {
          newEdges.push({
            id: `pc-${e.opportunityId}-${e.contactId}`,
            source: `opportunity-${e.opportunityId}`,
            target: `contact-${e.contactId}`,
            label: e.roles?.length ? e.roles.join(', ') : undefined,
          });
        });
      }
    }

    if (filters.showProjects) {
      const orgProjects = payload.edges.organizationProject || [];
      orgProjects.forEach((e) => {
        newEdges.push({
          id: `oprj-${e.organizationId}-${e.projectId}`,
          source: `organization-${e.organizationId}`,
          target: `project-${e.projectId}`,
          style: { stroke: '#f59e0b', strokeWidth: 1.5 },
          label: 'Project',
        });
      });

      if (filters.showOpportunities) {
        const oppProjects = payload.edges.opportunityProject || [];
        oppProjects.forEach((e) => {
          newEdges.push({
            id: `pprj-${e.opportunityId}-${e.projectId}`,
            source: `opportunity-${e.opportunityId}`,
            target: `project-${e.projectId}`,
            style: { stroke: '#8b5cf6', strokeWidth: 1.5 },
            label: 'Converted Project',
          });
        });
      }
    }

    const refOrgOrgs = payload.edges.referralOrganizationOrganization || [];
    refOrgOrgs.forEach((e) => {
      newEdges.push({
        id: `ref-oo-${e.sourceOrganizationId}-${e.targetOrganizationId}`,
        source: `organization-${e.sourceOrganizationId}`,
        target: `organization-${e.targetOrganizationId}`,
        animated: false,
        style: { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' },
        label: 'Referred By',
      });
    });

    if (filters.showContacts) {
      const refContactOrgs = payload.edges.referralContactOrganization || [];
      refContactOrgs.forEach((e) => {
        newEdges.push({
          id: `ref-co-${e.contactId}-${e.organizationId}`,
          source: `contact-${e.contactId}`,
          target: `organization-${e.organizationId}`,
          animated: false,
          style: { stroke: '#9ca3af', strokeWidth: 2, strokeDasharray: '5,5' },
          label: 'Referred By',
        });
      });
    }

    // Keep only edges where both source and target nodes exist in newNodes
    const nodeIds = new Set(newNodes.map((n) => n.id));
    const validEdges = newEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

    return { newNodes, newEdges: validEdges };
  }, []);

  const collapseNode = useCallback((rawId: string) => {
    setExpandedNodeIds((prev) => {
      const next = new Set(prev);
      const toRemove = [rawId];
      const visited = new Set<string>();

      while (toRemove.length > 0) {
        const currentId = toRemove.pop()!;
        if (visited.has(currentId)) continue;
        visited.add(currentId);
        next.delete(currentId);

        const sub = subgraphsRef.current.get(currentId);
        if (sub) {
          const childIds = [
            ...(sub.nodes.organizations?.map((o) => o.organizationId) || []),
            ...(sub.nodes.contacts?.map((c) => c.contactId) || []),
            ...(sub.nodes.opportunities?.map((opp) => opp.opportunityId) || []),
            ...(sub.nodes.salesOrders?.map((s) => s.salesOrderId) || []),
            ...(sub.nodes.projects?.map((p) => p.projectId) || []),
          ];
          childIds.forEach((cid) => {
            if (cid !== currentId && next.has(cid)) {
              toRemove.push(cid);
            }
          });
        }
      }
      return next;
    });
  }, []);

  const handleExpand = useCallback(async (rawId: string) => {
    if (expandedNodeIds.has(rawId)) {
      collapseNode(rawId);
      return;
    }

    if (subgraphsRef.current.has(rawId)) {
      setExpandedNodeIds((prev) => new Set(prev).add(rawId));
      return;
    }

    try {
      setExpandingNodeIds((prev) => new Set(prev).add(rawId));
      const { data: payload } = await api.crmMapControllerGetMap({ focalNodeId: rawId, maxDistance: 1 });
      if (payload && payload.nodes && payload.edges) {
        subgraphsRef.current.set(rawId, payload);
        setExpandedNodeIds((prev) => new Set(prev).add(rawId));
      }
    } catch (err) {
      toast.error('Failed to expand node: ' + getErrorMessage(err));
      reportError(err, 'MapContent.tsx - Error expanding node');
    } finally {
      setExpandingNodeIds((prev) => {
        const next = new Set(prev);
        next.delete(rawId);
        return next;
      });
    }
  }, [expandedNodeIds, collapseNode]);

  const handleRelayout = useCallback(() => {
    if (rawGraphData && rawGraphData.nodes && rawGraphData.edges) {
      const { newNodes, newEdges } = processPayload(
        rawGraphData,
        handleExpand,
        handleSetGroupExpandMode,
        handleToggleYear,
        handleToggleMonth,
        groupExpandModes,
        expandedYears,
        expandedMonths,
        expandedNodeIds,
        expandingNodeIds,
        {
          showContacts,
          showOpportunities,
          showSalesOrders,
          showProjects,
        }
      );
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    } else {
      const currentNodes = nodesRef.current;
      const currentEdges = edgesRef.current;
      if (currentNodes.length === 0) return;

      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(currentNodes, currentEdges);
      setNodes(layoutedNodes);
      setEdges(layoutedEdges);
    }

    setTimeout(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2, duration: 400 });
    }, 50);
  }, [
    rawGraphData,
    processPayload,
    handleExpand,
    handleSetGroupExpandMode,
    handleToggleYear,
    handleToggleMonth,
    groupExpandModes,
    expandedYears,
    expandedMonths,
    expandedNodeIds,
    expandingNodeIds,
    showContacts,
    showOpportunities,
    showSalesOrders,
    showProjects,
    setNodes,
    setEdges,
  ]);

  useEffect(() => {
    if (!rawGraphData || !rawGraphData.nodes || !rawGraphData.edges) return;

    const { newNodes, newEdges } = processPayload(
      rawGraphData,
      handleExpand,
      handleSetGroupExpandMode,
      handleToggleYear,
      handleToggleMonth,
      groupExpandModes,
      expandedYears,
      expandedMonths,
      expandedNodeIds,
      expandingNodeIds,
      {
        showContacts,
        showOpportunities,
        showSalesOrders,
        showProjects,
      }
    );
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(newNodes, newEdges);

    setNodes(layoutedNodes);
    setEdges(layoutedEdges);

    setTimeout(() => {
      reactFlowInstance.current?.fitView({ padding: 0.2, duration: 400 });
    }, 50);

  }, [
    rawGraphData,
    processPayload,
    handleExpand,
    handleSetGroupExpandMode,
    handleToggleYear,
    handleToggleMonth,
    groupExpandModes,
    expandedYears,
    expandedMonths,
    expandedNodeIds,
    expandingNodeIds,
    showContacts,
    showOpportunities,
    showSalesOrders,
    showProjects,
    setNodes,
    setEdges,
  ]);

  return (
    <div className="lg:h-full flex flex-col relative p-4 lg:p-6">
      <div className="relative lg:h-full flex flex-col min-h-0">
        <div className="flex-1 lg:min-h-0 flex flex-col z-10 lg:bg-[var(--bg-card)] lg:rounded-xl lg:border lg:border-[var(--border)] lg:overflow-hidden transition-all">
          
          {/* Header & Controls Toolbar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between lg:px-6 py-3 px-4 gap-3 border-b border-[var(--border)] bg-[var(--bg-card)]">
            <div className="flex items-center gap-4 min-w-0">
              <h2 className="text-[1.3rem] font-bold tracking-tight text-[var(--text-primary)] truncate min-w-0">
                CRM Map
              </h2>
            </div>

            {/* Controls aligned together */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Center on Organization */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-secondary)] whitespace-nowrap hidden sm:inline">
                  Center on:
                </span>
                <div className="w-56 sm:w-64">
                  <OrganizationSelect 
                    value={focalNodeId}
                    initialSearchTerm={focalOrgName}
                    onChange={(org: Organization | null) => setFocalNodeId(org?.organizationId || '')}
                    placeholder="Search organization..."
                  />
                </div>
                {focalNodeId ? (
                  <Button variant="ghost" size="sm" onClick={() => setFocalNodeId('')} title="Clear focal organization">
                    Clear
                  </Button>
                ) : null}
              </div>

              <div className="hidden sm:block h-5 w-px bg-[var(--border)] shrink-0" />

              {/* Layer Visibility Toggles */}
              <div className="flex flex-wrap items-center gap-2">
                <LayerToggle
                  label="Contacts"
                  icon="👤"
                  checked={showContacts}
                  onChange={setShowContacts}
                />
                <LayerToggle
                  label="Opportunities"
                  icon="📈"
                  checked={showOpportunities}
                  onChange={setShowOpportunities}
                  activeColorClass="bg-purple-500"
                />
                <LayerToggle
                  label="Sales Orders"
                  icon="🛒"
                  checked={showSalesOrders}
                  onChange={setShowSalesOrders}
                  activeColorClass="bg-emerald-500"
                />
                <LayerToggle
                  label="Projects"
                  icon="📁"
                  checked={showProjects}
                  onChange={setShowProjects}
                  activeColorClass="bg-amber-500"
                />
              </div>

              <div className="hidden sm:block h-5 w-px bg-[var(--border)] shrink-0" />

              {/* Re-layout Button */}
              <Button
                variant="secondary"
                size="sm"
                icon="hub"
                onClick={handleRelayout}
                disabled={nodes.length === 0}
                title="Re-calculate layout and center view"
              >
                Re-layout
              </Button>
            </div>
          </div>

          {/* Canvas Map Viewport */}
          <div className="flex-1 min-h-0 w-full relative bg-[var(--bg-secondary)]">
            {!focalNodeId ? (
              <div className="flex h-full items-center justify-center text-[var(--text-muted)] text-sm">
                Search and select an Organization above to view their relationship map.
              </div>
            ) : error ? (
              <div className="flex flex-col h-full items-center justify-center text-[var(--danger)]">
                <div>Error loading map data</div>
                <div className="text-xs mt-2 opacity-75">{error.message || String(error)}</div>
              </div>
            ) : isLoading ? (
              <div className="flex h-full items-center justify-center text-[var(--text-muted)] text-sm">
                Loading Map Data...
              </div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                nodeTypes={nodeTypes}
                onInit={(instance) => {
                  reactFlowInstance.current = instance;
                }}
                fitView
                className="bg-[var(--bg-primary)]"
              >
                <Background color="var(--border)" gap={16} />
                <Controls className="!bg-[var(--bg-card)] !border-[var(--border)] !shadow-xl !rounded-lg overflow-hidden" />
                <MiniMap 
                  className="!bg-[var(--bg-card)] !border-[var(--border)] !shadow-xl !rounded-lg overflow-hidden" 
                  zoomable 
                  pannable 
                  maskColor="rgba(0, 0, 0, 0.6)"
                />
              </ReactFlow>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
