import { relations } from 'drizzle-orm';
import {
  locations,
  bins,
  inventoryEntries,
  stocktakes,
  stocktakeLines,
  stocktakeCounts,
  transferOrders,
  transferOrderLines,
} from './inventory.schema';
import { products } from './products.schema';
import { projects, projectTasks } from './projects.schema';

export const stocktakesRelations = relations(stocktakes, ({ one, many }) => ({
  location: one(locations, {
    fields: [stocktakes.locationId],
    references: [locations.locationId],
  }),
  inventoryEntry: one(inventoryEntries, {
    fields: [stocktakes.inventoryEntryId],
    references: [inventoryEntries.entryId],
  }),
  lines: many(stocktakeLines),
  counts: many(stocktakeCounts),
}));

export const stocktakeLinesRelations = relations(
  stocktakeLines,
  ({ one, many }) => ({
    stocktake: one(stocktakes, {
      fields: [stocktakeLines.stocktakeId],
      references: [stocktakes.stocktakeId],
    }),
    product: one(products, {
      fields: [stocktakeLines.productId],
      references: [products.productId],
    }),
    bin: one(bins, {
      fields: [stocktakeLines.binId],
      references: [bins.binId],
    }),
    counts: many(stocktakeCounts),
  }),
);

export const stocktakeCountsRelations = relations(
  stocktakeCounts,
  ({ one }) => ({
    stocktake: one(stocktakes, {
      fields: [stocktakeCounts.stocktakeId],
      references: [stocktakes.stocktakeId],
    }),
    line: one(stocktakeLines, {
      fields: [stocktakeCounts.stocktakeLineId],
      references: [stocktakeLines.stocktakeLineId],
    }),
    product: one(products, {
      fields: [stocktakeCounts.productId],
      references: [products.productId],
    }),
    bin: one(bins, {
      fields: [stocktakeCounts.binId],
      references: [bins.binId],
    }),
  }),
);

export const transferOrdersRelations = relations(
  transferOrders,
  ({ one, many }) => ({
    sourceLocation: one(locations, {
      fields: [transferOrders.sourceLocationId],
      references: [locations.locationId],
      relationName: 'transferOrdersSourceLocation',
    }),
    destinationLocation: one(locations, {
      fields: [transferOrders.destinationLocationId],
      references: [locations.locationId],
      relationName: 'transferOrdersDestinationLocation',
    }),
    project: one(projects, {
      fields: [transferOrders.projectId],
      references: [projects.projectId],
    }),
    projectTask: one(projectTasks, {
      fields: [transferOrders.projectTaskId],
      references: [projectTasks.projectTaskId],
    }),
    lines: many(transferOrderLines),
  }),
);

export const transferOrderLinesRelations = relations(
  transferOrderLines,
  ({ one }) => ({
    transferOrder: one(transferOrders, {
      fields: [transferOrderLines.transferOrderId],
      references: [transferOrders.transferOrderId],
    }),
    product: one(products, {
      fields: [transferOrderLines.productId],
      references: [products.productId],
    }),
    projectTask: one(projectTasks, {
      fields: [transferOrderLines.projectTaskId],
      references: [projectTasks.projectTaskId],
    }),
  }),
);
