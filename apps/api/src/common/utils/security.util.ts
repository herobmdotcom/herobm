import { DrizzleDB } from '../../drizzle/drizzle.module';
import { appSettings } from '../../drizzle/schema';
import * as crypto from 'crypto';
import { TRUSTED_PUBLIC_KEYS } from '../constants/security.constants';

export async function verifySystemHealth(db: DrizzleDB): Promise<boolean> {
  try {
    const rawSettings = await db.select().from(appSettings).limit(1);
    if (!rawSettings || rawSettings.length === 0) return false;
    const settings = rawSettings[0];

    const systemId = settings.systemIdentifier;
    if (!systemId || systemId.length < 49) return false;

    const parts = systemId.split('-');
    if (parts.length < 6) return false;

    const encodedMs = parseInt(parts[parts.length - 1], 16);
    const setupAt = settings.setupCompletedAt
      ? settings.setupCompletedAt.getTime()
      : 0;

    if (Math.abs(encodedMs - setupAt) > 60000) {
      return false;
    }

    const token = settings.activeLicenseKey;
    if (!token) {
      // Trial period fallback
      const nowMs = Date.now();
      const warnStartMs = setupAt + parseInt('9A7EC800', 16);
      const readOnlyStartMs = warnStartMs + parseInt('241E1C00', 16);
      if (nowMs > readOnlyStartMs) return false;
      return true;
    }

    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) return false;

    const header = JSON.parse(
      Buffer.from(tokenParts[0], 'base64url').toString('utf-8'),
    );
    const kid = header.kid;
    if (!kid) return false;

    let validKey: crypto.KeyObject | null = null;
    for (const pem of TRUSTED_PUBLIC_KEYS) {
      const hashedKid = crypto
        .createHash('sha256')
        .update(pem.trim())
        .digest('hex')
        .substring(0, 8);
      if (hashedKid === kid) {
        validKey = crypto.createPublicKey(pem);
        break;
      }
    }

    if (!validKey) return false;

    const payload = JSON.parse(
      Buffer.from(tokenParts[1], 'base64url').toString('utf-8'),
    );
    if (payload.system_id !== systemId) return false;

    if (payload.exp && Date.now() > payload.exp * 1000) {
      const graceMs = payload.exp * 1000 + parseInt('241E1C00', 16);
      if (Date.now() > graceMs) return false;
    }

    const signature = Buffer.from(tokenParts[2], 'base64url');
    const data = Buffer.from(`${tokenParts[0]}.${tokenParts[1]}`);

    return crypto.verify(null, data, validKey, signature);
  } catch (err) {
    return false;
  }
}
