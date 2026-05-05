import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../apps/api/src/drizzle/modbm-core-schema';
import { eq, and, ne } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL || `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

async function main() {
    console.log(`Patching putaway_status for database: ${process.env.POSTGRES_DB}`);
    const client = postgres(dbUrl);
    const db = drizzle(client, { schema });

    const result = await db
        .update(schema.goodsReceivedLines)
        .set({ putawayStatus: 'awaiting_matching' as any })
        .where(
            and(
                ne(schema.goodsReceivedLines.matchStatus, 'matched'),
                eq(schema.goodsReceivedLines.putawayStatus, 'pending_putaway')
            )
        );

    console.log('Patch complete.');
    await client.end();
}

main().catch(console.error);
