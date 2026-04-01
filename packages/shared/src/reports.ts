import reportsConfig from '../reports-config.json';

export interface ReportDefinition {
  id: string;
  slug: string;
  name: string;
  filename: string;
  output_name_pattern: string;
  hook?: string;
  context: string;
  type: 'hook' | 'internal';
}

export const SYSTEM_REPORTS = reportsConfig.reports as ReportDefinition[];

export const PUBLIC_REPORT_HOOKS = SYSTEM_REPORTS.filter(r => r.type === 'hook');

export const getReportByHook = (hookSlug: string) => 
  PUBLIC_REPORT_HOOKS.find(r => r.hook === hookSlug);

export const getReportBySlug = (slug: string) => 
  SYSTEM_REPORTS.find(r => r.slug === slug);
