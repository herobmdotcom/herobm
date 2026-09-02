import { SetMetadata } from '@nestjs/common';

export interface IdempotentConfig {
  /** The Drizzle relational query key (e.g. 'glJournalEntries') */
  queryKey: string;
  /** The Drizzle schema property name for the primary key (e.g. 'journalEntryId') */
  pkField: string;
  /** The path in the request body where the client-generated ID is located (e.g. 'journalEntryId') */
  idBodyPath: string;
}

export const IDEMPOTENT_KEY = 'idempotentConfig';

/**
 * Marks an endpoint as idempotent via Client-Generated IDs.
 * If a POST request fails due to a Postgres Unique Constraint Violation (23505) on the primary key,
 * the interceptor will catch it, fetch the existing record using `queryKey`, and return it with 200 OK.
 */
export const Idempotent = (config: IdempotentConfig) =>
  SetMetadata(IDEMPOTENT_KEY, config);
