import {
  Injectable,
  NotFoundException,
  Inject,
  InternalServerErrorException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { businessReports } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class BusinessReportsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly registry: DataSourcesRegistry,
  ) {}

  async getReports() {
    return this.db.select().from(businessReports).orderBy(businessReports.name);
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

  async runReport(slug: string, filters: Record<string, unknown>, user: any) {
    const report = await this.getReportBySlug(slug);
    const provider = this.registry.getProvider(report.dataSourceHook);
    if (!provider) {
      throw new BadRequestException(
        `No data provider registered for hook: ${report.dataSourceHook}`,
      );
    }
    if (!provider.fetchData) {
      throw new InternalServerErrorException(
        `Provider for hook "${report.dataSourceHook}" does not support fetchData`,
      );
    }
    return provider.fetchData(filters, user);
  }

  async getReportById(id: string) {
    const r = await this.db.query.businessReports.findFirst({
      where: eq(businessReports.id, id),
    });
    if (!r) throw new NotFoundException('Business Report not found');
    return r;
  }

  async createReport(data: any) {
    const [r] = await this.db.insert(businessReports).values(data).returning();
    return r;
  }

  async updateReport(id: string, data: any) {
    const [r] = await this.db
      .update(businessReports)
      .set(data)
      .where(eq(businessReports.id, id))
      .returning();
    if (!r) throw new NotFoundException('Business Report not found');
    return r;
  }

  async deleteReport(id: string) {
    const [r] = await this.db
      .delete(businessReports)
      .where(eq(businessReports.id, id))
      .returning();
    if (!r) throw new NotFoundException('Business Report not found');
    return r;
  }
}
