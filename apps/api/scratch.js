const postgres = require('postgres');
const sql = postgres('postgresql://postgres:Xk9mQv2Lp7wBnZ4Tj@localhost:5432/modbm_volzsg');
sql`SELECT definition FROM pg_views WHERE viewname = 'inventory_levels'`.then(r => {
    console.log("VIEW DEFINITION:");
    console.log(r[0]?.definition || "NOT FOUND");
    sql.end();
}).catch(console.error);
