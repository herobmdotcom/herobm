import { useMemo } from 'react';

export type FallbackOption = {
  value: any;
  sourceLabel: string;
};

export function useInheritance(fallbacks: FallbackOption[]) {
  return useMemo(() => {
    // Find the first fallback that has a valid truthy value
    const resolved = fallbacks.find(
      (f) => f.value !== null && f.value !== undefined && f.value !== ''
    );
    
    return {
      inheritedValue: resolved?.value !== undefined ? (resolved.value as any) : null,
      inheritedSourceLabel: resolved?.sourceLabel || null,
    };
  }, [fallbacks]);
}

/**
 * Robustly finds a group in an array regardless of whether the API
 * returned an unmapped raw Drizzle object (e.g. `productGroupId`) 
 * or a mapped SDK object (`id`).
 */
export type GroupLike = Record<string, any>;

export function useGroup<T extends object = any>(
  groups: T[] | undefined | null,
  groupId: string | null | undefined,
): any {
  return useMemo(() => {
    if (!groupId || !groups?.length) return null;

    return (
      (groups.find(
        (g: any) =>
          g.id === groupId ||
          g.productGroupId === groupId ||
          g.supplierGroupId === groupId ||
          g.customerGroupId === groupId,
      ) as any) || null
    );
  }, [groups, groupId]);
}
