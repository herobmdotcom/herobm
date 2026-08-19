'use client';

import React, { useEffect, useId, useState } from 'react';

interface MermaidDiagramProps {
  chart: string;
}

let isMermaidInitialized = false;

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function renderChart() {
      try {
        const mermaidModule = await import('mermaid');
        // Handle ESM default vs named export
        const mermaid = mermaidModule.default ?? mermaidModule;

        if (typeof mermaid?.initialize === 'function' && !isMermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: 'neutral',
            themeVariables: {
              primaryColor: '#F0FDFA',
              primaryBorderColor: '#006B5C',
              primaryTextColor: '#0F172A',
              lineColor: '#64748B',
              secondaryColor: '#F8FAFC',
              tertiaryColor: '#FFFFFF',
              fontSize: '12px',
              fontFamily: 'inherit',
            },
            securityLevel: 'loose',
          });
          isMermaidInitialized = true;
        }

        if (typeof mermaid?.render === 'function') {
          const renderId = `mermaid-${uniqueId}-${Math.random().toString(36).substring(2, 7)}`;
          const { svg: renderedSvg } = await mermaid.render(renderId, chart.trim());
          if (isMounted) {
            setSvg(renderedSvg);
            setError(null);
          }
        } else {
          // Fallback if environment doesn't support rendering (e.g. node/jest)
          if (isMounted) {
            setSvg(`<div class="font-mono text-xs text-[#475569] p-2 whitespace-pre">${chart.trim()}</div>`);
          }
        }
      } catch (err: unknown) {
        if (isMounted) {
          const message = err instanceof Error ? err.message : 'Failed to render diagram';
          setError(message);
        }
      }
    }

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, uniqueId]);

  if (error) {
    return (
      <div className="my-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] font-mono text-xs text-[#64748B] overflow-x-auto whitespace-pre">
        {chart.trim()}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-xs text-[#94A3B8] animate-pulse min-h-[80px]">
        Loading diagram...
      </div>
    );
  }

  return (
    <div className="my-4 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] overflow-x-auto flex justify-center shadow-xs">
      <div
        className="w-full flex justify-center max-w-full [&>svg]:max-w-full [&>svg]:h-auto"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    </div>
  );
}
