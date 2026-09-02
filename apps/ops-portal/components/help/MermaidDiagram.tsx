'use client';

import React, { useEffect, useId, useState, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/shared/Button';

interface MermaidDiagramProps {
  chart: string;
}

function extractSvgDimensions(svgString: string): { width: number; height: number } {
  const vb = svgString.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s+([\d.-]+)\s*["']/i);
  if (vb && parseFloat(vb[3]) > 0 && parseFloat(vb[4]) > 0) {
    return { width: parseFloat(vb[3]), height: parseFloat(vb[4]) };
  }
  const w = svgString.match(/width=["']([\d.-]+)(?:px)?["']/i);
  const h = svgString.match(/height=["']([\d.-]+)(?:px)?["']/i);
  if (w && h && parseFloat(w[1]) > 0 && parseFloat(h[1]) > 0) {
    return { width: parseFloat(w[1]), height: parseFloat(h[1]) };
  }
  return { width: 900, height: 500 };
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const t = useTranslations('help');
  const uniqueId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [svg, setSvg] = useState<string>('');
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>({ width: 900, height: 500 });
  const [error, setError] = useState<string | null>(null);
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof document === 'undefined') return false;
    return document.documentElement.classList.contains('dark');
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains('dark');
      setIsDarkMode((prev) => (prev !== isDark ? isDark : prev));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let isMounted = true;

    if (process.env.NODE_ENV === 'test') {
      const mockSvg = `<div data-testid="mermaid-test-output" class="font-mono text-xs text-[#475569] p-2 whitespace-pre">${chart.trim()}</div>`;
      setSvg(mockSvg);
      setDimensions({ width: 600, height: 300 });
      return;
    }

    async function renderChart() {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic mermaid ESM import
        const mermaidModule = (await import('mermaid' as any)) as any;
        // Handle ESM default vs named export
        const mermaid = mermaidModule.default ?? mermaidModule;

        if (typeof mermaid?.initialize === 'function') {
          mermaid.initialize({
            startOnLoad: false,
            theme: isDarkMode ? 'dark' : 'neutral',
            themeVariables: isDarkMode
              ? {
                  darkMode: true,
                  background: '#080d16',
                  primaryColor: '#141d30',
                  primaryBorderColor: '#00b49c',
                  primaryTextColor: '#f8fafc',
                  lineColor: '#94a3b8',
                  secondaryColor: '#101726',
                  tertiaryColor: '#080d16',
                  edgeLabelBackground: '#101726',
                  nodeBorder: '#00b49c',
                  mainBkg: '#141d30',
                  textColor: '#f8fafc',
                  fontSize: '12px',
                  fontFamily: 'inherit',
                }
              : {
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
        }

        if (typeof mermaid?.render === 'function') {
          const renderId = `mermaid-${uniqueId}-${Math.random().toString(36).substring(2, 7)}`;
          const { svg: renderedSvg } = await mermaid.render(renderId, chart.trim());
          if (isMounted) {
            setSvg(renderedSvg);
            setDimensions(extractSvgDimensions(renderedSvg));
            setError(null);
          }
        } else {
          // Fallback if environment doesn't support rendering (e.g. node/jest)
          if (isMounted) {
            const fallback = `<div class="font-mono text-xs text-[var(--text-muted)] p-2 whitespace-pre">${chart.trim()}</div>`;
            setSvg(fallback);
            setDimensions({ width: 600, height: 300 });
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
  }, [chart, uniqueId, isDarkMode]);

  const calculateFitZoom = useCallback(() => {
    if (!containerRef.current) return 1;
    const container = containerRef.current;
    if (!container.clientWidth || !container.clientHeight) return 1;

    const natW = dimensions.width || 900;
    const natH = dimensions.height || 500;

    // Available space subtracting container padding and margins
    const availW = Math.max(100, container.clientWidth - 48);
    const availH = Math.max(100, container.clientHeight - 48);

    const scale = Math.min(availW / natW, availH / natH);
    const clamped = Math.max(0.2, Math.min(2.5, Math.round(scale * 100) / 100));
    return clamped;
  }, [dimensions]);

  // Compute zoom-to-fit when enlarged modal opens or on window resize
  useEffect(() => {
    if (!isEnlarged) return;

    let timer: NodeJS.Timeout;
    const applyFit = () => {
      const fit = calculateFitZoom();
      setFitZoom(fit);
      setZoomLevel(fit);
    };

    // Apply fit immediately and on layout render
    applyFit();
    const frame = requestAnimationFrame(applyFit);

    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(applyFit, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
    };
  }, [isEnlarged, calculateFitZoom]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel((prev) => Math.min(3, Math.round((prev + 0.25) * 100) / 100));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel((prev) => Math.max(0.3, Math.round((prev - 0.25) * 100) / 100));
  }, []);

  const handleFitToScreen = useCallback(() => {
    const fit = calculateFitZoom();
    setFitZoom(fit);
    setZoomLevel(fit);
  }, [calculateFitZoom]);

  const handleResetTo100 = useCallback(() => {
    setZoomLevel(1);
  }, []);

  const handleClose = useCallback(() => {
    setIsEnlarged(false);
    setZoomLevel(1);
  }, []);

  useEffect(() => {
    if (!isEnlarged) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key === '0') {
        e.preventDefault();
        handleFitToScreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnlarged, handleClose, handleZoomIn, handleZoomOut, handleFitToScreen]);

  if (error) {
    return (
      <div className="my-3 p-3 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] font-mono text-xs text-[var(--text-secondary)] overflow-x-auto whitespace-pre">
        {chart.trim()}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-3 p-4 rounded-xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center text-xs text-[var(--text-muted)] animate-pulse min-h-[80px]">
        {t('loadingDocs')}
      </div>
    );
  }

  return (
    <>
      {/* Click-to-enlarge Diagram Card */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          setIsEnlarged(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsEnlarged(true);
          }
        }}
        className="group relative my-4 p-4 rounded-xl bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] hover:border-[var(--accent)] transition-all overflow-hidden flex flex-col items-center shadow-xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
        title={t('clickToEnlarge')}
        aria-label={t('enlargeDiagram')}
      >
        {/* Hover / Click to Enlarge Badge */}
        <div className="absolute top-2.5 right-2.5 opacity-70 group-hover:opacity-100 transition-opacity bg-[var(--bg-card)]/90 group-hover:bg-[var(--accent)]/10 border border-[var(--border)] group-hover:border-[var(--accent)] text-[var(--text-muted)] group-hover:text-[var(--accent)] px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 shadow-xs pointer-events-none">
          {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
          <span className="material-symbols-outlined text-[14px]">fullscreen</span>
          <span>{t('clickToEnlarge')}</span>
        </div>

        {/* Embedded SVG */}
        <div
          className="w-full flex justify-center max-w-full overflow-x-auto [&>svg]:max-w-full [&>svg]:h-auto pt-2 pb-1"
          dangerouslySetInnerHTML={{ __html: svg }}
        />
      </div>

      {/* Enlarged Modal View */}
      {isEnlarged && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-6 md:p-10 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150"
          role="dialog"
          aria-modal="true"
          aria-label={t('diagramView')}
          onClick={handleClose}
        >
          <div
            className="relative w-full max-w-6xl h-[88vh] bg-[var(--bg-card)] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-[var(--border)] animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 flex items-center justify-center">
                  {/* eslint-disable-next-line i18next/no-literal-string -- Material UI Icon */}
                  <span className="material-symbols-outlined text-[18px]">schema</span>
                </div>
                <span className="font-bold text-sm text-[var(--text-primary)]">
                  {t('diagramView')}
                </span>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomOut}
                  disabled={zoomLevel <= 0.3}
                  className="w-8 h-8 rounded-lg !p-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] cursor-pointer shadow-none disabled:opacity-40"
                  title={t('zoomOut')}
                  aria-label={t('zoomOut')}
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                </Button>

                <span
                  data-testid="zoom-level-badge"
                  className="text-[11px] font-mono font-semibold text-[var(--text-primary)] px-2 py-1 rounded bg-[var(--bg-secondary)] border border-[var(--border)] min-w-[50px] text-center select-none"
                >
                  {Math.round(zoomLevel * 100)}%
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleZoomIn}
                  disabled={zoomLevel >= 3}
                  className="w-8 h-8 rounded-lg !p-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] cursor-pointer shadow-none disabled:opacity-40"
                  title={t('zoomIn')}
                  aria-label={t('zoomIn')}
                >
                  <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleFitToScreen}
                  disabled={Math.abs(zoomLevel - fitZoom) < 0.01}
                  className="px-2 py-1 h-8 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] cursor-pointer shadow-none disabled:opacity-40 flex items-center gap-1"
                  title={t('fitToScreen')}
                  aria-label={t('fitToScreen')}
                >
                  <span className="material-symbols-outlined text-[16px]">fit_screen</span>
                  <span className="hidden sm:inline">{t('fitToScreen')}</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleResetTo100}
                  disabled={Math.abs(zoomLevel - 1) < 0.01}
                  className="px-2 py-1 h-8 rounded-lg text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] cursor-pointer shadow-none disabled:opacity-40 flex items-center gap-1"
                  title={t('resetZoom')}
                  aria-label={t('resetZoom')}
                >
                  <span className="material-symbols-outlined text-[16px]">restart_alt</span>
                  <span className="hidden sm:inline">100%</span>
                </Button>

                <div className="w-[1px] h-5 bg-[var(--border)] mx-1" />

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClose}
                  className="w-8 h-8 rounded-lg !p-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] cursor-pointer shadow-none"
                  title={t('closeDiagram')}
                  aria-label={t('closeDiagram')}
                >
                  <span className="material-symbols-outlined text-[20px]">close</span>
                </Button>
              </div>
            </div>

            {/* Modal Body / Pan Canvas */}
            <div
              ref={containerRef}
              className="flex-1 overflow-auto p-4 sm:p-8 flex items-center justify-center bg-[var(--bg-primary)]"
            >
              <div
                ref={contentRef}
                /* inline-style-allowed: Dynamic zoom scaling and SVG dimensions */
                style={{
                  width: dimensions.width > 0 ? `${dimensions.width}px` : 'auto',
                  height: dimensions.height > 0 ? `${dimensions.height}px` : 'auto',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 0.15s ease-out',
                }}
                className="shrink-0 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full [&>svg]:max-w-none shadow-sm rounded-xl p-6 bg-[var(--bg-card)] border border-[var(--border)]"
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
