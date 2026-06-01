const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:Xk9mQv2Lp7wBnZ4Tj@localhost:5432/modbm_volzau' });
pool.query('SELECT * FROM modbm_core.gl_settings').then(res => {
  console.log(res.rows);
  pool.end();
}).catch(console.error);
