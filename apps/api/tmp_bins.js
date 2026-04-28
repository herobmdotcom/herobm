const postgres = require('postgres');
const sql = postgres('postgresql://postgres:Xk9mQv2Lp7wBnZ4Tj@localhost:5432/modbm_volzau');
sql`SELECT DISTINCT bin_type FROM modbm_core.bins`.then(res => {
  console.log(res);
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
