import { Test, TestingModule } from '@nestjs/testing';
import { TwoFactorService } from './two-factor.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { users, userTwoFactor } from '@herobm/db-schema';
import { EncryptionService } from '../common/encryption.service';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { generateSecret, generate } from 'otplib';

// eslint-disable-next-line no-restricted-syntax -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols.
const TEST_PASSWORD = 'test-admin-pw-xyz'; // TEST_CREDENTIAL
const TEST_HASH = bcrypt.hashSync(TEST_PASSWORD, 10);
const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';

/**
 * Helper: generate a real TOTP code for a secret so the enable() call succeeds.
 */
async function generateValidCode(secret: string): Promise<string> {
  return generate({ secret });
}

/**
 * Helper: enable 2FA for the test user with a real secret + code.
 */
async function enable2FaForUser(
  service: TwoFactorService,
  secret: string,
  backupCodes: string[] = ['abcd-1234', 'efgh-5678'],
) {
  const code = await generateValidCode(secret);
  await service.enable(TEST_USER_ID, code, secret, backupCodes, 'admin');
}

describe('TwoFactorService', () => {
  const pg = setupPgliteSuite();
  let service: TwoFactorService;

  beforeEach(async () => {
    // Clean tables for isolation
    await pg.db.delete(userTwoFactor);
    await pg.db.delete(users);

    // Seed a standard user
    await pg.db.insert(users).values({
      userId: TEST_USER_ID,
      username: 'admin',
      displayName: 'Admin User',
      passwordHash: TEST_HASH,
      role: 'admin',
      isActive: true,
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        EncryptionService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'ENCRYPTION_KEY') return null;
              if (key === 'JWT_SECRET') return 'test-jwt-secret-for-encryption';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
  });

  describe('generateSetup', () => {
    it('should generate a secret, QR code, and backup codes', async () => {
      const result = await service.generateSetup(TEST_USER_ID, 'admin');

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain('HeroBM');
      expect(result.otpauthUrl).toContain('admin');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
      expect(result.backupCodes).toHaveLength(8);
      // Verify backup code format: xxxx-xxxx
      for (const code of result.backupCodes) {
        expect(code).toMatch(/^[a-z0-9]{4}-[a-z0-9]{4}$/);
      }
    });
  });

  describe('enable', () => {
    it('should enable 2FA with a valid code', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      const status = await service.getStatus(TEST_USER_ID);
      expect(status.enabled).toBe(true);
      expect(status.verifiedAt).toBeDefined();
    });

    it('should reject an invalid 6-digit numeric verification code (ADV-168)', async () => {
      const storedSecret = generateSecret();

      // Use a numeric 6-digit code that is not valid for this secret
      await expect(
        service.enable(
          TEST_USER_ID,
          '000000',
          storedSecret,
          ['abcd-1234'],
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a non-numeric verification code', async () => {
      const storedSecret = generateSecret();

      // Use a non-numeric code that will always fail TOTP verification
      await expect(
        service.enable(
          TEST_USER_ID,
          'abcdef', // non-numeric, always invalid for TOTP
          storedSecret,
          ['abcd-1234'],
          'admin',
        ),
      ).rejects.toThrow();
    });
  });

  describe('isEnabled / getStatus', () => {
    it('should return false when 2FA is not configured', async () => {
      const result = await service.isEnabled(TEST_USER_ID);
      expect(result).toBe(false);
    });

    it('should return status with enabled=false when not configured', async () => {
      const result = await service.getStatus(TEST_USER_ID);
      expect(result.enabled).toBe(false);
      expect(result.verifiedAt).toBeNull();
    });
  });

  describe('verifyCode', () => {
    it('should verify a valid TOTP code', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      const verifier = await service.verifyCode(TEST_USER_ID);
      const freshCode = await generateValidCode(secret);
      const isValid = await verifier.verify(freshCode);
      expect(isValid).toBe(true);
    });

    it('should reject an invalid 6-digit numeric code (ADV-168)', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      const verifier = await service.verifyCode(TEST_USER_ID);
      // Valid-format 6-digit code that does not match the secret
      const isValid1 = await verifier.verify('000000');
      expect(isValid1).toBe(false);

      const isValid2 = await verifier.verify('123456');
      expect(isValid2).toBe(false);
    });

    it('should reject an invalid non-numeric code', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      const verifier = await service.verifyCode(TEST_USER_ID);
      // Use a non-numeric code that is not a valid TOTP or backup code
      const isValid = await verifier.verify('zzzzzz');
      expect(isValid).toBe(false);
    });

    it('should verify and consume a backup code', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret, ['abcd-1234', 'efgh-5678']);

      const verifier = await service.verifyCode(TEST_USER_ID);

      // First use should succeed (strip dashes)
      const isValid = await verifier.verify('abcd1234');
      expect(isValid).toBe(true);

      // Second use of same code should fail (consumed)
      const verifier2 = await service.verifyCode(TEST_USER_ID);
      const isValid2 = await verifier2.verify('abcd1234');
      expect(isValid2).toBe(false);
    });

    it('should throw when 2FA is not enabled', async () => {
      await expect(service.verifyCode(TEST_USER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('disable', () => {
    it('should disable 2FA with valid password and TOTP code', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      const freshCode = await generateValidCode(secret);
      await service.disable(TEST_USER_ID, TEST_PASSWORD, freshCode, 'admin');

      expect(await service.isEnabled(TEST_USER_ID)).toBe(false);
    });

    it('should reject disable with invalid 6-digit TOTP code (ADV-168)', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      await expect(
        service.disable(TEST_USER_ID, TEST_PASSWORD, '000000', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes with valid password and TOTP code', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      const freshCode = await generateValidCode(secret);
      const result = await service.regenerateBackupCodes(
        TEST_USER_ID,
        TEST_PASSWORD,
        freshCode,
        'admin',
      );

      expect(result.backupCodes).toHaveLength(8);
    });

    it('should reject regeneration with invalid 6-digit TOTP code (ADV-168)', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      await expect(
        service.regenerateBackupCodes(
          TEST_USER_ID,
          TEST_PASSWORD,
          '000000',
          'admin',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('adminReset', () => {
    it('should remove 2FA configuration', async () => {
      const secret = generateSecret();
      await enable2FaForUser(service, secret);

      expect(await service.isEnabled(TEST_USER_ID)).toBe(true);

      await service.adminReset(TEST_USER_ID, 'admin');

      expect(await service.isEnabled(TEST_USER_ID)).toBe(false);
    });

    it('should throw when 2FA is not enabled', async () => {
      await expect(service.adminReset(TEST_USER_ID, 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
