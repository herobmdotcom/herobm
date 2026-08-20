import { Module, Global, OnApplicationShutdown, Inject } from '@nestjs/common';
import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as coreSchema from '@herobm/db-schema';
import { extensionSchemas } from '../generated/extension-schemas';
import { EnvService } from '../common/config/env.service';

const schema = { ...coreSchema, ...extensionSchemas };

export const DRIZZLE = Symbol('DRIZZLE');
export const POSTGRES_CLIENT = Symbol('POSTGRES_CLIENT');

export type DrizzleDB = PostgresJsDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_CLIENT,
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        return env.databaseUrl
          ? postgres(env.databaseUrl)
          : postgres({
              host: env.postgresHost,
              port: env.postgresPort,
              user: env.postgresUser || 'postgres',
              password: env.postgresPassword || '',
              database: env.postgresDb,
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
