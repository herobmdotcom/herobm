import { Module, Global, OnApplicationShutdown, Inject } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as coreSchema from './herobm-core-schema';

const schema = { ...coreSchema };

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `FATAL: Required environment variable ${name} is not set. Check your .env file.`,
    );
  }
  return value;
}

export const DRIZZLE = Symbol('DRIZZLE');
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      useFactory: () => {
        return process.env.DATABASE_URL
          ? postgres(process.env.DATABASE_URL)
          : postgres({
              host: process.env.POSTGRES_HOST ?? 'localhost',
              port: Number(process.env.POSTGRES_PORT ?? 5432),
              user: requireEnv('POSTGRES_USER'),
              password: requireEnv('POSTGRES_PASSWORD'),
              database: process.env.POSTGRES_DB ?? 'herobm',
            });
      },
    },
    {
      provide: DRIZZLE,
      inject: [POSTGRES_CLIENT],
      useFactory: (client: postgres.Sql) => drizzle(client, { schema }),
    },
  ],
  exports: [DRIZZLE],
})
export class DrizzleModule implements OnApplicationShutdown {
  constructor(@Inject(POSTGRES_CLIENT) private readonly client: postgres.Sql) {}

  async onApplicationShutdown() {
    await this.client.end();
  }
}
