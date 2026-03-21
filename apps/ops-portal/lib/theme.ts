/**
 * Volz Portal Theme — TypeScript Token Export
 *
 * Mirrors the CSS custom properties in theme.css for programmatic use
 * (charting libraries, dynamic styles, etc.). Always keep in sync.
 */

export const theme = {
  /* Backgrounds */
  bgPrimary: '#0B1221',
  bgSecondary: '#0F1A2E',
  bgCard: '#142236',
  bgCardHover: '#1B2D47',

  /* Borders */
  border: '#1E3A5F',

  /* Text */
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  /* Accent (Volz Orange) */
  accent: '#EE7F00',
  accentHover: '#F59E42',
  accentGlow: 'rgba(238, 127, 0, 0.15)',

  /* Brand Secondary (Volz Blue) */
  brandBlue: '#003A80',
  brandNavy: '#1A467F',

  /* Semantic */
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
} as const;

export type Theme = typeof theme;
