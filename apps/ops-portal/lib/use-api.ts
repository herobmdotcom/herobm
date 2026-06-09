import useSWR, { SWRConfiguration, SWRResponse } from 'swr';
import { reportError } from './api';

/**
 * A custom hook wrapping SWR for standardized data fetching and caching using the OpenAPI SDK.
 * 
 * @param key The cache key (can be an array, string, or null to pause fetching)
 * @param fetcher The SDK function returning a Promise with { data: T }
 * @param config Optional SWR configuration
 */
export function useApi<T, E = any>(
  key: string | any[] | null,
  fetcher: () => Promise<{ data: T }>,
  config?: SWRConfiguration<T, E>
): SWRResponse<T, E> {
  return useSWR<T, E>(
    key,
    async () => {
      const res = await fetcher();
      return res.data;
    },
    {
      onError: (err) => reportError(err, 'useApi'),
      revalidateOnFocus: false, // Turn off by default to prevent API spam, can be overridden per hook
      shouldRetryOnError: false, // Let the caller decide if it wants to retry
      ...config,
    }
  );
}
