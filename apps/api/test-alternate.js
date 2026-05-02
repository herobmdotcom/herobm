const postgres = require('postgres');
const sql = postgres('postgres://postgres:Xk9mQv2Lp7wBnZ4Tj@localhost:5432/modbm_volzau');
sql`select alternate_product_number from "modbm_core"."products" limit 1`.then(res => {
  console.log('SUCCESS');
}).catch(err => {
  console.error(err);
}).finally(() => {
  sql.end();
});
