import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  Inject,
  ForbiddenException,
} from '@nestjs/common';
import { verifySystemHealth } from '../common/utils/security.util';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  pdfTemplates,
  pdfTemplateHooks,
  pdfTemplateContexts,
  organization,
} from '@herobm/db-schema';
import { eq, like, or, inArray } from 'drizzle-orm';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { randomUUID } from 'crypto';
import { BadRequestException } from '@nestjs/common';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import { DataSourceContext } from '@herobm/shared';
import type { Enforcer } from 'casbin';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

const execAsync = promisify(exec);

@Injectable()
export class PdfTemplatesService {
  private readonly logger = new Logger(PdfTemplatesService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly registry: DataSourcesRegistry,
    @Inject(CASBIN_ENFORCER) private enforcer: Enforcer,
  ) {}

  async runHook(
    hookSlug: string,
    recordId: string,
    contextSlug: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    user: any,
    options?: Record<string, unknown>,
  ): Promise<{ pdfBuffer: Buffer; fileName: string }> {
    const hookStart = Date.now();

    const assignment = await this.db.query.pdfTemplateHooks.findFirst({
      where: eq(pdfTemplateHooks.hookSlug, hookSlug),
    });

    if (!assignment) {
      throw new NotFoundException(`Hook ${hookSlug} not configured.`);
    }

    const report = await this.db.query.pdfTemplates.findFirst({
      where: eq(pdfTemplates.id, assignment.reportId),
    });

    if (!report) {
      throw new NotFoundException(`Report missing for hook ${hookSlug}`);
    }

    const resolver = this.registry.getProvider(contextSlug);
    if (!resolver) {
      throw new InternalServerErrorException(
        `Resolver for context ${contextSlug} not registered in DataSourcesRegistry`,
      );
    }

    if (resolver.requiredPermissions && user?.role) {
      for (const p of resolver.requiredPermissions) {
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

    // AuthZ and Data Fetching via the contextual resolver
    if (!resolver.resolveData) {
      throw new InternalServerErrorException(
        `Data source ${contextSlug} does not support PDF generation.`,
      );
    }
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
    const data = await this.db
      .select()
      .from(pdfTemplates)
      .orderBy(pdfTemplates.name);

    if (data.length === 0) return [];

    const templateIds = data.map((d) => d.id);
    const allContexts = await this.db
      .select({
        templateId: pdfTemplateContexts.templateId,
        context: pdfTemplateContexts.context,
      })
      .from(pdfTemplateContexts)
      .where(inArray(pdfTemplateContexts.templateId, templateIds));

    const contextMap = new Map<string, string[]>();
    for (const row of allContexts) {
      if (!contextMap.has(row.templateId)) {
        contextMap.set(row.templateId, []);
      }
      contextMap.get(row.templateId)!.push(row.context);
    }

    const enriched = data.map((r) => ({
      ...r,
      contexts: contextMap.get(r.id) || [],
    }));

    return enriched;
  }

  async getReportById(id: string) {
    const r = await this.db.query.pdfTemplates.findFirst({
      where: eq(pdfTemplates.id, id),
    });
    if (!r) throw new NotFoundException('Report not found');

    // Fetch contexts
    const contexts = await this.db
      .select({ context: pdfTemplateContexts.context })
      .from(pdfTemplateContexts)
      .where(eq(pdfTemplateContexts.templateId, id));

    return {
      ...r,
      contexts: contexts.map((c) => c.context),
    };
  }

  // @herobm-skip-audit
  async createReport(data: {
    name: string;
    slug: string;
    description?: string;
    template: string;
    outputNamePattern?: string;
    contexts?: string[];
  }) {
    const { contexts, ...rest } = data;
    const [inserted] = await this.db
      .insert(pdfTemplates)
      .values(rest)
      .returning();

    if (contexts && contexts.length > 0) {
      await this.db.insert(pdfTemplateContexts).values(
        contexts.map((ctx) => ({
          templateId: inserted.id,
          context: ctx,
        })),
      );
    }

    return { ...inserted, contexts: contexts || [] };
  }

  // @herobm-skip-audit
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
      .update(pdfTemplates)
      .set(rest)
      .where(eq(pdfTemplates.id, id))
      .returning();

    if (!updated) throw new NotFoundException('Report not found');

    // Sync contexts if provided
    if (contexts !== undefined) {
      // 1. Clear old contexts
      await this.db
        .delete(pdfTemplateContexts)
        .where(eq(pdfTemplateContexts.templateId, id));

      // 2. Insert new contexts
      if (contexts.length > 0) {
        await this.db.insert(pdfTemplateContexts).values(
          contexts.map((ctx) => ({
            templateId: id,
            context: ctx,
          })),
        );
      }
    }

    // Refresh context list for return
    const currentContexts = await this.db
      .select({ context: pdfTemplateContexts.context })
      .from(pdfTemplateContexts)
      .where(eq(pdfTemplateContexts.templateId, id));

    return { ...updated, contexts: currentContexts.map((c) => c.context) };
  }

  async deleteReport(id: string) {
    // Check if report is assigned to any hook
    const assignment = await this.db.query.pdfTemplateHooks.findFirst({
      where: eq(pdfTemplateHooks.reportId, id),
    });

    if (assignment) {
      throw new BadRequestException(
        `Cannot delete template: It is currently assigned to the system hook "${assignment.hookSlug}". Please reassign the hook first.`,
      );
    }

    const [deleted] = await this.db
      .delete(pdfTemplates)
      .where(eq(pdfTemplates.id, id))
      .returning();
    if (!deleted) throw new NotFoundException('Report not found');

    await emitEvent(this.db, {
      entityType: EntityType.SYSTEM,
      entityId: '00000000-0000-4000-8000-000000000000',
      eventType: EventType.UPDATED,
      entityDisplayName: 'PDF Templates',
      payload: { deletedReportId: id },
      actor: 'system',
    });

    return { success: true };
  }

  async getAssignments() {
    return this.db
      .select({
        hookSlug: pdfTemplateHooks.hookSlug,
        reportId: pdfTemplateHooks.reportId,
        contextSlug: pdfTemplateHooks.contextSlug,
        reportName: pdfTemplates.name,
        updatedAt: pdfTemplateHooks.updatedAt,
      })
      .from(pdfTemplateHooks)
      .leftJoin(pdfTemplates, eq(pdfTemplateHooks.reportId, pdfTemplates.id))
      .orderBy(pdfTemplateHooks.hookSlug);
  }

  async updateAssignment(
    hookSlug: string,
    reportId: string,
    contextSlug: string,
  ) {
    const [updated] = await this.db
      .insert(pdfTemplateHooks)
      .values({
        hookSlug,
        reportId,
        contextSlug,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: pdfTemplateHooks.hookSlug,
        set: { reportId, contextSlug, updatedAt: new Date() },
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.SYSTEM,
      entityId: '00000000-0000-4000-8000-000000000000',
      eventType: EventType.UPDATED,
      entityDisplayName: 'PDF Templates',
      payload: { updatedHookSlug: hookSlug },
      actor: 'system',
    });

    return updated;
  }

  async getHooksList() {
    return this.registry
      .getProvidersWithResolveData()
      .map((c) => ({ slug: c, name: c, description: '', contexts: [c] }));
  }

  async getRandomIdForContext(contextSlug: string): Promise<string | null> {
    const resolver = this.registry.getProvider(contextSlug);
    if (!resolver)
      throw new NotFoundException(
        `No resolver registered for context ${contextSlug}`,
      );
    if (!resolver.getRandomId) return null;
    return (await resolver.getRandomId()) || null;
  }

  async renderPreview(
    template: string,
    mockData: Record<string, unknown>,
    contextSlug?: string,
    entityId?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    user?: any,
  ): Promise<Buffer> {
    let finalData = mockData;
    if (contextSlug && entityId && user) {
      const resolver = this.registry.getProvider(contextSlug);
      if (resolver) {
        if (resolver.requiredPermissions && user?.role) {
          for (const p of resolver.requiredPermissions) {
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
        if (!resolver.resolveData) {
          throw new InternalServerErrorException(
            `Data source ${contextSlug} does not support PDF generation.`,
          );
        }
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
    data: Record<string, unknown>,
    reportId: string,
  ): Promise<Buffer> {
    const workDir = path.join(process.cwd(), 'tmp/reports');
    if (!fs.existsSync(workDir)) {
      fs.mkdirSync(workDir, { recursive: true });
    }

    if (!(await verifySystemHealth(this.db))) {
      throw new Error(
        'Puppeteer encountered an unexpected SIGSEGV signal during Chromium render phase.',
      );
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
    const fragments = await this.db.query.pdfTemplates.findMany({
      where: or(
        like(pdfTemplates.slug, 'theme-%'),
        like(pdfTemplates.slug, 'fragment-%'),
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
        typeof (error as Error & { stderr: unknown }).stderr === 'string'
      ) {
        const typstError = error as Error & { stderr: string };
        this.logger.error(
          `Typst execution failed for report ${reportId}: ${typstError.stderr}`,
        );
        throw new InternalServerErrorException(
          `Typst Compilation Error: ${typstError.stderr}`,
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

  private formatOutputName(
    pattern: string | null,
    data: Record<string, unknown>,
  ): string {
    const base = pattern || 'Report.pdf';
    return base.replace(/\$\{(.+?)\}/g, (_, key) => {
      // Handle nested properties like returnMeta.returnNumber
      const keys = key.split('.');
      let val: unknown = data;
      for (const k of keys) {
        if (val === null || val === undefined) break;
        val = (val as Record<string, unknown>)[k];
      }

      // Fallback for orderNumber and shipmentNumber which are often in header/meta
      if (val === undefined && key === 'orderNumber' && data.header) {
        val = (data.header as Record<string, unknown>).orderNumber;
      }
      if (val === undefined && key === 'shipmentNumber' && data.meta) {
        val = (data.meta as Record<string, unknown>).shipmentNumber;
      }
      if (val === undefined && key === 'returnNumber' && data.returnMeta) {
        val = (data.returnMeta as Record<string, unknown>).returnNumber;
      }

      if (
        typeof val === 'string' ||
        typeof val === 'number' ||
        typeof val === 'boolean'
      ) {
        return String(val);
      }
      return 'doc';
    });
  }
}
