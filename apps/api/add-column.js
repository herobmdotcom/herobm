require('dotenv').config({ path: '../../.env' });
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('ALTER TABLE modbm_core.purchase_orders ADD COLUMN expected_date timestamp;'))
  .then(() => console.log('Successfully added expected_date column'))
  .then(() => client.end())
  .catch((err) => {
    console.error('Error adding column:', err);
    client.end();
  });
