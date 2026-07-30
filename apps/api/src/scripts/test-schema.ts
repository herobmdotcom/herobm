import { glSettings } from '@herobm/db-schema';
import { getTableColumns } from 'drizzle-orm';
async function run() {
  const columns = getTableColumns(glSettings);
  console.log(Object.keys(columns));
}
run();
