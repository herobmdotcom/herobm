import { getTableColumns } from 'drizzle-orm';
import { glAccounts } from './src/drizzle/herobm-core-schema';

describe('Drizzle Schema Test', () => {
  it('should print glAccounts columns', () => {
    console.log(Object.keys(getTableColumns(glAccounts)));
    const cols = getTableColumns(glAccounts);
    console.log('isGroup:', cols.isGroup?.name);
    console.log('isSystem:', cols.isSystem?.name);
    expect(true).toBe(true);
  });
});
