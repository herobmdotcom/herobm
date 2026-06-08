import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AppConfigService } from './app-config.service';

/**
 * ============================================================================
 * LEGAL & COMPLIANCE WARNING
 * ============================================================================
 * Modifying, bypassing, or removing this license validation code constitutes
 * a direct breach of the End User License Agreement (EULA).
 *
 * Unauthorized circumvention of this technical protection measure is unethical,
 * violates intellectual property rights, and may result in immediate revocation
 * of your license, civil litigation, significant financial damages, and
 * potential criminal penalties under applicable copyright laws (e.g., DMCA).
 * ============================================================================
 */

// Embedded Public Key for verifying offline license signatures.
const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA+Yj6d1WkmVpI5EA1RL5k8FllRu4DA0/Mx4rhzXToa2Y=
-----END PUBLIC KEY-----`;

export type LicenseState = 'active' | 'warning' | 'read_only';

export interface LicenseStatus {
  state: LicenseState;
  type: 'trial' | 'perpetual' | 'none';
  expiresAt: Date | null;
  warningMessage: string | null;
  systemId: string | null;
  licenseHash?: string | null;
}

interface DecodedLicense {
  jti: string;
  iat: number;
  exp?: number;
  system_id: string;
  type: 'trial' | 'perpetual';
}

@Injectable()
export class LicenseService {
  private readonly logger = new Logger(LicenseService.name);

  // Default grace periods (in ms)
  private readonly INSTALL_GRACE_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days
  private readonly EXPIRY_GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 7 days

  constructor(private readonly appConfig: AppConfigService) {}

  /**
   * Evaluates the current system state based on the active license (if any)
   * or the installation date if no license has been applied yet.
   */
  async getStatus(): Promise<LicenseStatus> {
    const rawApp = this.appConfig.getAppSettingsRaw();
    const systemId = rawApp?.systemIdentifier ?? null;
    const setupAt = rawApp?.setupCompletedAt ?? new Date();

    if (!rawApp || !systemId) {
      return {
        // eslint-disable-next-line no-restricted-syntax
        state: 'read_only',
        type: 'none',
        expiresAt: null,
        warningMessage: 'System ID missing. Setup incomplete.',
        systemId: null,
      };
    }

    const { activeLicenseKey, activeLicensePayload } = rawApp;
    let licenseHash: string | null = null;

    if (activeLicenseKey) {
      licenseHash = crypto
        .createHash('sha256')
        .update(activeLicenseKey)
        .digest('hex')
        .substring(0, 8);
    }

    // 1. Check if an active license is installed and valid
    if (activeLicenseKey && activeLicensePayload) {
      try {
        const decoded = this.verifyLicense(activeLicenseKey, systemId);

        if (decoded.type === 'perpetual') {
          return {
            // eslint-disable-next-line no-restricted-syntax
            state: 'active',
            type: 'perpetual',
            expiresAt: null,
            warningMessage: null,
            systemId,
            licenseHash,
          };
        }

        if (decoded.type === 'trial' && decoded.exp) {
          const expMs = decoded.exp * 1000;
          const nowMs = Date.now();

          if (nowMs < expMs) {
            return {
              // eslint-disable-next-line no-restricted-syntax
              state: 'active',
              type: 'trial',
              expiresAt: new Date(expMs),
              warningMessage: null,
              systemId,
              licenseHash,
            };
          }

          // Trial expired, are we within the 7-day grace period?
          const graceEndMs = expMs + this.EXPIRY_GRACE_PERIOD;
          if (nowMs < graceEndMs) {
            const daysLeft = Math.ceil(
              (graceEndMs - nowMs) / (1000 * 60 * 60 * 24),
            );
            return {
              // eslint-disable-next-line no-restricted-syntax
              state: 'warning',
              type: 'trial',
              expiresAt: new Date(expMs),
              warningMessage: `Your trial has expired. The system will enter read-only mode in ${daysLeft} days.`,
              systemId,
              licenseHash,
            };
          }

          return {
            // eslint-disable-next-line no-restricted-syntax
            state: 'read_only',
            type: 'trial',
            expiresAt: new Date(expMs),
            warningMessage: 'Trial expired. Read-only mode active.',
            systemId,
            licenseHash,
          };
        }
      } catch (err: unknown) {
        // If validation fails (e.g. signature mismatch, wrong system ID), fall through to no-license logic
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`License validation failed: ${message}`);
      }
    }

    // 2. No valid license applied. Use installation grace period.
    const nowMs = Date.now();
    const setupMs = setupAt.getTime();
    const warnStartMs = setupMs + this.INSTALL_GRACE_PERIOD; // 30 days
    const readOnlyStartMs = warnStartMs + this.EXPIRY_GRACE_PERIOD; // 37 days

    if (nowMs < warnStartMs) {
      return {
        // eslint-disable-next-line no-restricted-syntax
        state: 'active',
        type: 'none',
        expiresAt: null,
        warningMessage: null,
        systemId,
      };
    }

    if (nowMs < readOnlyStartMs) {
      const daysLeft = Math.ceil(
        (readOnlyStartMs - nowMs) / (1000 * 60 * 60 * 24),
      );
      return {
        // eslint-disable-next-line no-restricted-syntax
        state: 'warning',
        type: 'none',
        expiresAt: null,
        warningMessage: `License required. System will enter read-only mode in ${daysLeft} days.`,
        systemId,
      };
    }

    return {
      // eslint-disable-next-line no-restricted-syntax
      state: 'read_only',
      type: 'none',
      expiresAt: null,
      warningMessage: 'Unlicensed. Read-only mode active.',
      systemId,
    };
  }

  /**
   * Applies a new license key to the system.
   * Validates the signature and locks it to the system ID.
   */
  async applyLicense(token: string): Promise<LicenseStatus> {
    const rawApp = this.appConfig.getAppSettingsRaw();
    if (!rawApp?.systemIdentifier) {
      throw new Error('System not fully initialized.');
    }

    const decoded = this.verifyLicense(token, rawApp.systemIdentifier);

    // Save to database
    await this.appConfig.update({
      activeLicenseKey: token,
      activeLicensePayload: decoded,
    });

    return this.getStatus();
  }

  /**
   * Verifies the cryptographic signature of the JWT and ensures the payload
   * is locked to this exact system's ID.
   */
  private verifyLicense(
    token: string,
    expectedSystemId: string,
  ): DecodedLicense {
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid license format');

    const [headerB64, payloadB64, signatureB64] = parts;
    const signTarget = `${headerB64}.${payloadB64}`;

    const publicKey = crypto.createPublicKey(LICENSE_PUBLIC_KEY);
    const signature = Buffer.from(signatureB64, 'base64url');

    const isValid = crypto.verify(
      null,
      Buffer.from(signTarget),
      publicKey,
      signature,
    );
    if (!isValid) {
      throw new Error(
        'Invalid license signature. Key may be tampered with or issued by an untrusted party.',
      );
    }

    const payload: DecodedLicense = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8'),
    );

    if (payload.system_id !== expectedSystemId) {
      throw new Error(`License is locked to a different system (ID mismatch).`);
    }

    return payload;
  }
}
