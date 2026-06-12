import { Injectable, Inject } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../drizzle/drizzle.module';
import { apiKeys } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { CreateApiKeyDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class ApiKeysService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async list() {
    return this.db
      .select({
        apiKeyId: apiKeys.apiKeyId,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        role: apiKeys.role,
        createdOn: apiKeys.createdOn,
      })
      .from(apiKeys);
  }

  async create(body: CreateApiKeyDto, actorUsername: string) {
    const secret = randomBytes(32).toString('hex');
    const prefix = secret.slice(0, 4);
    const hash = await bcrypt.hash(secret, 10);

    const [key] = await this.db.transaction(async (tx) => {
      const [newKey] = await tx
        .insert(apiKeys)
        .values({
          name: body.name,
          prefix: prefix,
          role: body.role,
          keyHash: hash,
          createdBy: actorUsername,
        })
        .returning();

      await emitEvent(tx, {
        entityType: EntityType.API_KEY,
        entityId: newKey.apiKeyId,
        eventType: EventType.CREATED,
        entityDisplayName: newKey.name,
        payload: { name: newKey.name, role: newKey.role },
        actor: actorUsername,
      });

      return [newKey];
    });

    return {
      ...key,
      secretKey: secret,
    };
  }

  async revoke(id: string, actorUsername: string) {
    const [deleted] = await this.db.transaction(async (tx) => {
      const [deletedKey] = await tx
        .delete(apiKeys)
        .where(eq(apiKeys.apiKeyId, id))
        .returning();

      if (deletedKey) {
        await emitEvent(tx, {
          entityType: EntityType.API_KEY,
          entityId: deletedKey.apiKeyId,
          eventType: EventType.DELETED,
          entityDisplayName: deletedKey.name,
          payload: {},
          actor: actorUsername,
        });
      }

      return [deletedKey];
    });

    return deleted;
  }
}
