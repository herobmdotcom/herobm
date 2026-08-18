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
  private docsDir: string = '';

  constructor(
    @Optional()
    @Inject(CASBIN_ENFORCER)
    private readonly enforcer?: Enforcer,
  ) {}

  async onModuleInit(): Promise<void> {
    this.resolveDocsDir();
    await this.reloadDocs();
  }

  public resolveDocsDir(customDir?: string): string {
    if (customDir && fs.existsSync(customDir)) {
      this.docsDir = customDir;
      return this.docsDir;
    }

    const candidatePaths = [
      path.resolve(process.cwd(), 'docs/user'),
      path.resolve(__dirname, '../../../docs/user'),
      path.resolve(__dirname, '../../../../docs/user'),
      path.resolve(process.cwd(), '../../docs/user'),
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        this.docsDir = p;
        return this.docsDir;
      }
    }

    this.docsDir = candidatePaths[0];
    return this.docsDir;
  }

  public async reloadDocs(customDir?: string): Promise<void> {
    const dir = this.resolveDocsDir(customDir);
    this.topics.clear();

    if (!fs.existsSync(dir)) {
      this.logger.warn(`User docs directory not found at: ${dir}`);
      return;
    }

    const files = this.scanDirForMarkdown(dir);
    for (const filePath of files) {
      try {
        const rawContent = fs.readFileSync(filePath, 'utf-8');
        const topic = parseHelpMarkdown(rawContent, filePath);
        this.topics.set(topic.id, topic);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.error(`Failed to parse help file ${filePath}: ${message}`);
      }
    }

    this.logger.log(
      `Loaded ${this.topics.size} user documentation topics from ${dir}`,
    );
  }

  private scanDirForMarkdown(dir: string): string[] {
    let results: string[] = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir);
    for (const item of list) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      if (stat && stat.isDirectory()) {
        results = results.concat(this.scanDirForMarkdown(fullPath));
      } else if (fullPath.endsWith('.md') || fullPath.endsWith('.mdx')) {
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
      const dashboardTopic = this.topics.get('dashboard');
      if (
        dashboardTopic &&
        (await this.isAuthorized(dashboardTopic, userRole))
      ) {
        return {
          topic: dashboardTopic,
          matchedRoute: '/',
          relatedTopics: await this.getRelatedTopics(dashboardTopic, userRole),
        };
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

  /**
   * Retrieves all available topics as a structured list / tree.
   */
  public async getTopics(userRole?: string): Promise<HelpTopicSummary[]> {
    const results: HelpTopicSummary[] = [];

    for (const topic of this.topics.values()) {
      if (await this.isAuthorized(topic, userRole)) {
        results.push({
          id: topic.id,
          title: topic.title,
          category: topic.category || 'General',
          description: topic.description,
          order: topic.order ?? 999,
          routes: topic.routes || [],
          tags: topic.tags || [],
        });
      }
    }

    return results.sort((a, b) => {
      if (a.category !== b.category)
        return a.category.localeCompare(b.category);
      return (a.order || 999) - (b.order || 999);
    });
  }

  /**
   * Retrieves full topic detail by unique topic ID.
   */
  public async getTopicById(
    id: string,
    userRole?: string,
  ): Promise<HelpTopic | null> {
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
