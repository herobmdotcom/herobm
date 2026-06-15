import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { eq, and, sql } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { users, userEvents } from '../drizzle/herobm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { CreateUserDto, UpdateUserDto } from './dto';
import { CUSTOMER_STATE } from '@herobm/shared';

/**
 * Whitelisted columns for public responses — passwordHash is NEVER returned.
 * All queries MUST use this selection, not a bare .select().
 */
const PUBLIC_COLUMNS = {
  userId: users.userId,
  username: users.username,
  displayName: users.displayName,
  email: users.email,
  role: users.role,
  isActive: users.isActive,
  createdAt: users.createdAt,
};

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  async findAll() {
    const userRows = await this.db
      .select(PUBLIC_COLUMNS)
      .from(users)
      .orderBy(users.username);

    const events = await this.db
      .select()
      .from(userEvents)
      .orderBy(userEvents.createdOn);

    // Group events by userId
    const eventsByUser = new Map<string, typeof events>();
    for (const event of events) {
      const list = eventsByUser.get(event.userId) ?? [];
      list.push(event);
      eventsByUser.set(event.userId, list);
    }

    return userRows.map((user) => ({
      ...user,
      events: eventsByUser.get(user.userId) ?? [],
    }));
  }

  async findOne(id: string) {
    const rows = await this.db
      .select(PUBLIC_COLUMNS)
      .from(users)
      .where(eq(users.userId, id))
      .limit(1);
    if (rows.length === 0) {
      throw new NotFoundException(`User not found`);
    }
    return rows[0];
  }

  async create(dto: CreateUserDto, actor: string) {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      const result = await this.db.transaction(async (tx: DrizzleDB) => {
        const [created] = await tx
          .insert(users)
          .values({
            username: dto.username.trim().toLowerCase(),
            passwordHash,
            role: dto.role,
            displayName: dto.displayName?.trim() || null,
            email: dto.email?.trim().toLowerCase() || null,
          })
          .returning(PUBLIC_COLUMNS);

        await emitEvent(tx, {
          entityType: EntityType.USER,
          entityId: created.userId,
          eventType: EventType.CREATED,
          entityDisplayName: created.username,
          payload: {
            username: created.username,
            role: dto.role,
            displayName: dto.displayName || null,
            email: dto.email || null,
          },
          actor,
        });

        return created;
      });

      this.logger.log(
        `[AUDIT] User '${actor}' created user '${result.username}' (Name: ${dto.displayName || 'N/A'}) with role '${dto.role}'`,
      );

      return result;
    } catch (err: unknown) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((err as any)?.code === '23505') {
        throw new ConflictException(
          `Username '${dto.username}' is already taken`,
        );
      }
      throw err;
    }
  }

  async update(id: string, dto: UpdateUserDto, actorId: string, actor: string) {
    const target = await this.findOne(id);

    // ── Self-demotion guard (Finding 3) ────────────────────────────────
    if (actorId === id && dto.role && dto.role !== target.role) {
      throw new BadRequestException(
        'Cannot change your own role. Ask another administrator.',
      );
    }

    // ── Last-admin guard (Finding 2) — role demotion ───────────────────
    if (target.role === 'admin' && dto.role && dto.role !== 'admin') {
      await this.assertNotLastAdmin(id);
    }

    const updatePayload: Record<string, unknown> = {};
    const auditChanges: Record<string, unknown> = {};

    if (dto.role !== undefined && dto.role !== target.role) {
      updatePayload.role = dto.role;
      auditChanges.role = { from: target.role, to: dto.role };
    }

    if (dto.displayName !== undefined) {
      const newName = dto.displayName?.trim() || null;
      if (newName !== target.displayName) {
        updatePayload.displayName = newName;
        auditChanges.displayName = {
          from: target.displayName || null,
          to: newName,
        };
      }
    }

    if (dto.email !== undefined) {
      const newEmail = dto.email?.trim().toLowerCase() || null;
      if (newEmail !== target.email) {
        updatePayload.email = newEmail;
        auditChanges.email = { from: target.email || null, to: newEmail };
      }
    }

    if (dto.password) {
      updatePayload.passwordHash = await bcrypt.hash(
        dto.password,
        BCRYPT_ROUNDS,
      );
      // SECURITY: Never log the actual password — record only that it changed
      auditChanges.passwordHash = '(changed)';
    }

    if (Object.keys(updatePayload).length === 0) {
      return target; // Nothing to update
    }

    const rows = await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(users)
        .set(updatePayload)
        .where(eq(users.userId, id))
        .returning(PUBLIC_COLUMNS);

      await emitEvent(tx, {
        entityType: EntityType.USER,
        entityId: id,
        eventType: EventType.UPDATED,
        entityDisplayName: updated.username,
        payload: auditChanges,
        actor,
      });

      return [updated];
    });

    this.logger.log(
      `[AUDIT] User '${actor}' updated user '${target.username}': ${Object.keys(auditChanges).join(', ')}`,
    );

    return rows[0];
  }

  async toggleActive(id: string, actorId: string, actor: string) {
    const target = await this.findOne(id);

    // ── Self-disable guard (Finding 3) ─────────────────────────────────
    if (actorId === id) {
      throw new BadRequestException('Cannot disable your own customer.');
    }

    // ── Last-admin guard (Finding 2) — disabling an admin ──────────────
    if (target.role === 'admin' && target.isActive) {
      await this.assertNotLastAdmin(id);
    }

    const newStatus = !target.isActive;

    const rows = await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(users)
        .set({ isActive: newStatus })
        .where(eq(users.userId, id))
        .returning(PUBLIC_COLUMNS);

      await emitEvent(tx, {
        entityType: EntityType.USER,
        entityId: id,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: target.username,
        payload: {
          username: target.username,
          from: target.isActive
            ? CUSTOMER_STATE.ACTIVE
            : CUSTOMER_STATE.INACTIVE,
          to: newStatus ? CUSTOMER_STATE.ACTIVE : CUSTOMER_STATE.INACTIVE,
        },
        actor,
      });

      return [updated];
    });

    this.logger.log(
      `[AUDIT] User '${actor}' ${newStatus ? 'enabled' : 'disabled'} user '${target.username}'`,
    );

    return rows[0];
  }

  async remove(id: string, actorId: string, actor: string) {
    const target = await this.findOne(id);

    // ── Self-deletion guard ────────────────────────────────────────────
    if (actorId === id) {
      throw new BadRequestException('Cannot delete your own customer.');
    }

    // ── Last-admin guard (Finding 2) — deleting an admin ───────────────
    if (target.role === 'admin') {
      await this.assertNotLastAdmin(id);
    }

    await this.db.transaction(async (tx) => {
      await emitEvent(tx, {
        entityType: EntityType.USER,
        entityId: id,
        eventType: EventType.DELETED,
        entityDisplayName: target.username,
        payload: {
          username: target.username,
          role: target.role,
          displayName: target.displayName || null,
        },
        actor,
      });

      await tx.delete(users).where(eq(users.userId, id));
    });

    this.logger.log(
      `[AUDIT] User '${actor}' deleted user '${target.username}'`,
    );

    return { deleted: true };
  }

  // ── Private Helpers ────────────────────────────────────────────────────

  /**
   * Throws if the target user is the last active admin, preventing lockout.
   * @param excludeId The userId being modified/removed — excluded from the count.
   */
  private async assertNotLastAdmin(excludeId: string) {
    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'admin'), eq(users.isActive, true)));

    // If there's only 1 active admin and it's the one being modified → block
    if (count <= 1) {
      throw new BadRequestException(
        'Cannot remove or demote the last active administrator. ' +
          'Promote another user to admin first.',
      );
    }
  }
}
