'use client';

import React, { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { reportError } from '@/lib/api';
import * as api from '@herobm/sdk';

interface CodesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface CoaNode {
  accountId: string;
  accountCode: string;
  name: string;
  accountType: string;
  isGroup: boolean;
  children: CoaNode[];
}

interface CostCenter {
  costCenterId: string;
  code: string;
  name: string;
  isActive: boolean;
}

interface Activity {
  activityId: string;
  code: string;
  name: string;
  isActive: boolean;
}

export default function CodesModal({ isOpen, onClose }: CodesModalProps) {
  const t = useTranslations('gl.codes');
  const tCommon = useTranslations('common');

  const [coa, setCoa] = useState<CoaNode[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  const exportToCsv = () => {
    const rows: string[][] = [];
    
    // CSV Header
    rows.push(['Section', 'Code', 'Name', 'Type/Status', 'Depth']);
    
    // Chart of Accounts Section
    rows.push([t('columns.chartOfAccounts'), '', '', '', '']);
    const flattenCoa = (nodes: CoaNode[], depth = 0) => {
      for (const node of nodes) {
        rows.push([
          'Account',
          node.accountCode,
          node.name,
          node.accountType + (node.isGroup ? ' (Group)' : ''),
          String(depth)
        ]);
        if (node.children && node.children.length > 0) {
          flattenCoa(node.children, depth + 1);
        }
      }
    };
    flattenCoa(coa);
    
    rows.push(['', '', '', '', '']); // Spacer
    
    // Cost Centers Section
    rows.push([t('columns.costCenters'), '', '', '', '']);
    for (const cc of costCenters) {
      rows.push([
        'Cost Center',
        cc.code,
        cc.name,
        cc.isActive ? 'Active' : 'Inactive',
        ''
      ]);
    }
    
    rows.push(['', '', '', '', '']); // Spacer
    
    // Activities Section
    rows.push([t('columns.activities'), '', '', '', '']);
    for (const act of activities) {
      rows.push([
        'Activity',
        act.code,
        act.name,
        act.isActive ? 'Active' : 'Inactive',
        ''
      ]);
    }
    
    const escapeCsv = (val: string) => {
      if (val.includes(',') || val.includes('"') || val.includes('\n')) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val;
    };
    
    const csvContent = rows.map(row => row.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `accounting_codes_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [selectedCc, setSelectedCc] = useState<string>('');
  const [selectedAct, setSelectedAct] = useState<string>('');

  const fullCode = [
    selectedAccount || '0000',
    selectedCc || '00',
    selectedAct || '00'
  ].join('.');

  const copyToClipboard = () => {
    navigator.clipboard.writeText(fullCode);
  };

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    Promise.all([
      api.glControllerGetAccounts({ format: 'tree' }).then(res => res.data as unknown as CoaNode[]),
      api.costCentersControllerFindAll().then(res => res.data as unknown as CostCenter[]),
      api.activitiesControllerFindAll().then(res => res.data as unknown as Activity[]),
    ])
      .then(([coaData, ccData, actData]) => {
        setCoa(coaData);
        setCostCenters(ccData);
        setActivities(actData);
      })
      .catch((err) => reportError(err, 'CodesModal'))
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  function renderCoaTree(nodes: CoaNode[], depth = 0) {
    return nodes.map((node) => (
      <React.Fragment key={node.accountId || node.accountCode}>
        <tr 
          onClick={() => !node.isGroup && setSelectedAccount(node.accountCode)}
          className={`
 transition-colors border-b border-[var(--border)] last:border-0 cursor-pointer
 ${selectedAccount === node.accountCode ? 'bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card-hover)]/50'}
 `}
        >
          <td className={`px-3 py-1.5 font-mono text-[11px] w-20 shrink-0 ${selectedAccount === node.accountCode ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-muted)]'}`}>
            {node.accountCode}
          </td>
          <td className={`px-3 py-1.5 text-xs ${selectedAccount === node.accountCode ? 'font-bold text-[var(--text-primary)]' : 'font-medium text-[var(--text-secondary)]'}`} style={{ paddingLeft: `${depth * 1.25 + 0.75}rem` }}>
             {node.isGroup ? <span className="uppercase text-[9px] font-bold opacity-40 bg-gray-100 px-1 rounded mr-2 border border-gray-200">{t('group')}</span> : null}
             {node.name}
          </td>
        </tr>
        {node.children && renderCoaTree(node.children, depth + 1)}
      </React.Fragment>
    ));
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-[#041627]/40 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />
      
      {/* Modal Container */}
      <div className="relative bg-white w-full max-w-6xl h-[85vh] rounded-2xl border border-[var(--border)] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-3 items-center px-8 py-5 border-b border-[var(--border)] shrink-0 bg-white">
          
          {/* Left: Title & Icon */}
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-[var(--bg-primary)] flex items-center justify-center shrink-0">
              { }
              <span className="material-symbols-outlined text-[var(--accent)]">menu_book</span>
            </div>
            <h2 className="text-xl font-bold text-[var(--text-primary)] truncate" style={{ fontFamily: 'Manrope, sans-serif' }}>
              {t('accountingCodes')}
            </h2>
          </div>

          {/* Center: Generated Code */}
          <div className="flex justify-center items-center gap-4">
            <span className="font-mono text-xl font-bold text-[var(--accent)] tracking-[0.2em] leading-none select-all">
              {fullCode}
            </span>
            <button 
              onClick={copyToClipboard}
              className="flex items-center justify-center p-1.5 hover:bg-[var(--bg-primary)] rounded-lg transition-all text-[var(--text-muted)] hover:text-[var(--accent)] active:scale-90"
              title="Copy to clipboard"
            >
              { }
              <span className="material-symbols-outlined text-xl !leading-none">content_copy</span>
            </button>
          </div>

          {/* Right: Close Button */}
          <div className="flex justify-end items-center gap-3">
            <button 
              onClick={exportToCsv}
              className="flex items-center justify-center p-2 hover:bg-[var(--bg-primary)] rounded-lg transition-all text-[var(--text-muted)] hover:text-[var(--accent)] active:scale-90"
              title={t('exportCsv')}
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exception for Material Symbol icon name */}
              <span className="material-symbols-outlined text-xl !leading-none">download</span>
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-primary)] transition-all text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exception for Material Symbol icon name */}
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-hidden flex gap-0 bg-[var(--bg-primary)]">
          
          {/* Column 1: Chart of Accounts */}
          <div className="flex-1 border-r border-[var(--border)] flex flex-col min-w-0 bg-white">
             <div className="px-5 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t('columns.chartOfAccounts')}
                </span>
             </div>
             <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
                    <span className="loading loading-spinner loading-md"></span>
                    <span className="text-xs font-medium uppercase tracking-widest">{tCommon('loading')}</span>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <tbody>
                      {renderCoaTree(coa)}
                    </tbody>
                  </table>
                )}
             </div>
          </div>

          {/* Column 2: Cost Centers */}
          <div className="w-72 border-r border-[var(--border)] flex flex-col shrink-0 bg-white">
             <div className="px-5 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t('columns.costCenters')}
                </span>
             </div>
             <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full opacity-40">
                    <span className="loading loading-spinner loading-sm"></span>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-[var(--border)]/40">
                      {costCenters.map(cc => (
                        <tr 
                          key={cc.costCenterId || cc.code} 
                          onClick={() => setSelectedCc(cc.code)}
                          className={`
 transition-colors cursor-pointer
 ${selectedCc === cc.code ? 'bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card-hover)]/50'}
 ${!cc.isActive ? 'opacity-40' : ''}
 `}
                        >
                          <td className={`px-4 py-2 font-mono text-[11px] w-16 ${selectedCc === cc.code ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-muted)]'}`}>{cc.code}</td>
                          <td className={`px-4 py-2 text-xs ${selectedCc === cc.code ? 'font-bold text-[var(--text-primary)]' : !cc.isActive ? 'text-[var(--text-muted)] italic' : 'font-medium text-[var(--text-secondary)]'}`}>{cc.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
             </div>
          </div>

          {/* Column 3: Activities */}
          <div className="w-72 flex flex-col shrink-0 bg-white">
             <div className="px-5 py-3 bg-[var(--bg-secondary)] border-b border-[var(--border)] shrink-0">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-widest" style={{ fontFamily: 'Manrope, sans-serif' }}>
                  {t('columns.activities')}
                </span>
             </div>
             <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-full opacity-40">
                    <span className="loading loading-spinner loading-sm"></span>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <tbody className="divide-y divide-[var(--border)]/40">
                      {activities.map(act => (
                        <tr 
                          key={act.activityId || act.code} 
                          onClick={() => setSelectedAct(act.code)}
                          className={`
 transition-colors cursor-pointer
 ${selectedAct === act.code ? 'bg-[var(--bg-card-hover)]' : 'hover:bg-[var(--bg-card-hover)]/50'}
 ${!act.isActive ? 'opacity-40' : ''}
 `}
                        >
                          <td className={`px-4 py-2 font-mono text-[11px] w-16 ${selectedAct === act.code ? 'text-[var(--accent)] font-bold' : 'text-[var(--text-muted)]'}`}>{act.code}</td>
                          <td className={`px-4 py-2 text-xs ${selectedAct === act.code ? 'font-bold text-[var(--text-primary)]' : !act.isActive ? 'text-[var(--text-muted)] italic' : 'font-medium text-[var(--text-secondary)]'}`}>{act.name}</td>
                        </tr>
                      ))}
                    </tbody>
                    </table>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}
