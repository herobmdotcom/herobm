export type DisplayDensity = 'comfortable' | 'compact';

export interface UserPreferences {
  density?: DisplayDensity;
  defaultLandingPage?: string;
  tablePageSize?: number;
  [key: string]: unknown;
}
