/**
 * Global SDK configuration.
 */

export interface SdkConfig {
  /** The base URL of the API. Defaults to empty string (relative to current origin). */
  baseUrl: string;
  /** A function that returns the current JWT Bearer token, if available. */
  getToken: () => string | null;
  /** A callback triggered when a 401 Unauthorized response is encountered. */
  onUnauthorized: () => void;
  /** A callback triggered on non-401 API errors. */
  onError: (error: unknown) => void;
}

let config: SdkConfig = {
  baseUrl: '',
  getToken: () => null,
  onUnauthorized: () => {},
  onError: () => {},
};

export function setSdkConfig(newConfig: Partial<SdkConfig>) {
  config = { ...config, ...newConfig };
}

export function getSdkConfig(): SdkConfig {
  return config;
}
