import { relations } from 'drizzle-orm';
import {
  workOrders,
  workOrderComponents,
  workOrderPicks,
} from './manufacturing.schema';
import { products } from './products.schema';
import { locations, bins } from './inventory.schema';

export const workOrdersRelations = relations(workOrders, ({ many, one }) => ({
  components: many(workOrderComponents),
  picks: many(workOrderPicks),
  product: one(products, {
    fields: [workOrders.productId],
    references: [products.productId],
  }),
  location: one(locations, {
    fields: [workOrders.locationId],
    references: [locations.locationId],
  }),
  wipBin: one(bins, {
    fields: [workOrders.wipBinId],
    references: [bins.binId],
  }),
  outputBin: one(bins, {
    fields: [workOrders.outputBinId],
    references: [bins.binId],
  }),
}));

export const workOrderComponentsRelations = relations(
  workOrderComponents,
  ({ one, many }) => ({
    workOrder: one(workOrders, {
      fields: [workOrderComponents.workOrderId],
      references: [workOrders.workOrderId],
    }),
    product: one(products, {
      fields: [workOrderComponents.productId],
      references: [products.productId],
    }),
    picks: many(workOrderPicks),
  }),
);

export const workOrderPicksRelations = relations(
  workOrderPicks,
  ({ one }) => ({
    workOrder: one(workOrders, {
      fields: [workOrderPicks.workOrderId],
      references: [workOrders.workOrderId],
    }),
    component: one(workOrderComponents, {
      fields: [workOrderPicks.workOrderComponentId],
      references: [workOrderComponents.workOrderComponentId],
    }),
    bin: one(bins, {
      fields: [workOrderPicks.binId],
      references: [bins.binId],
    }),
  }),
);
