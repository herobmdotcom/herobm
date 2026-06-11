import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { AppConfigService } from './app-config.service';
import { TRUSTED_PUBLIC_KEYS } from '../common/constants/security.constants';

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

// Pre-compute NATIVE keys and map them by their deterministic Key ID (kid)
const KEY_REGISTRY = new Map<string, crypto.KeyObject>();
for (const pem of TRUSTED_PUBLIC_KEYS) {
  const kid = crypto
    .createHash('sha256')
    .update(pem.trim())
    .digest('hex')
    .substring(0, 8);
  KEY_REGISTRY.set(kid, crypto.createPublicKey(pem));
}

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

  // In-memory cache for the validated license to avoid repeated crypto operations
  private cachedLicenseKey: string | null = null;
  private cachedDecoded: DecodedLicense | null = null;
  private cachedHash: string | null = null;

  // Obfuscated config parameters
  private get T01() {
    return parseInt('9A7EC800', 16);
  }
  private get T02() {
    return parseInt('241E1C00', 16);
  }

  private cachedSystemId: string | null = null;
  private isSystemCompromised = false;

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

    if (this.cachedSystemId !== systemId) {
      this.cachedSystemId = systemId;
      this.isSystemCompromised = false;
      if (systemId.length >= 49) {
        const parts = systemId.split('-');
        if (parts.length >= 6) {
          const encodedMs = parseInt(parts[parts.length - 1], 16);
          // Allow up to 60000ms drift between ID generation and setup completion
          if (Math.abs(encodedMs - setupAt.getTime()) > 60000) {
            this.isSystemCompromised = true;
          }
        } else {
          this.isSystemCompromised = true;
        }
      } else {
        this.isSystemCompromised = true;
      }
    }

    if (this.isSystemCompromised) {
      return {
        // eslint-disable-next-line no-restricted-syntax
        state: 'read_only',
        type: 'none',
        expiresAt: null,
        warningMessage:
          'System Integrity Error: Configuration tampering detected. Re-initialization required.',
        systemId,
      };
    }

    const { activeLicenseKey, activeLicensePayload } = rawApp;
    let licenseHash: string | null = null;
    let decoded: DecodedLicense | null = null;

    if (activeLicenseKey) {
      if (this.cachedLicenseKey === activeLicenseKey) {
        // Use cached verification
        licenseHash = this.cachedHash;
        decoded = this.cachedDecoded;
      } else {
        // Compute new cache
        licenseHash = crypto
          .createHash('sha256')
          .update(activeLicenseKey)
          .digest('hex')
          .substring(0, 8);

        try {
          decoded = this.verifyLicense(activeLicenseKey, systemId);
          this.cachedDecoded = decoded;
        } catch (err: unknown) {
          this.cachedDecoded = null;
          const message = err instanceof Error ? err.message : 'Unknown error';
          this.logger.warn(`License validation failed: ${message}`);
        }

        this.cachedLicenseKey = activeLicenseKey;
        this.cachedHash = licenseHash;
      }
    }

    // 1. Check if an active license is installed and valid
    if (activeLicenseKey && activeLicensePayload && decoded) {
      try {
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
          const graceEndMs = expMs + this.T02;
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
        // Fallback for unexpected errors during date evaluation
        const message = err instanceof Error ? err.message : 'Unknown error';
        this.logger.warn(`License evaluation failed: ${message}`);
      }
    }

    // 2. No valid license applied. Use installation grace period.
    const nowMs = Date.now();
    const setupMs = setupAt.getTime();
    const warnStartMs = setupMs + this.T01;
    const readOnlyStartMs = warnStartMs + this.T02;

    if (nowMs < warnStartMs) {
      return {
        // eslint-disable-next-line no-restricted-syntax
        state: 'active',
        type: 'none',
        expiresAt: new Date(readOnlyStartMs),
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
        expiresAt: new Date(readOnlyStartMs),
        warningMessage: `License required. System will enter read-only mode in ${daysLeft} days.`,
        systemId,
      };
    }

    return {
      // eslint-disable-next-line no-restricted-syntax
      state: 'read_only',
      type: 'none',
      expiresAt: new Date(readOnlyStartMs),
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

    const header = JSON.parse(
      Buffer.from(headerB64, 'base64url').toString('utf8'),
    );

    if (!header.kid) {
      throw new Error(
        'License missing Key ID (kid). This system version requires modern licenses with a valid kid.',
      );
    }

    const publicKey = KEY_REGISTRY.get(header.kid);
    if (!publicKey) {
      throw new Error(
        `License signed by unknown or untrusted Key ID: ${header.kid}`,
      );
    }

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
