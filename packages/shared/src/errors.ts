/**
 * Safely extracts a string message from an unknown error object.
 * Used heavily in catch (e: unknown) blocks.
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as any).message);
  if (typeof err === 'string') return err;
  return String(err);
}
