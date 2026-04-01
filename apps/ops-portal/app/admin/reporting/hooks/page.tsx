'use client';

import { useDocumentTitle } from '@/hooks/useDocumentTitle';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { apiFetch, apiMutate, reportError } from '@/lib/api';
import Link from 'next/link';

interface Assignment {
  hookSlug: string;
  reportId: string | null;
  contextSlug: string | null;
  reportName: string | null;
}

interface ReportTemplate {
  id: string;
  name: string;
  contexts: string[];
}

function ReportingHooksRow(props: { 
  assignment: Assignment, 
  templates: ReportTemplate[],
  onUpdate: () => void 
}) {
  const { assignment, templates, onUpdate } = props;
  const [updating, setUpdating] = useState(false);

  // Filter templates to only those that support this hook's context
  const filteredTemplates = useMemo(() => {
    if (!assignment.contextSlug) return templates;
    return templates.filter(t => t.contexts && t.contexts.includes(assignment.contextSlug!));
  }, [templates, assignment.contextSlug]);

  const handleChange = async (newReportId: string) => {
    setUpdating(true);
    try {
      await apiMutate(`/api/reports/hook-assignments/${assignment.hookSlug}`, 'PATCH', { reportId: newReportId });
      onUpdate();
    } catch (e) {
      reportError(e, 'ReportingHooksRow');
      alert('Failed to update assignment: ' + (e as any).message);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <tr>
      <td className="font-mono text-xs">{assignment.hookSlug}</td>
      <td className="text-xs text-gray-500 italic">
        {assignment.contextSlug || '—'}
      </td>
      <td>
        <div className="flex items-center gap-3">
          <select 
            className="select select-sm w-full max-w-md bg-white border-gray-200 text-sm py-1.5 h-auto min-h-0"
            value={assignment.reportId || ''}
            onChange={(e) => handleChange(e.target.value)}
            disabled={updating}
          >
            <option value="" disabled>Select a template...</option>
            {filteredTemplates.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          {updating && <span className="loading loading-spinner loading-xs text-[#006b5c]"></span>}
        </div>
      </td>
      <td style={{ textAlign: 'right' }}>
        {assignment.reportId && (
          <Link 
            href={`/admin/reporting/${assignment.reportId}`}
            className="text-[11px] font-bold text-[#006b5c] hover:underline uppercase tracking-widest"
          >
            Edit Template
          </Link>
        )}
      </td>
    </tr>
  );
}

export default function ReportingHooksPage() {
  useDocumentTitle('Reporting Hooks');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [templates, setTemplates] = useState<ReportTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [assignRes, templRes] = await Promise.all([
        apiFetch<{ data: Assignment[] }>('/api/reports/hook-assignments'),
        apiFetch<{ data: ReportTemplate[] }>('/api/reports')
      ]);
      setAssignments(assignRes.data);
      setTemplates(templRes.data);
    } catch (e) {
      reportError(e, 'ReportingHooksPage');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '20px 0' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Hook Assignments</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            Map standard actions (like printing an invoice) to specific templates.
          </p>
        </div>
      </div>

      <div className="card">
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}
        >
          Hook Mappings
        </h3>
        
        <table className="table-lines w-full">
          <thead>
            <tr>
              <th style={{ width: 250 }}>Hook Slug</th>
              <th style={{ width: 200 }}>Context Resolver</th>
              <th>Assigned Template</th>
              <th style={{ width: 150, textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '30px 0' }}>
                  <span className="loading loading-spinner text-[#006b5c] loading-lg"></span>
                </td>
              </tr>
            ) : assignments.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)' }}>
                  No system hooks registered in the database.
                </td>
              </tr>
            ) : (
              assignments.map(a => (
                <ReportingHooksRow 
                  key={a.hookSlug} 
                  assignment={a} 
                  templates={templates} 
                  onUpdate={loadData}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

