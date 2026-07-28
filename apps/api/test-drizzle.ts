import { pgTable, text, boolean, uuid } from 'drizzle-orm/pg-core';
import { getTableColumns } from 'drizzle-orm';
import { DefaultQueryBuilder } from 'drizzle-orm/pg-core/query-builders/query-builder';

const glAccounts = pgTable('gl_accounts', {
  glAccountId: uuid('gl_account_id').primaryKey(),
  isGroup: boolean('is_group').notNull(),
});

console.log(getTableColumns(glAccounts));
