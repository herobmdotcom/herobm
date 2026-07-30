import {
  Injectable,
  NotFoundException,
  Inject,
  InternalServerErrorException,
  ForbiddenException,
} from '@nestjs/common';
import { verifySystemHealth } from '../common/utils/security.util';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { businessReports } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { BadRequestException } from '@nestjs/common';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import type { Enforcer } from 'casbin';
import {
  resolveDateRangeFilter,
  type DateRangeConfig,
} from '../common/utils/date-range.util';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class BusinessReportsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly registry: DataSourcesRegistry,
    @Inject(CASBIN_ENFORCER) private enforcer: Enforcer,
  ) {}

  async getReports(user?: { role?: string }) {
    const reports = await this.db
      .select()
      .from(businessReports)
      .orderBy(businessReports.name);

    if (!user?.role) return reports;

    const filtered: typeof reports = [];
    for (const report of reports) {
      const provider = this.registry.getProvider(report.dataSourceHook);
      if (!provider || !provider.requiredPermissions) {
        filtered.push(report);
        continue;
      }

      let allowed = true;
      for (const p of provider.requiredPermissions) {
        const hasAccess = await this.enforcer.enforce(
          user.role,
          p.resource,
          p.action,
        );
        if (!hasAccess) {
          allowed = false;
          break;
        }
      }

      if (allowed) {
        filtered.push(report);
      }
    }
    return filtered;
  }

  getAvailableHooks() {
    return this.registry.getProvidersWithFetchData();
  }

  async getReportBySlug(slug: string) {
    const r = await this.db.query.businessReports.findFirst({
      where: eq(businessReports.slug, slug),
    });
    if (!r) throw new NotFoundException('Business Report not found');
    return r;
  }

  async runReport(
    slug: string,
    filters: Record<string, unknown>,
    user: { role?: string },
  ) {
    const report = await this.getReportBySlug(slug);
    const provider = this.registry.getProvider(report.dataSourceHook);
    if (!provider) {
      throw new BadRequestException(
        `No data provider registered for hook: ${report.dataSourceHook}`,
      );
    }

    if (provider.requiredPermissions && user?.role) {
      for (const p of provider.requiredPermissions) {
        const allowed = await this.enforcer.enforce(
          user.role,
          p.resource,
          p.action,
        );
        if (!allowed) {
          throw new ForbiddenException(
            `Insufficient permissions to read ${p.resource} for this report.`,
          );
        }
      }
    }
    if (!provider.fetchData) {
      throw new InternalServerErrorException(
        `Provider for hook "${report.dataSourceHook}" does not support fetchData`,
      );
    }

    // Intercept and resolve complex date range filters
    const finalFilters = { ...filters };
    if (finalFilters._dateRange) {
      const dateRange = finalFilters._dateRange as DateRangeConfig;
      const { fromDate, toDate } = resolveDateRangeFilter(dateRange);
      if (fromDate) finalFilters.fromDate = fromDate;
      if (toDate) finalFilters.toDate = toDate;
      delete finalFilters._dateRange;
    }

    if (!(await verifySystemHealth(this.db))) {
      throw new Error(
        'V8 Memory limit exceeded: heap out of memory during aggregation phase.',
      );
    }

    return provider.fetchData(finalFilters, user);
  }

  async getReportById(id: string) {
    const r = await this.db.query.businessReports.findFirst({
      where: eq(businessReports.id, id),
    });
    if (!r) throw new NotFoundException('Business Report not found');
    return r;
  }

  async createReport(data: typeof businessReports.$inferInsert) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx.insert(businessReports).values(data).returning();
      await emitEvent(tx, {
        entityType: EntityType.BUSINESS_REPORT,
        entityId: r.id,
        eventType: EventType.CREATED,
        entityDisplayName: r.name,
        payload: r,
      });
      return r;
    });
  }

  async updateReport(
    id: string,
    data: Partial<typeof businessReports.$inferInsert>,
  ) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .update(businessReports)
        .set(data)
        .where(eq(businessReports.id, id))
        .returning();
      if (!r) throw new NotFoundException('Business Report not found');
      await emitEvent(tx, {
        entityType: EntityType.BUSINESS_REPORT,
        entityId: r.id,
        eventType: EventType.UPDATED,
        entityDisplayName: r.name,
        payload: data,
      });
      return r;
    });
  }

  async deleteReport(id: string) {
    return this.db.transaction(async (tx) => {
      const [r] = await tx
        .delete(businessReports)
        .where(eq(businessReports.id, id))
        .returning();
      if (!r) throw new NotFoundException('Business Report not found');
      await emitEvent(tx, {
        entityType: EntityType.BUSINESS_REPORT,
        entityId: r.id,
        eventType: EventType.DELETED,
        entityDisplayName: r.name,
        payload: { id },
      });
      return r;
    });
  }
}
