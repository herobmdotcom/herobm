import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { reports, reportHookAssignments } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { ReportsRegistry } from './reports.registry';

const execAsync = promisify(exec);

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly registry: ReportsRegistry,
  ) {}

  async runHook(
    hookSlug: string,
    recordId: string,
    contextSlug: string,
    user: any,
  ): Promise<{ pdfBuffer: Buffer; fileName: string }> {
    const hookStart = Date.now();

    const assignment = await this.db.query.reportHookAssignments.findFirst({
      where: eq(reportHookAssignments.hookSlug, hookSlug),
    });

    if (!assignment) {
      throw new NotFoundException(`Hook ${hookSlug} not configured.`);
    }

    const report = await this.db.query.reports.findFirst({
      where: eq(reports.id, assignment.reportId),
    });

    if (!report) {
      throw new NotFoundException(`Report missing for hook ${hookSlug}`);
    }

    const resolver = this.registry.getResolver(contextSlug);
    if (!resolver) {
      throw new InternalServerErrorException(
        `Resolver for context ${contextSlug} not registered in ReportsRegistry`,
      );
    }

    // AuthZ and Data Fetching via the contextual resolver
    const data = await resolver.resolveData(recordId, user);

    const pdfBuffer = await this.compileTypst(report.template, data, report.id);
    const fileName = this.formatOutputName(report.outputNamePattern, data);

    const duration = Date.now() - hookStart;
    this.logger.log(
      `Compiled report ${report.id} in ${duration}ms (Payload: ${pdfBuffer.length} bytes)`,
    );

    return { pdfBuffer, fileName };
  }

  async getReports() {
    return this.db.select().from(reports).orderBy(reports.name);
  }

  async getReportById(id: string) {
    const r = await this.db.query.reports.findFirst({
      where: eq(reports.id, id),
    });
    if (!r) throw new NotFoundException('Report not found');
    return r;
  }

  async createReport(data: {
    name: string;
    slug: string;
    description?: string;
    template: string;
    outputNamePattern?: string;
  }) {
    const [inserted] = await this.db.insert(reports).values(data).returning();
    return inserted;
  }

  async updateReport(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      template: string;
      outputNamePattern: string;
    }>,
  ) {
    const [updated] = await this.db
      .update(reports)
      // modbm uses manual updated timestamps occasionally, but Drizzle default handles it. Let's rely on standard updates.
      .set(data)
      .where(eq(reports.id, id))
      .returning();
    if (!updated) throw new NotFoundException('Report not found');
    return updated;
  }

  async getHooksList() {
    return this.registry
      .getRegisteredContexts()
      .map((c) => ({ contextSlug: c }));
  }

  async getRandomIdForContext(contextSlug: string): Promise<string | null> {
    const resolver = this.registry.getResolver(contextSlug);
    if (!resolver)
      throw new NotFoundException(
        `No resolver registered for context ${contextSlug}`,
      );
    if (!resolver.getRandomId) return null;
    return (await resolver.getRandomId()) || null;
  }

  async renderPreview(
    template: string,
    mockData: any,
    contextSlug?: string,
    entityId?: string,
    user?: any,
  ): Promise<Buffer> {
    let finalData = mockData;
    if (contextSlug && entityId && user) {
      const resolver = this.registry.getResolver(contextSlug);
      if (resolver) {
        finalData = await resolver.resolveData(entityId, user);
      } else {
        throw new NotFoundException(
          `No resolver registered for context ${contextSlug}`,
        );
      }
    }
    return this.compileTypst(template, finalData || {}, 'preview');
  }

  private async compileTypst(
    template: string,
    data: any,
    reportId: string,
  ): Promise<Buffer> {
    const workDir = path.join(process.cwd(), 'tmp/reports');
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    const jobId = randomUUID();
    const typstFile = path.join(workDir, `${jobId}.typ`);
    const dataFile = path.join(workDir, `${jobId}.json`);
    const pdfFile = path.join(workDir, `${jobId}.pdf`);

    try {
      fs.writeFileSync(dataFile, JSON.stringify(data));
      fs.writeFileSync(typstFile, template);

      const typstBinary = process.env.TYPST_BINARY_PATH || 'typst';
      await execAsync(
        `"${typstBinary}" compile "${typstFile}" "${pdfFile}" --input data="${jobId}.json"`,
      );

      return fs.readFileSync(pdfFile);
    } catch (error) {
      if (
        error instanceof Error &&
        'stderr' in error &&
        typeof (error as any).stderr === 'string'
      ) {
        this.logger.error(
          `Typst execution failed for report ${reportId}: ${(error as any).stderr}`,
        );
        throw new InternalServerErrorException(
          `Typst Compilation Error: ${(error as any).stderr}`,
        );
      }
      this.logger.error(`Failed to compile report ${reportId}: ${error}`);
      throw new InternalServerErrorException(
        'Unknown error during Typst compilation',
      );
    } finally {
      // Clean up resources immediately to prevent disk exhaustion
      if (fs.existsSync(typstFile)) fs.unlinkSync(typstFile);
      if (fs.existsSync(dataFile)) fs.unlinkSync(dataFile);
      if (fs.existsSync(pdfFile)) fs.unlinkSync(pdfFile);
    }
  }

  private formatOutputName(pattern: string | null, data: any): string {
    const base = pattern || 'Report.pdf';
    return base.replace(/\$\{(.+?)\}/g, (_, key) => data[key] || 'doc');
  }
}
