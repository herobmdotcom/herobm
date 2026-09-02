export type DisplayDensity = 'comfortable' | 'compact';
export type ThemeMode = 'system' | 'light' | 'dark';

export interface UserPreferences {
  theme?: ThemeMode;
  density?: DisplayDensity;
  defaultLandingPage?: string;
  tablePageSize?: number;
  [key: string]: unknown;
}

