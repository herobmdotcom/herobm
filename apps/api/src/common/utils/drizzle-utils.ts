/**
 * Helper utility to build update payloads for Drizzle ORM.
 *
 * Drizzle natively ignores `undefined` values during updates, meaning you can often pass the DTO directly:
 * `.set(dto)`
 *
 * However, if you need to ensure a clean payload stripped of undefined properties before mixing
 * it with other logic, or to strictly enforce types without casting, you can use this helper.
 *
 * @param dto The data transfer object containing update values
 * @returns A strictly typed Partial<T> with undefined properties removed
 */
export function buildUpdatePayload<T extends object>(dto: T): Partial<T> {
  const payload: Partial<T> = {};
  for (const [key, value] of Object.entries(dto)) {
    if (value !== undefined) {
      payload[key as keyof T] = value as T[keyof T];
    }
  }
  return payload;
}
