"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const memory_db_1 = require("./test/utils/memory-db");
const modbm_core_schema_1 = require("./src/drizzle/modbm-core-schema");
const drizzle_orm_1 = require("drizzle-orm");
async function test() {
    const { db, client } = await (0, memory_db_1.createMemoryDb)({ skipSeeds: true });
    try {
        const invoiceId = '00000000-0000-0000-0000-000000000888';
        console.log('Running query...');
        const rows = await db
            .select()
            .from(modbm_core_schema_1.salesInvoices)
            .innerJoin(modbm_core_schema_1.salesOrders, (0, drizzle_orm_1.eq)(modbm_core_schema_1.salesInvoices.salesOrderId, modbm_core_schema_1.salesOrders.salesOrderId))
            .leftJoin(modbm_core_schema_1.accounts, (0, drizzle_orm_1.eq)(modbm_core_schema_1.salesOrders.customerId, modbm_core_schema_1.accounts.accountId))
            .where((0, drizzle_orm_1.eq)(modbm_core_schema_1.salesInvoices.invoiceId, invoiceId))
            .limit(1);
        console.log('Rows:', rows);
    }
    catch (err) {
        console.error('Error:', err);
        if (err.cause) {
            console.error('Cause:', err.cause);
        }
    }
    finally {
        await client.close();
    }
}
test();
//# sourceMappingURL=debug_find_one.js.map