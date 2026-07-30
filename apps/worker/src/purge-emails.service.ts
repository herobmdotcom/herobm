import { Job } from 'bullmq';
import { emailOutbox } from '@herobm/db-schema';
import { eq, lt, and } from 'drizzle-orm';
import { relayLogger as logger } from './logger';

/**
 * BullMQ processor for the system maintenance queue.
 * Purges emails that were successfully processed over 30 days ago to save space.
 */
export async function purgeOldEmails(job: Job, db: any) {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Drizzle doesn't return the number of deleted rows natively across all drivers in the same way,
    // but in Postgres we can do a .returning({ id: emailOutbox.id }) if we want count,
    // however for bulk deletes that can be heavy. We'll just execute.
    logger.info(`Starting purge of emails sent before ${thirtyDaysAgo.toISOString()}`);

    const result = await db
      .delete(emailOutbox)
      .where(
        and(
          eq(emailOutbox.status, 'sent'),
          lt(emailOutbox.processedAt, thirtyDaysAgo)
        )
      )
      .returning({ id: emailOutbox.id }); // Returning just id to count how many were deleted

    const deletedCount = result.length;
    logger.info(`Successfully purged ${deletedCount} old emails.`);

    return { deletedCount };
  } catch (error: any) {
    logger.error({ err: error.message }, 'Failed to purge old emails');
    throw error;
  }
}
