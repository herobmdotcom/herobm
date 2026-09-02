export enum AuditMode {
  FULL = 'FULL',
  DIFF = 'DIFF',
}

export interface AuditTrail {
  changes: Record<string, unknown>;
  previousValues: Record<string, unknown>;
  hasChanges: boolean;
}

/**
 * Compares a DTO with an existing record and returns an audit trail object.
 *
 * @param dto The changes being applied
 * @param existing The current state of the record
 * @param mode AuditMode.DIFF (only log actual changes) or AuditMode.FULL (log everything in DTO)
 */
export function calculateAuditTrail<T extends object, U extends object>(
  dto: T,
  existing: U,
  mode: AuditMode = AuditMode.DIFF,
): AuditTrail {
  const changes: Record<string, unknown> = {};
  const previousValues: Record<string, unknown> = {};
  let hasChanges = false;

  const existingRecord = existing as unknown as Record<string, unknown>;

  for (const [key, value] of Object.entries(dto)) {
    const original = existingRecord[key];

    let isDifferent = false;
    if (typeof value === 'object' && value !== null) {
      isDifferent = JSON.stringify(value) !== JSON.stringify(original);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- required for unknown original object
      isDifferent = String(value ?? '') !== String((original as any) ?? '');
    }

    if (mode === AuditMode.FULL || isDifferent) {
      changes[key] = value;
      previousValues[key] = original;
      if (isDifferent) hasChanges = true;
    }
  }

  return {
    changes,
    previousValues,
    hasChanges:
      mode === AuditMode.FULL
        ? Object.keys(dto as Record<string, unknown>).length > 0
        : hasChanges,
  };
}
