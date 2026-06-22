export interface GlDimensionSource {
  accountId?: string | null;
  costCenterId?: string | null;
  activityId?: string | null;
}

export interface GlSystemDefaults {
  defaultAccountId?: string | null;
  defaultCostCenterId?: string | null;
  defaultActivityId?: string | null;
}

/**
 * Resolves the GL Account, Cost Center, and Activity using an all-or-nothing fallback strategy.
 * The source that wins the GL Account also provides the Cost Center and Activity.
 * If the winning source lacks the CC/Activity, it falls back to the System Default (ignoring the losing source).
 */
export function resolveGlDimensions(
  primarySource: GlDimensionSource,
  secondarySource: GlDimensionSource,
  systemDefaults: GlSystemDefaults,
): {
  accountId: string | null;
  costCenterId: string | null;
  activityId: string | null;
} {
  let winningSource: GlDimensionSource | null = null;

  if (primarySource.accountId) {
    winningSource = primarySource;
  } else if (secondarySource.accountId) {
    winningSource = secondarySource;
  }

  const accountId =
    winningSource?.accountId || systemDefaults.defaultAccountId || null;
  const costCenterId =
    winningSource?.costCenterId || systemDefaults.defaultCostCenterId || null;
  const activityId =
    winningSource?.activityId || systemDefaults.defaultActivityId || null;

  return { accountId, costCenterId, activityId };
}
