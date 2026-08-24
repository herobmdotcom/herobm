import {
  Injectable,
  Inject,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import * as QRCode from 'qrcode';
import { generateSecret, generateURI, verifySync } from 'otplib';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { users, userTwoFactor } from '@herobm/db-schema';
import { EncryptionService } from '../common/encryption.service';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

const BCRYPT_ROUNDS = 10;
const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 8; // 8 alphanumeric chars, formatted as xxxx-xxxx

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Generate a new TOTP setup: secret, otpauth URI, QR code, and backup codes.
   * This does NOT enable 2FA — the user must confirm with a valid code first.
   */
  async generateSetup(userId: string, username: string) {
    const secret = generateSecret();
    const otpauthUrl = generateURI({
      secret,
      issuer: 'HeroBM',
      label: username,
    });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Generate backup codes (plaintext returned once, hashes stored on enable)
    const backupCodes = this.generateBackupCodes();

    return {
      secret,
      otpauthUrl,
      qrCodeDataUrl,
      backupCodes,
    };
  }

  /**
   * Enable 2FA after the user confirms with a valid TOTP code.
   * Encrypts the secret and hashes backup codes before storage.
   */
  async enable(
    userId: string,
    code: string,
    rawSecret: string,
    backupCodes: string[],
    actor: string,
  ) {
    // Verify the code against the raw secret before storing
    const result = verifySync({ token: code, secret: rawSecret });
    if (!result.valid) {
      throw new BadRequestException(
        'Invalid verification code. Please try again.',
      );
    }

    // Encrypt the secret for storage
    const secretEncrypted = this.encryptionService.encrypt(rawSecret);

    // Hash backup codes with bcrypt
    const hashedBackupCodes = await Promise.all(
      backupCodes.map(async (plainCode) => ({
        hash: await bcrypt.hash(plainCode.replace(/-/g, ''), BCRYPT_ROUNDS),
      })),
    );

    const now = new Date();

    await this.db.transaction(async (tx) => {
      // Upsert: delete any existing 2FA config, then insert
      await tx.delete(userTwoFactor).where(eq(userTwoFactor.userId, userId));

      await tx.insert(userTwoFactor).values({
        userId,
        secretEncrypted,
        isEnabled: true,
        backupCodes: hashedBackupCodes,
        verifiedAt: now,
        createdAt: now,
        updatedAt: now,
      });

      await emitEvent(tx, {
        entityType: EntityType.USER,
        entityId: userId,
        eventType: EventType.UPDATED,
        entityDisplayName: actor,
        payload: { twoFactor: 'enabled' },
        actor,
      });
    });

    this.logger.log(`[AUDIT] User '${actor}' enabled 2FA`);
  }

  /**
   * Verify a TOTP code or backup code for login.
   * Returns true if verification succeeds.
   *
   * The DB write here (marking a backup code as consumed) is an internal
   * security state update, not a domain event. Already logged via Logger.
   */
  // @herobm-skip-audit
  async verifyCode(userId: string): Promise<{
    verify: (code: string) => Promise<boolean>;
  }> {
    const [twoFa] = await this.db
      .select()
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId))
      .limit(1);

    if (!twoFa || !twoFa.isEnabled) {
      throw new NotFoundException('2FA is not enabled for this user');
    }

    const decryptedSecret = this.encryptionService.decrypt(
      twoFa.secretEncrypted,
    );

    return {
      verify: async (code: string) => {
        // First try TOTP verification (only works for 6-digit codes)
        try {
          const totpResult = verifySync({
            token: code,
            secret: decryptedSecret,
          });
          if (totpResult.valid) return true;
        } catch {
          // Non-6-digit codes (e.g. backup codes) will throw TokenLengthError — expected
        }

        // Then try backup codes (strip dashes for comparison)
        const normalizedCode = code.replace(/-/g, '');
        const backupCodes = twoFa.backupCodes as {
          hash: string;
          usedAt?: string;
        }[];

        for (let i = 0; i < backupCodes.length; i++) {
          const entry = backupCodes[i];
          if (entry.usedAt) continue; // Already consumed

          const matches = await bcrypt.compare(normalizedCode, entry.hash);
          if (matches) {
            // Mark backup code as consumed
            const updatedCodes = [...backupCodes];
            updatedCodes[i] = {
              ...entry,
              usedAt: new Date().toISOString(),
            };

            await this.db
              .update(userTwoFactor)
              .set({
                backupCodes: updatedCodes,
                updatedAt: new Date(),
              })
              .where(eq(userTwoFactor.userId, userId));

            this.logger.log(
              `[AUDIT] User '${userId}' used backup code #${i + 1}`,
            );
            return true;
          }
        }

        return false;
      },
    };
  }

  /**
   * Disable 2FA for a user. Requires password and current TOTP code.
   */
  async disable(userId: string, password: string, code: string, actor: string) {
    // Verify password
    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Verify TOTP code
    const verifier = await this.verifyCode(userId);
    const codeValid = await verifier.verify(code);
    if (!codeValid) {
      throw new BadRequestException('Invalid 2FA code');
    }

    await this.db.transaction(async (tx) => {
      await tx.delete(userTwoFactor).where(eq(userTwoFactor.userId, userId));

      await emitEvent(tx, {
        entityType: EntityType.USER,
        entityId: userId,
        eventType: EventType.UPDATED,
        entityDisplayName: actor,
        payload: { twoFactor: 'disabled' },
        actor,
      });
    });

    this.logger.log(`[AUDIT] User '${actor}' disabled 2FA`);
  }

  /**
   * Regenerate backup codes. Requires password and current TOTP code.
   */
  async regenerateBackupCodes(
    userId: string,
    password: string,
    code: string,
    actor: string,
  ) {
    // Verify password
    const [user] = await this.db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid password');
    }

    // Verify TOTP code
    const verifier = await this.verifyCode(userId);
    const codeValid = await verifier.verify(code);
    if (!codeValid) {
      throw new BadRequestException('Invalid 2FA code');
    }

    // Generate new backup codes
    const newBackupCodes = this.generateBackupCodes();
    const hashedCodes = await Promise.all(
      newBackupCodes.map(async (plainCode) => ({
        hash: await bcrypt.hash(plainCode.replace(/-/g, ''), BCRYPT_ROUNDS),
      })),
    );

    await this.db.transaction(async (tx) => {
      await tx
        .update(userTwoFactor)
        .set({
          backupCodes: hashedCodes,
          updatedAt: new Date(),
        })
        .where(eq(userTwoFactor.userId, userId));

      await emitEvent(tx, {
        entityType: EntityType.USER,
        entityId: userId,
        eventType: EventType.UPDATED,
        entityDisplayName: actor,
        payload: { twoFactor: 'backup_codes_regenerated' },
        actor,
      });
    });

    this.logger.log(`[AUDIT] User '${actor}' regenerated 2FA backup codes`);

    return { backupCodes: newBackupCodes };
  }

  /**
   * Administrative reset: remove 2FA for a user (admin action).
   */
  async adminReset(targetUserId: string, actor: string) {
    const [existing] = await this.db
      .select({ userId: userTwoFactor.userId })
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, targetUserId))
      .limit(1);

    if (!existing) {
      throw new BadRequestException('2FA is not enabled for this user');
    }

    await this.db.transaction(async (tx) => {
      await tx
        .delete(userTwoFactor)
        .where(eq(userTwoFactor.userId, targetUserId));

      await emitEvent(tx, {
        entityType: EntityType.USER,
        entityId: targetUserId,
        eventType: EventType.UPDATED,
        entityDisplayName: actor,
        payload: { twoFactor: 'admin_reset', resetBy: actor },
        actor,
      });
    });

    this.logger.log(
      `[AUDIT] Admin '${actor}' reset 2FA for user '${targetUserId}'`,
    );
  }

  /**
   * Get 2FA status for a user.
   */
  async getStatus(userId: string) {
    const [twoFa] = await this.db
      .select({
        isEnabled: userTwoFactor.isEnabled,
        verifiedAt: userTwoFactor.verifiedAt,
      })
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId))
      .limit(1);

    return {
      enabled: twoFa?.isEnabled ?? false,
      verifiedAt: twoFa?.verifiedAt?.toISOString() ?? null,
    };
  }

  /**
   * Check if 2FA is enabled for a given user ID.
   */
  async isEnabled(userId: string): Promise<boolean> {
    const [twoFa] = await this.db
      .select({ isEnabled: userTwoFactor.isEnabled })
      .from(userTwoFactor)
      .where(eq(userTwoFactor.userId, userId))
      .limit(1);

    return twoFa?.isEnabled ?? false;
  }

  // ── Private Helpers ──────────────────────────────────────────────────

  /**
   * Generate cryptographically random backup codes formatted as xxxx-xxxx.
   */
  private generateBackupCodes(): string[] {
    const codes: string[] = [];
    const charset = 'abcdefghijklmnopqrstuvwxyz0123456789';

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const bytes = new Uint8Array(BACKUP_CODE_LENGTH);
      crypto.getRandomValues(bytes);
      let code = '';
      for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
        code += charset[bytes[j] % charset.length];
      }
      // Format as xxxx-xxxx
      codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
    }

    return codes;
  }
}
