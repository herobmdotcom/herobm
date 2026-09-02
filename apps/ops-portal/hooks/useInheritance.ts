import { useMemo } from 'react';

export type FallbackOption = {
  value: string | number | null | undefined;
  sourceLabel: string;
};

export function useInheritance(fallbacks: FallbackOption[]) {
  return useMemo(() => {
    // Find the first fallback that has a valid truthy value
    const resolved = fallbacks.find(
      (f) => f.value !== null && f.value !== undefined && f.value !== ''
    );
    
    return {
      inheritedValue: resolved?.value || null,
      inheritedSourceLabel: resolved?.sourceLabel || null,
    };
  }, [fallbacks]);
}

/**
 * Robustly finds a group in an array regardless of whether the API
 * returned an unmapped raw Drizzle object (e.g. `productGroupId`) 
 * or a mapped SDK object (`id`).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useGroup<T = any>(groups: T[], groupId: string | null | undefined): T | null {
  return useMemo(() => {
    if (!groupId || !groups?.length) return null;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return groups.find((g: any) => 
      g.id === groupId || 
      g.productGroupId === groupId || 
      g.supplierGroupId === groupId || 
      g.customerGroupId === groupId
    ) || null;
  }, [groups, groupId]);
}
