/**
 * Formats a location's code and name consistently for display in dropdowns.
 * Ensures robust fallback behavior if either property is missing.
 */
export function formatLocationDisplay(loc: { code?: string; name?: string; locationNo?: string; locationName?: string }): string {
  // Alias support for product mapping scenarios which sometimes use locationNo/locationName
  const code = loc.code || loc.locationNo;
  const name = loc.name || loc.locationName;

  if (!code && !name) return 'Unknown Location';
  if (!code) return name!;
  if (!name) return code;
  
  return `${code} \u2014 ${name}`;
}
