import { glSettings } from '../drizzle/herobm-core-schema';
import { getTableColumns } from 'drizzle-orm';
async function run() {
  const columns = getTableColumns(glSettings);
  console.log(Object.keys(columns));
}
run();
