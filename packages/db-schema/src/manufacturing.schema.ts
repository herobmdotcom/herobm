import {
  text,
  numeric,
  timestamp,
  uuid,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import {
  WORK_ORDER_TRANSITIONS,
  WORK_ORDER_PICK_TRANSITIONS,
  WorkOrderState,
  WorkOrderPickState,
  getValidStates,
} from '@herobm/shared';
import { herobmCore } from './core.schema';
import { products } from './products.schema';
import { locations, bins } from './inventory.schema';

// ---------------------------------------------------------------------------
// work_orders (Master record for manufacturing jobs)
// ---------------------------------------------------------------------------
export const workOrders = herobmCore.table(
  'work_orders',
  {
    workOrderId: uuid('work_order_id').primaryKey().defaultRandom(),
    orderNumber: text('order_number').unique().notNull(),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    targetQuantity: numeric('target_quantity').notNull(),
    completedQuantity: numeric('completed_quantity').notNull(),
    locationId: uuid('location_id')
      .notNull()
      .references(() => locations.locationId),
    wipBinId: uuid('wip_bin_id').references(() => bins.binId),
    stateCode: text('state_code').$type<WorkOrderState>().notNull(),
    totalCost: numeric('total_cost'),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stateCheck: check(
      'work_order_state_check',
      sql.raw(
        `state_code IN (${getValidStates(WORK_ORDER_TRANSITIONS)
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
    locationIdx: index('idx_work_orders_location').on(t.locationId),
  }),
);

// ---------------------------------------------------------------------------
// work_order_components (Snapshot of BOM for the work order)
// ---------------------------------------------------------------------------
export const workOrderComponents = herobmCore.table(
  'work_order_components',
  {
    workOrderComponentId: uuid('work_order_component_id')
      .primaryKey()
      .defaultRandom(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.workOrderId),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.productId),
    expectedQuantity: numeric('expected_quantity').notNull(),
    unitCost: numeric('unit_cost'),
  },
  (t) => ({
    workOrderIdx: index('idx_work_order_components_wo').on(t.workOrderId),
  }),
);

// ---------------------------------------------------------------------------
// work_order_picks (Tracks component picking from inventory to WIP)
// ---------------------------------------------------------------------------
export const workOrderPicks = herobmCore.table(
  'work_order_picks',
  {
    pickId: uuid('pick_id').primaryKey().defaultRandom(),
    workOrderId: uuid('work_order_id')
      .notNull()
      .references(() => workOrders.workOrderId),
    workOrderComponentId: uuid('work_order_component_id')
      .notNull()
      .references(() => workOrderComponents.workOrderComponentId),
    binId: uuid('bin_id').references(() => bins.binId),
    quantity: numeric('quantity').notNull(),
    stateCode: text('state_code').$type<WorkOrderPickState>().notNull(),
    createdBy: text('created_by'),
    createdOn: timestamp('created_on', { withTimezone: true }).defaultNow(),
    modifiedOn: timestamp('modified_on', { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    workOrderIdx: index('idx_work_order_picks_wo').on(t.workOrderId),
    stateCheck: check(
      'work_order_pick_state_check',
      sql.raw(
        `state_code IN (${getValidStates(WORK_ORDER_PICK_TRANSITIONS)
          .map((s: string) => `'${s}'`)
          .join(', ')})`,
      ),
    ),
  }),
);
