import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { sql } from 'drizzle-orm';

describe('Print DB', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let db: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should run exact query', async () => {
    try {
      const res = await db.execute(
        sql`select "modbm_core"."products"."product_id", "modbm_core"."products"."product_number", "modbm_core"."products"."name", "modbm_core"."products"."product_type", "modbm_core"."products"."product_group_id", "modbm_core"."products"."barcode", "modbm_core"."products"."list_price", "modbm_core"."products"."standard_cost", "modbm_core"."products"."trade_price", "modbm_core"."products"."price_level_3", "modbm_core"."products"."price_level_4", "modbm_core"."products"."weighted_average_cost", "modbm_core"."products"."alternate_invoice_description", "modbm_core"."products"."box_quantity", "modbm_core"."products"."base_uom", "modbm_core"."products"."default_sales_uom_id", "modbm_core"."products"."default_purchase_uom_id", "modbm_core"."products"."purchase_tax_category_id", "modbm_core"."products"."sales_tax_category_id", "modbm_core"."products"."alternate_product_number", "modbm_core"."products"."state_code", "modbm_core"."products"."notes", "modbm_core"."products"."source_id", "modbm_core"."products"."source", "modbm_core"."products"."created_by", "modbm_core"."products"."created_on", "modbm_core"."products"."modified_on", "modbm_core"."product_groups"."name", "modbm_core"."product_groups"."group_code" from "modbm_core"."products" left join "modbm_core"."product_groups" on "modbm_core"."products"."product_group_id" = "modbm_core"."product_groups"."product_group_id" where "modbm_core"."products"."state_code" != 'archived' order by "modbm_core"."products"."name" limit 2`,
      );
      console.log('SUCCESS');
    } catch (e) {
      console.error(e.message);
    }
  });
});
