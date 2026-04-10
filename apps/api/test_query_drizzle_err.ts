import { DRIZZLE } from './src/drizzle/drizzle.module';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './src/app.module';

async function run() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get(DRIZZLE);

  try {
    const res = await db.execute('select "inventory_levels"."inventory_level_id", "inventory_levels"."product_id", "modbm_core"."products"."product_number", "modbm_core"."products"."name", "inventory_levels"."location_id", "modbm_core"."locations"."code", "modbm_core"."locations"."name", "inventory_levels"."quantity_on_hand", "inventory_levels"."quantity_committed", "inventory_levels"."quantity_reserved", "inventory_levels"."quantity_on_order" from "modbm_core"."inventory_levels" left join "modbm_core"."products" on "inventory_levels"."product_id" = "modbm_core"."products"."product_id" left join "modbm_core"."locations" on "inventory_levels"."location_id" = "modbm_core"."locations"."location_id" limit 1;');
    console.log("Success:", res);
  } catch (err) {
    console.error("Caught error:", err);
    console.error("Inner cause:", err.cause);
    console.error("PG Code:", err.code);
  }
  await app.close();
}
run();
