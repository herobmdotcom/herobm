import {
  Injectable,
  Inject,
  Logger,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { Enforcer } from 'casbin';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import {
  HelpTopic,
  HelpContextResponse,
  HelpTopicSummary,
  HelpSearchResult,
} from './help.types';
import { parseHelpMarkdown } from './help-parser';

@Injectable()
export class HelpService implements OnModuleInit {
  private readonly logger = new Logger(HelpService.name);
  private topics: Map<string, HelpTopic> = new Map();
  private docsDirs: string[] = [];
  private lastScanTime = 0;
  private readonly CACHE_TTL_MS = 300000; // 5 minutes

  constructor(
    @Optional()
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer?: Enforcer,
  ) {}

  async onModuleInit(): Promise<void> {
    this.resolveDocsDirs();
    await this.reloadDocs();
  }

  private async ensureFreshDocs(): Promise<void> {
    const now = Date.now();
    if (now - this.lastScanTime > this.CACHE_TTL_MS || this.topics.size === 0) {
      await this.reloadDocs(
        this.docsDirs.length > 0 ? this.docsDirs : undefined,
      );
      this.lastScanTime = now;
    }
  }

  public resolveDocsDir(customDir?: string): string {
    const dirs = this.resolveDocsDirs(customDir);
    return dirs[0] || '';
  }

  public resolveDocsDirs(customDirs?: string | string[]): string[] {
    if (customDirs) {
      const array = Array.isArray(customDirs) ? customDirs : [customDirs];
      const existing = array.filter((d) => fs.existsSync(d));
      if (existing.length > 0) {
        this.docsDirs = existing;
        return this.docsDirs;
      }
    }

    if (
      this.docsDirs.length > 0 &&
      this.docsDirs.every((d) => fs.existsSync(d))
    ) {
      return this.docsDirs;
    }

    const candidateRoots = [
      path.resolve(process.cwd(), 'docs'),
      path.resolve(__dirname, '../../../docs'),
      path.resolve(__dirname, '../../../../docs'),
      path.resolve(process.cwd(), '../../docs'),
    ];

    for (const root of candidateRoots) {
      if (fs.existsSync(root)) {
        const subDirs = ['user', 'developers', 'technical']
          .map((sub) => path.join(root, sub))
          .filter((d) => fs.existsSync(d));

        if (subDirs.length > 0) {
          this.docsDirs = subDirs;
          return this.docsDirs;
        }

        this.docsDirs = [root];
        return this.docsDirs;
      }
    }

    // Fallback if root not found
    this.docsDirs = [path.resolve(process.cwd(), 'docs/user')];
    return this.docsDirs;
  }

  public async reloadDocs(customDirs?: string | string[]): Promise<void> {
    const dirs = customDirs
      ? Array.isArray(customDirs)
        ? customDirs
        : [customDirs]
      : this.resolveDocsDirs();

    this.topics.clear();
    this.lastScanTime = Date.now();

    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        this.logger.warn(`Documentation directory not found at: ${dir}`);
        continue;
      }

      const files = this.scanDirForMarkdown(dir);
      for (const filePath of files) {
        try {
          const rawContent = fs.readFileSync(filePath, 'utf-8');
          const topic = parseHelpMarkdown(rawContent, filePath);
          this.topics.set(topic.id, topic);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : String(err);
          this.logger.error(
            `Failed to parse help file ${filePath}: ${message}`,
          );
        }
      }
    }

    this.logger.debug(
      `Loaded ${this.topics.size} documentation topics from ${dirs.join(', ')}`,
    );
  }

  private scanDirForMarkdown(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const item of list) {
      if (
        item === 'archive' ||
        item === 'node_modules' ||
        item.startsWith('.')
      ) {
        continue;
      }

      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.scanDirForMarkdown(fullPath));
      } else if (fullPath.endsWith('.md') || fullPath.endsWith('.mdx')) {
        // Skip massive 800KB+ generated Widdershins file from in-memory interactive help drawer
        if (item === 'api-reference.md' && stat.size > 200000) {
          continue;
        }
        results.push(fullPath);
      }
    }
    return results;
  }

  public async isAuthorized(
    topic: HelpTopic,
    userRole?: string,
  ): Promise<boolean> {
    if (!topic.resource) return true;
    if (!userRole || userRole === 'admin') return true;
    if (!this.enforcer) return true;

    try {
      return await this.enforcer.enforce(
        userRole,
        topic.resource,
        topic.action || 'read',
      );
    } catch {
      return false;
    }
  }

  /**
   * Matches an active URL route to the most relevant documentation topic.
   */
  public async getContextHelp(
    route: string,
    userRole?: string,
  ): Promise<HelpContextResponse> {
    await this.ensureFreshDocs();
    const cleanRoute = (route || '/').split('?')[0].replace(/\/$/, '') || '/';
    let bestMatch: { topic: HelpTopic; score: number; pattern: string } | null =
      null;

    for (const topic of this.topics.values()) {
      if (!(await this.isAuthorized(topic, userRole))) continue;

      for (const pattern of topic.routes || []) {
        const score = this.calculateRouteMatchScore(cleanRoute, pattern);
        if (score > 0) {
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { topic, score, pattern };
          }
        }
      }
    }

    if (!bestMatch) {
      // Fallback: If on root dashboard '/', check for topic with id 'dashboard' or '/'
      if (cleanRoute === '/') {
        const dashboardTopic = this.topics.get('dashboard');
        if (
          dashboardTopic &&
          (await this.isAuthorized(dashboardTopic, userRole))
        ) {
          return {
            topic: dashboardTopic,
            matchedRoute: '/',
            relatedTopics: await this.getRelatedTopics(
              dashboardTopic,
              userRole,
            ),
          };
        }
      }

      return {
        topic: null,
        relatedTopics: [],
      };
    }

    const relatedTopics = await this.getRelatedTopics(
      bestMatch.topic,
      userRole,
    );

    return {
      topic: bestMatch.topic,
      matchedRoute: bestMatch.pattern,
      relatedTopics,
    };
  }

  private calculateRouteMatchScore(route: string, pattern: string): number {
    const cleanPattern =
      (pattern || '').split('?')[0].replace(/\/$/, '') || '/';
    if (route === cleanPattern) return 100;

    // Pattern with route parameters e.g. /purchase-orders/:id or /sales-orders/:id/edit
    const routeParts = route.split('/').filter(Boolean);
    const patternParts = cleanPattern.split('/').filter(Boolean);

    if (routeParts.length === patternParts.length) {
      let isMatch = true;
      let score = 80;
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':') || patternParts[i] === '*') {
          score -= 5;
        } else if (patternParts[i] !== routeParts[i]) {
          isMatch = false;
          break;
        }
      }
      if (isMatch) return score;
    }

    // Prefix wildcard pattern e.g. /inventory/*
    if (cleanPattern.endsWith('/*')) {
      const prefix = cleanPattern.slice(0, -2);
      if (route === prefix || route.startsWith(prefix + '/')) {
        return 50;
      }
    }

    // Base route prefix fallback
    if (cleanPattern !== '/' && route.startsWith(cleanPattern + '/')) {
      return 40;
    }

    return 0;
  }

  private async getRelatedTopics(
    topic: HelpTopic,
    userRole?: string,
  ): Promise<Array<{ id: string; title: string; category?: string }>> {
    const related: Array<{ id: string; title: string; category?: string }> = [];
    if (!topic.related) return related;

    for (const relId of topic.related) {
      const t = this.topics.get(relId);
      if (t && (await this.isAuthorized(t, userRole))) {
        related.push({
          id: t.id,
          title: t.title,
          category: t.category,
        });
      }
    }
    return related;
  }

  public static readonly CATEGORY_ORDER: readonly string[] = [
    'Overview',
    'Dashboard',
    'Sales',
    'Inventory',
    'Purchasing',
    'Manufacturing',
    'CRM',
    'Finance',
    'Reporting',
    'Administration',
    'Developer',
    'Architecture & Engineering',
    'Miscellaneous',
  ];

  /**
   * Retrieves all available topics as a structured list / tree.
   */
  public async getTopics(userRole?: string): Promise<HelpTopicSummary[]> {
    await this.ensureFreshDocs();
    const results: HelpTopicSummary[] = [];

    for (const topic of this.topics.values()) {
      if (await this.isAuthorized(topic, userRole)) {
        results.push({
          id: topic.id,
          title: topic.title,
          category: topic.category || 'Miscellaneous',
          description: topic.description,
          order: topic.order ?? 999,
          routes: topic.routes || [],
          tags: topic.tags || [],
        });
      }
    }

    return results.sort((a, b) => {
      const idxA = HelpService.CATEGORY_ORDER.indexOf(a.category);
      const idxB = HelpService.CATEGORY_ORDER.indexOf(b.category);
      const catOrderA = idxA !== -1 ? idxA : 990;
      const catOrderB = idxB !== -1 ? idxB : 990;
      if (catOrderA !== catOrderB) return catOrderA - catOrderB;

      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
  }

  /**
   * Retrieves full topic detail by unique topic ID.
   */
  public async getTopicById(
    id: string,
    userRole?: string,
  ): Promise<HelpTopic | null> {
    await this.ensureFreshDocs();
    const topic = this.topics.get(id);
    if (!topic) return null;
    if (!(await this.isAuthorized(topic, userRole))) return null;
    return topic;
  }

  /**
   * Fast full-text and tag search across all accessible documentation.
   */
  public async search(
    query: string,
    userRole?: string,
  ): Promise<HelpSearchResult[]> {
    await this.ensureFreshDocs();
    if (!query || !query.trim()) return [];

    const q = query.toLowerCase().trim();
    const results: HelpSearchResult[] = [];

    for (const topic of this.topics.values()) {
      if (!(await this.isAuthorized(topic, userRole))) continue;

      let score = 0;
      const titleLower = topic.title.toLowerCase();
      const contentLower = topic.content.toLowerCase();
      const categoryLower = (topic.category || '').toLowerCase();

      if (titleLower === q) score += 100;
      else if (titleLower.includes(q)) score += 50;

      if (topic.tags?.some((t) => t.toLowerCase() === q)) score += 40;
      else if (topic.tags?.some((t) => t.toLowerCase().includes(q)))
        score += 20;

      if (categoryLower.includes(q)) score += 15;

      if (topic.fields) {
        for (const [key, val] of Object.entries(topic.fields)) {
          const fieldKey = key.toLowerCase();
          const fieldSummary = (
            typeof val === 'string' ? val : val.summary || ''
          ).toLowerCase();
          const fieldTitle = (
            typeof val === 'object' ? val.title || '' : ''
          ).toLowerCase();

          if (
            fieldKey.includes(q) ||
            fieldTitle.includes(q) ||
            fieldSummary.includes(q)
          ) {
            score += 25;
          }
        }
      }

      const matchIndex = contentLower.indexOf(q);
      if (matchIndex !== -1) {
        score += 10;
      }

      if (score > 0) {
        // Extract snippet
        let snippet = topic.description || '';
        if (matchIndex !== -1) {
          const start = Math.max(0, matchIndex - 60);
          const end = Math.min(
            topic.content.length,
            matchIndex + q.length + 80,
          );
          snippet =
            (start > 0 ? '...' : '') +
            topic.content.substring(start, end).replace(/\n+/g, ' ') +
            (end < topic.content.length ? '...' : '');
        }

        results.push({
          id: topic.id,
          title: topic.title,
          category: topic.category || 'General',
          snippet,
          score,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score);
  }
}
