import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Inject,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  reports,
  reportHookAssignments,
  reportContexts,
  organization,
} from '../drizzle/modbm-core-schema';
import { eq, like, or } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
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
    options?: Record<string, unknown>,
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
    const data = await resolver.resolveData(recordId, user, options);

    const pdfBuffer = await this.compileTypst(report.template, data, report.id);
    const fileName = this.formatOutputName(report.outputNamePattern, data);

    const duration = Date.now() - hookStart;
    this.logger.log(
      `Compiled report ${report.id} in ${duration}ms (Payload: ${pdfBuffer.length} bytes)`,
    );

    return { pdfBuffer, fileName };
  }

  async getReports() {
    const data = await this.db.select().from(reports).orderBy(reports.name);

    // Enrich with contexts
    const enriched = await Promise.all(
      data.map(async (r) => {
        const contexts = await this.db
          .select({ context: reportContexts.context })
          .from(reportContexts)
          .where(eq(reportContexts.reportId, r.id));
        return {
          ...r,
          contexts: contexts.map((c) => c.context),
        };
      }),
    );
    return enriched;
  }

  async getReportById(id: string) {
    const r = await this.db.query.reports.findFirst({
      where: eq(reports.id, id),
    });
    if (!r) throw new NotFoundException('Report not found');

    // Fetch contexts
    const contexts = await this.db
      .select({ context: reportContexts.context })
      .from(reportContexts)
      .where(eq(reportContexts.reportId, id));

    return {
      ...r,
      contexts: contexts.map((c) => c.context),
    };
  }

  async createReport(data: {
    name: string;
    slug: string;
    description?: string;
    template: string;
    outputNamePattern?: string;
    contexts?: string[];
  }) {
    const { contexts, ...rest } = data;
    const [inserted] = await this.db.insert(reports).values(rest).returning();

    if (contexts && contexts.length > 0) {
      await Promise.all(
        contexts.map((ctx) =>
          this.db.insert(reportContexts).values({
            reportId: inserted.id,
            context: ctx,
          }),
        ),
      );
    }

    return { ...inserted, contexts: contexts || [] };
  }

  async updateReport(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      description: string;
      template: string;
      outputNamePattern: string;
      contexts: string[];
    }>,
  ) {
    const { contexts, ...rest } = data;

    const [updated] = await this.db
      .update(reports)
      .set(rest)
      .where(eq(reports.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Report not found');

    // Sync contexts if provided
    if (contexts !== undefined) {
      // 1. Clear old contexts
      await this.db
        .delete(reportContexts)
        .where(eq(reportContexts.reportId, id));

      // 2. Insert new contexts
      if (contexts.length > 0) {
        await Promise.all(
          contexts.map((ctx) =>
            this.db.insert(reportContexts).values({
              reportId: id,
              context: ctx,
            }),
          ),
        );
      }
    }

    // Refresh context list for return
    const currentContexts = await this.db
      .select({ context: reportContexts.context })
      .from(reportContexts)
      .where(eq(reportContexts.reportId, id));

    return { ...updated, contexts: currentContexts.map((c) => c.context) };
  }

  async deleteReport(id: string) {
    // Check if report is assigned to any hook
    const assignment = await this.db.query.reportHookAssignments.findFirst({
      where: eq(reportHookAssignments.reportId, id),
    });

    if (assignment) {
      throw new BadRequestException(
        `Cannot delete template: It is currently assigned to the system hook "${assignment.hookSlug}". Please reassign the hook first.`,
      );
    }

    const [deleted] = await this.db
      .delete(reports)
      .where(eq(reports.id, id))
      .returning();
    if (!deleted) throw new NotFoundException('Report not found');
    return { success: true };
  }

  async getAssignments() {
    return this.db
      .select({
        hookSlug: reportHookAssignments.hookSlug,
        reportId: reportHookAssignments.reportId,
        contextSlug: reportHookAssignments.contextSlug,
        reportName: reports.name,
        updatedAt: reportHookAssignments.updatedAt,
      })
      .from(reportHookAssignments)
      .leftJoin(reports, eq(reportHookAssignments.reportId, reports.id))
      .orderBy(reportHookAssignments.hookSlug);
  }

  async updateAssignment(
    hookSlug: string,
    reportId: string,
    contextSlug: string,
  ) {
    const [updated] = await this.db
      .insert(reportHookAssignments)
      .values({
        hookSlug,
        reportId,
        contextSlug,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: reportHookAssignments.hookSlug,
        set: { reportId, contextSlug, updatedAt: new Date() },
      })
      .returning();
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

    // Fetch and inject organization
    const orgQuery = await this.db.select().from(organization).limit(1);
    const orgData = orgQuery.length > 0 ? orgQuery[0] : {};
    const finalData = { ...data, _org: orgData };

    // Fetch shared fragments (e.g. fragments/themes)
    const fragments = await this.db.query.reports.findMany({
      where: or(
        like(reports.slug, 'theme-%'),
        like(reports.slug, 'fragment-%'),
      ),
    });

    const fragmentFiles: string[] = [];

    try {
      fs.writeFileSync(dataFile, JSON.stringify(finalData));
      fs.writeFileSync(typstFile, template);

      // Write fragments to workDir
      for (const f of fragments) {
        if (f.id !== reportId) {
          const fPath = path.join(workDir, `${f.slug}.typ`);
          fs.writeFileSync(fPath, f.template);
          fragmentFiles.push(fPath);
        }
      }

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
      for (const fPath of fragmentFiles) {
        if (fs.existsSync(fPath)) fs.unlinkSync(fPath);
      }
    }
  }

  private formatOutputName(pattern: string | null, data: any): string {
    const base = pattern || 'Report.pdf';
    return base.replace(/\$\{(.+?)\}/g, (_, key) => data[key] || 'doc');
  }
}
