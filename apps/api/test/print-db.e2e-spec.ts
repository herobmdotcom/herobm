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
        sql`select "herobm_core"."products"."product_id", "herobm_core"."products"."product_number", "herobm_core"."products"."name", "herobm_core"."products"."product_type", "herobm_core"."products"."product_group_id", "herobm_core"."products"."barcode", "herobm_core"."products"."list_price", "herobm_core"."products"."standard_cost", "herobm_core"."products"."trade_price", "herobm_core"."products"."price_level_3", "herobm_core"."products"."price_level_4", "herobm_core"."products"."weighted_average_cost", "herobm_core"."products"."alternate_invoice_description", "herobm_core"."products"."box_quantity", "herobm_core"."products"."base_uom", "herobm_core"."products"."default_sales_uom_id", "herobm_core"."products"."default_purchase_uom_id", "herobm_core"."products"."purchase_tax_category_id", "herobm_core"."products"."sales_tax_category_id", "herobm_core"."products"."alternate_product_number", "herobm_core"."products"."state_code", "herobm_core"."products"."notes", "herobm_core"."products"."source_id", "herobm_core"."products"."source", "herobm_core"."products"."created_by", "herobm_core"."products"."created_on", "herobm_core"."products"."modified_on", "herobm_core"."product_groups"."name", "herobm_core"."product_groups"."group_code" from "herobm_core"."products" left join "herobm_core"."product_groups" on "herobm_core"."products"."product_group_id" = "herobm_core"."product_groups"."product_group_id" where "herobm_core"."products"."state_code" != 'archived' order by "herobm_core"."products"."name" limit 2`,
      );
      console.log('SUCCESS');
    } catch (e) {
      console.error(e.message);
    }
  });
});
