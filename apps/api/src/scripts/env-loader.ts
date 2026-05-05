import * as dotenv from 'dotenv';

// Assumes command is run from the project root
dotenv.config();

if (!process.env.JWT_SECRET) {
  console.error('\n❌ FATAL: JWT_SECRET not found in .env');
  console.error('Please ensure you are running this command from the project root where .env is located.\n');
  process.exit(1);
}
