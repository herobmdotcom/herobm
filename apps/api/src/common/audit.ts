export enum AuditMode {
  FULL = 'FULL',
  DIFF = 'DIFF',
}

export interface AuditTrail {
  changes: Record<string, any>;
  previousValues: Record<string, any>;
  hasChanges: boolean;
}

/**
 * Compares a DTO with an existing record and returns an audit trail object.
 *
 * @param dto The changes being applied
 * @param existing The current state of the record
 * @param mode AuditMode.DIFF (only log actual changes) or AuditMode.FULL (log everything in DTO)
 */
export function calculateAuditTrail(
  dto: Record<string, any>,
  existing: Record<string, any>,
  mode: AuditMode = AuditMode.DIFF,
): AuditTrail {
  const changes: Record<string, any> = {};
  const previousValues: Record<string, any> = {};
  let hasChanges = false;

  for (const [key, value] of Object.entries(dto)) {
    const original = existing[key];

    // Normalized comparison (handles null vs undefined vs empty string)
    const isDifferent = String(value ?? '') !== String(original ?? '');

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
      mode === AuditMode.FULL ? Object.keys(dto).length > 0 : hasChanges,
  };
}
