'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartConfig {
  type: 'bar' | 'line';
  xAxisField: string;
  yAxisField: string;
  seriesName: string;
}

interface ReportChartViewerProps {
  data: { data?: unknown[] } | unknown[];
  config: ChartConfig;
  activeDrillDown?: { field: string; [key: string]: unknown };
}

export function ReportChartViewer({ data, config, activeDrillDown }: ReportChartViewerProps) {
  const t = useTranslations('common');
  const chartData = Array.isArray(data) ? data : (data as { data?: unknown[] })?.data || [];

  const pivotedData = useMemo(() => {
    if (!activeDrillDown || activeDrillDown.field === config.xAxisField) {
      const isTimeAxis = config.xAxisField === 'yearMonth' || config.xAxisField.toLowerCase().includes('date') || config.xAxisField.toLowerCase().includes('month');
      
      const sortedData = [...chartData].sort((a: any, b: any) => {
        if (isTimeAxis) {
          return String(a[config.xAxisField] || '').localeCompare(String(b[config.xAxisField] || ''));
        }
        return Number(b[config.yAxisField] || 0) - Number(a[config.yAxisField] || 0);
      });
      return { data: sortedData, seriesKeys: [config.yAxisField], isMultiSeries: false, primaryAxis: config.xAxisField };
    }

    const isTimeDrillDown = activeDrillDown.field === 'yearMonth' || activeDrillDown.field.toLowerCase().includes('date') || activeDrillDown.field.toLowerCase().includes('month');
    const primaryAxis = isTimeDrillDown ? activeDrillDown.field : config.xAxisField;
    const seriesAxis = isTimeDrillDown ? config.xAxisField : activeDrillDown.field;

    const grouped = new Map<string, any>();
    const seriesKeys = new Set<string>();

    chartData.forEach((row: any) => {
      const pVal = String(row[primaryAxis] || 'Unknown');
      const sVal = String(row[seriesAxis] || 'Unknown');
      const yVal = Number(row[config.yAxisField] || 0);

      seriesKeys.add(sVal);

      if (!grouped.has(pVal)) {
        grouped.set(pVal, { [primaryAxis]: pVal });
      }
      const group = grouped.get(pVal);
      group[sVal] = (group[sVal] || 0) + yVal;
    });

    const data = Array.from(grouped.values());
    const seriesKeysArray = Array.from(seriesKeys);
    
    const isPrimaryTimeAxis = primaryAxis === 'yearMonth' || primaryAxis.toLowerCase().includes('date') || primaryAxis.toLowerCase().includes('month');
    
    if (isPrimaryTimeAxis) {
      data.sort((a, b) => String(a[primaryAxis]).localeCompare(String(b[primaryAxis])));
    } else {
      // Sort descending by the sum of all series in the group
      data.sort((a, b) => {
        const sumA = seriesKeysArray.reduce((acc, k) => acc + (Number(a[k]) || 0), 0);
        const sumB = seriesKeysArray.reduce((acc, k) => acc + (Number(b[k]) || 0), 0);
        return sumB - sumA;
      });
    }

    return {
      data,
      seriesKeys: seriesKeysArray,
      isMultiSeries: true,
      primaryAxis
    };
  }, [chartData, activeDrillDown, config]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-white/50 text-[var(--text-muted)]">
        {t('noData')}
      </div>
    );
  }

  if (pivotedData.data.length > 500) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-8 text-center bg-white/50 text-[var(--text-muted)]">
        {/* eslint-disable-next-line i18next/no-literal-string */}
        <span className="material-symbols-outlined text-4xl text-amber-500 mb-2">warning</span>
        <p className="max-w-md">{t('chartTooLarge', { count: pivotedData.data.length })}</p>
      </div>
    );
  }

  const COLORS = ['#0ea5e9', '#f43f5e', '#8b5cf6', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6', '#84cc16', '#6366f1'];

  const renderChart = () => {
    const { data, seriesKeys, isMultiSeries, primaryAxis } = pivotedData;
    const xKey = primaryAxis;

    if (config.type === 'line') {
      return (
        <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(196,198,205,0.4)" />
          <XAxis dataKey={xKey} type="category" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip 
            contentStyle={{ borderRadius: '8px', border: '1px solid rgba(196,198,205,0.4)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          />
          <Legend wrapperStyle={{ paddingTop: '20px' }} />
          
          {isMultiSeries ? (
            seriesKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} name={key} stroke={COLORS[i % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
            ))
          ) : (
            <Line type="monotone" dataKey={config.yAxisField} name={config.seriesName} stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
          )}
        </LineChart>
      );
    }

    // Default to Bar
    return (
      <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(196,198,205,0.4)" />
        <XAxis dataKey={xKey} type="category" tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip 
          contentStyle={{ borderRadius: '8px', border: '1px solid rgba(196,198,205,0.4)', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
          cursor={{ fill: 'rgba(196,198,205,0.1)' }}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        
        {isMultiSeries ? (
          seriesKeys.map((key, i) => (
            <Bar key={key} dataKey={key} name={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={60} />
          ))
        ) : (
          <Bar dataKey={config.yAxisField} name={config.seriesName} fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={60} />
        )}
      </BarChart>
    );
  };

  return (
    <div className="w-full h-full min-h-[400px] p-4 bg-white">
      <ResponsiveContainer width="100%" height="100%">
        {renderChart()}
      </ResponsiveContainer>
    </div>
  );
}
