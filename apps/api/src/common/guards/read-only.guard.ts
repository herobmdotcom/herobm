import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { LicenseService } from '../../settings/license.service';

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
 *
 * Global guard that enforces read-only mode across the entire API when the system
 * lacks a valid license (e.g. trial expired, never licensed beyond grace period).
 *
 * It allows GET requests, but blocks POST, PUT, PATCH, DELETE unless the route
 * is explicitly excluded (e.g. login, applying a license).
 */
@Injectable()
export class ReadOnlyGuard implements CanActivate {
  private readonly logger = new Logger(ReadOnlyGuard.name);

  // Paths that must remain functional even in read-only mode
  private readonly EXCLUDED_PATHS = [
    '/api/auth/login',
    '/api/auth/me',
    '/api/settings/license',
    '/api/settings/license-status',
    '/api/telemetry/client-errors',
  ];

  constructor(private readonly licenseService: LicenseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const method = request.method?.toUpperCase();

    // Always allow read-only HTTP methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      return true;
    }

    // Always allow specific excluded paths
    const path = request.path;
    if (this.EXCLUDED_PATHS.some((p) => path.startsWith(p))) {
      return true;
    }

    // Evaluate license state
    const status = await this.licenseService.getStatus();

    if (status.state === 'read_only') {
      this.logger.warn(
        `Blocked ${method} ${path} - System is in read-only mode (${status.warningMessage})`,
      );
      throw new ForbiddenException({
        message:
          status.warningMessage ||
          'System is in read-only mode due to an invalid or missing license.',
        code: 'READ_ONLY_MODE_ACTIVE',
      });
    }

    return true;
  }
}
