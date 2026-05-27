import { getSdkConfig } from './config';

/**
 * Standardized API Error class matching the backend error shape.
 */
export class SdkApiError extends Error {
  public status: number;
  public data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = 'SdkApiError';
  }
}

/**
 * Custom fetch mutator for Orval.
 * Automatically injects the Base URL and JWT Authorization header.
 * Handles 401 status codes securely.
 */
export const customFetch = async <T>(
  url: string,
  options: RequestInit
): Promise<T> => {
  const sdkConfig = getSdkConfig();
  const token = sdkConfig.getToken();

  const headers = new Headers(options.headers);

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Ensure content-type is set for JSON payloads
  if (options.method !== 'GET' && options.method !== 'DELETE' && options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const fullUrl = `${sdkConfig.baseUrl}${url}`;

  const response = await fetch(fullUrl, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    sdkConfig.onUnauthorized();
  }

  if (!response.ok) {
    let errData;
    const text = await response.text().catch(() => '');
    try {
      errData = text ? JSON.parse(text) : null;
    } catch {
      errData = { message: text };
    }
    
    const error = new SdkApiError(
      errData?.message ?? `API error: ${response.status}`,
      response.status,
      errData
    );
    
    sdkConfig.onError(error);
    throw error;
  }

  const contentLength = response.headers.get('content-length');
  const isEmpty = response.status === 204 || contentLength === '0';
  
  let data: any = undefined;
  if (!isEmpty) {
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream') || contentType.includes('image/') || contentType.includes('application/zip')) {
      data = await response.blob();
    } else {
      const text = await response.text();
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = text;
        }
      }
    }
  }

  return {
    data,
    status: response.status,
    headers: response.headers,
  } as unknown as T;
};
