/**
 * Safely translate a dynamic key with a human-readable fallback.
 *
 * next-intl's `useTranslations` returns a strongly-typed `t` function whose
 * key parameter is a union of every literal key in the message bundle.  When
 * the key is only known at runtime (e.g. `states.${state}`) TypeScript
 * cannot verify it, so we must cast through `any`.
 *
 * This helper encapsulates that cast in one place and adds a `t.has()` guard
 * so that unknown keys fall back to a capitalised version of the raw value
 * instead of crashing or returning a missing-key placeholder.
 *
 * @param t        – translator returned by `useTranslations`
 * @param key      – the dynamic key (e.g. `"states.draft"`)
 * @param fallback – optional fallback; defaults to the last segment of `key`,
 *                   capitalised.
 * @param values   – optional ICU interpolation values (e.g. `{ actor: "Bob" }`)
 */
export function tDynamic(
  t: { has: (key: any) => boolean } & ((...args: any[]) => string),
  key: string,
  fallback?: string,
  values?: Record<string, string>,
): string {
  if (t.has(key)) {
    return values
      ? (t as (k: string, v: Record<string, string>) => string)(key, values)
      : (t as (k: string) => string)(key);
  }
  if (fallback !== undefined) return fallback;
  // Auto-fallback: take last segment, replace underscores, capitalise first letter
  const lastSegment = key.includes('.') ? key.slice(key.lastIndexOf('.') + 1) : key;
  return lastSegment.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}
