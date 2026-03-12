import { Module, Global } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as martsSchema from './schema';
import * as coreSchema from './modbm-core-schema';

const schema = { ...martsSchema, ...coreSchema };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`FATAL: Required environment variable ${name} is not set. Check your .env file.`);
  }
  return value;
}

export const DRIZZLE = Symbol('DRIZZLE');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DRIZZLE,
      useFactory: () => {
        const client = process.env.DATABASE_URL
          ? postgres(process.env.DATABASE_URL)
          : postgres({
              host: process.env.POSTGRES_HOST ?? 'localhost',
              port: Number(process.env.POSTGRES_PORT ?? 5432),
              user: requireEnv('POSTGRES_USER'),
              password: requireEnv('POSTGRES_PASSWORD'),
              database: process.env.POSTGRES_DB ?? 'custom_app',
            });
        return drizzle(client, { schema });
      },
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule {}
