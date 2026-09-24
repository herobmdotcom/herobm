import { relations } from 'drizzle-orm';
import {
  glJournalEntries,
  glJournalLines,
  glAccounts,
  costCenters,
  activities,
} from './gl.schema';
import { projects, projectTasks } from './projects.schema';

export const glJournalEntriesRelations = relations(
  glJournalEntries,
  ({ many }) => ({
    lines: many(glJournalLines),
  }),
);

export const glJournalLinesRelations = relations(
  glJournalLines,
  ({ one }) => ({
    journalEntry: one(glJournalEntries, {
      fields: [glJournalLines.journalEntryId],
      references: [glJournalEntries.journalEntryId],
    }),
    account: one(glAccounts, {
      fields: [glJournalLines.glAccountId],
      references: [glAccounts.glAccountId],
    }),
    costCenter: one(costCenters, {
      fields: [glJournalLines.costCenterId],
      references: [costCenters.costCenterId],
    }),
    activity: one(activities, {
      fields: [glJournalLines.activityId],
      references: [activities.activityId],
    }),
    project: one(projects, {
      fields: [glJournalLines.projectId],
      references: [projects.projectId],
    }),
    projectTask: one(projectTasks, {
      fields: [glJournalLines.projectTaskId],
      references: [projectTasks.projectTaskId],
    }),
  }),
);
