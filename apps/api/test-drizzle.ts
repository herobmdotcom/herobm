import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { customers, contacts, actorContactLinks, actors } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import dotenv from 'dotenv';
dotenv.config();

const queryClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(queryClient);

async function run() {
  try {
    const custId = '0145bdd9-96bf-4e37-b231-39de6c007b02';
    
    // Find customer to get actor_id
    const customer = await db.select().from(customers).where(eq(customers.customerId, custId)).limit(1);
    console.log("Customer actorId:", customer[0]?.actorId);

    if (customer[0]?.actorId) {
        const result = await db
            .select({
              id: contacts.contactId,
              primaryFor: actorContactLinks.primaryFor,
            })
            .from(contacts)
            .innerJoin(
              actorContactLinks,
              eq(contacts.contactId, actorContactLinks.contactId),
            )
            .where(eq(actorContactLinks.actorId, customer[0].actorId));
            
        console.log("Result:", result);
    }
  } catch (err) {
    console.error("ERROR:", err);
  } finally {
    process.exit(0);
  }
}

run();
