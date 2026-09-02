import { HelpService } from './help.service';
import { parseHelpMarkdown } from './help-parser';
import * as fs from 'fs';
import * as path from 'path';

describe('HelpService & HelpParser', () => {
  describe('parseHelpMarkdown', () => {
    it('should correctly parse full frontmatter and body', () => {
      const markdown = `---
id: test-topic
title: "Test Topic Title"
category: "Sales"
description: "A test topic for testing."
order: 2
routes:
  - "/test/route"
  - "/test/:id/edit"
resource: "orders"
action: "read"
tags: ["testing", "sales", "demo"]
fields:
  test_field:
    title: "Test Field"
    summary: "This is a field definition."
  simple_field: "A simple string description"
related:
  - "other-topic"
---

# Test Topic Title

This is the body content of the test documentation.
`;

      const result = parseHelpMarkdown(markdown, '/path/to/test-topic.md');

      expect(result.id).toBe('test-topic');
      expect(result.title).toBe('Test Topic Title');
      expect(result.category).toBe('Sales');
      expect(result.description).toBe('A test topic for testing.');
      expect(result.order).toBe(2);
      expect(result.routes).toEqual(['/test/route', '/test/:id/edit']);
      expect(result.resource).toBe('orders');
      expect(result.action).toBe('read');
      expect(result.tags).toEqual(['testing', 'sales', 'demo']);
      expect(result.fields).toBeDefined();
      expect((result.fields?.test_field as any).title).toBe('Test Field');
      expect((result.fields?.test_field as any).summary).toBe(
        'This is a field definition.',
      );
      expect(result.fields?.simple_field).toBe('A simple string description');
      expect(result.related).toEqual(['other-topic']);
      expect(result.content).toContain(
        'This is the body content of the test documentation.',
      );
    });

    it('should handle markdown without frontmatter gracefully', () => {
      const raw = `# Plain Document\n\nThis is plain text without frontmatter.`;
      const result = parseHelpMarkdown(raw, '/path/to/plain_doc.md');

      expect(result.id).toBe('plain-doc');
      expect(result.title).toBe('Plain Document');
      expect(result.routes).toEqual([]);
      expect(result.tags).toEqual([]);
      expect(result.content).toBe(raw);
    });
  });

  describe('HelpService', () => {
    let service: HelpService;
    let tempDir: string;

    const mockEnforcer = {
      enforce: jest
        .fn()
        .mockImplementation((role: string, resource: string) => {
          if (resource === 'restricted_res' && role !== 'admin') {
            return Promise.resolve(false);
          }
          return Promise.resolve(true);
        }),
    };

    beforeAll(() => {
      tempDir = path.join(__dirname, '__temp_test_docs__');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Create test doc 1: Sales Orders
      fs.writeFileSync(
        path.join(tempDir, 'sales.md'),
        `---
id: sales-orders
title: "Sales Orders"
category: "Sales"
order: 1
routes:
  - "/sales-orders"
  - "/sales-orders/new"
  - "/sales-orders/:id"
tags: ["sales", "orders", "commercial"]
fields:
  customer_id:
    title: "Customer"
    summary: "Select customer account"
related:
  - "invoices"
---

# Sales Orders
Guide on managing customer sales orders.
`,
      );

      // Create test doc 2: Invoices
      fs.writeFileSync(
        path.join(tempDir, 'invoices.md'),
        `---
id: invoices
title: "Invoices"
category: "Sales"
order: 2
routes:
  - "/invoices"
  - "/invoices/:id"
tags: ["billing", "finance"]
---

# Invoices
Guide on invoicing.
`,
      );

      // Create test doc 3: Restricted Doc
      fs.writeFileSync(
        path.join(tempDir, 'restricted.md'),
        `---
id: restricted-doc
title: "Restricted GL Setup"
category: "Finance"
resource: "restricted_res"
action: "read"
routes:
  - "/admin/secret"
tags: ["confidential"]
---

# Secret
Admin only doc.
`,
      );
    });

    afterAll(() => {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    beforeEach(async () => {
      service = new HelpService(mockEnforcer as any);
      await service.reloadDocs(tempDir);
    });

    it('should load topics from directory', async () => {
      const topics = await service.getTopics('admin');
      expect(topics.length).toBe(3);
    });

    it('should filter restricted topics for unauthorized users', async () => {
      const topics = await service.getTopics('viewer');
      expect(topics.some((t) => t.id === 'restricted-doc')).toBe(false);
      expect(topics.some((t) => t.id === 'sales-orders')).toBe(true);
    });

    it('should match exact route context', async () => {
      const context = await service.getContextHelp(
        '/sales-orders/new',
        'admin',
      );
      expect(context.topic).toBeDefined();
      expect(context.topic?.id).toBe('sales-orders');
      expect(context.matchedRoute).toBe('/sales-orders/new');
      expect(context.relatedTopics.length).toBe(1);
      expect(context.relatedTopics[0].id).toBe('invoices');
    });

    it('should match parameterized route context', async () => {
      const context = await service.getContextHelp(
        '/sales-orders/550e8400-e29b-41d4-a716-446655440000',
        'admin',
      );
      expect(context.topic).toBeDefined();
      expect(context.topic?.id).toBe('sales-orders');
      expect(context.matchedRoute).toBe('/sales-orders/:id');
    });

    it('should return null topic for unmatched route', async () => {
      const context = await service.getContextHelp(
        '/unmatched-nonexistent-path',
        'admin',
      );
      expect(context.topic).toBeNull();
    });

    it('should search topics by title, tag, field, and content', async () => {
      const resultsByTag = await service.search('commercial', 'admin');
      expect(resultsByTag.length).toBeGreaterThan(0);
      expect(resultsByTag[0].id).toBe('sales-orders');

      const resultsByField = await service.search('customer_id', 'admin');
      expect(resultsByField.length).toBeGreaterThan(0);
      expect(resultsByField[0].id).toBe('sales-orders');

      const resultsByContent = await service.search('invoicing', 'admin');
      expect(resultsByContent.length).toBeGreaterThan(0);
      expect(resultsByContent[0].id).toBe('invoices');
    });

    it('should successfully load real user docs and match scan-to-dispatch route', async () => {
      const realDocsDir = path.resolve(__dirname, '../../../../docs/user');
      if (fs.existsSync(realDocsDir)) {
        await service.reloadDocs(realDocsDir);
        const allTopics = await service.getTopics('admin');
        expect(allTopics.length).toBeGreaterThan(20);

        const scanContext = await service.getContextHelp(
          '/inventory/shipping/scan-to-dispatch',
          'admin',
        );
        expect(scanContext.topic).toBeDefined();
        expect(scanContext.topic?.id).toBe('inventory-shipping');
        expect(scanContext.matchedRoute).toBe(
          '/inventory/shipping/scan-to-dispatch',
        );

        const searchResults = await service.search('scan to dispatch', 'admin');
        expect(searchResults.length).toBeGreaterThan(0);
        expect(searchResults.some((r) => r.id === 'inventory-shipping')).toBe(
          true,
        );
      }
    });

    it('should ensure all user documentation files are free of raw LaTeX/KaTeX math noise', () => {
      const realDocsDir = path.resolve(__dirname, '../../../../docs/user');
      if (!fs.existsSync(realDocsDir)) return;

      const files = fs
        .readdirSync(realDocsDir)
        .filter((f) => f.endsWith('.md'));

      const violations: string[] = [];

      for (const file of files) {
        const filePath = path.join(realDocsDir, file);
        const rawContent = fs.readFileSync(filePath, 'utf-8');

        // Remove fenced code blocks (```...```) to avoid false positives on programming code
        const strippedContent = rawContent.replace(/```[\s\S]*?```/g, '');

        const lines = strippedContent.split('\n');
        lines.forEach((line, index) => {
          // Check for LaTeX tokens like $$, \text, \frac, \times, \sum, \ge, \le, \pm, etc.
          // or math expressions enclosed in $...$
          const mathDelimMatch = line.match(/\$\$|\$[^$\n]+\$/);
          const latexCmdMatch = line.match(
            /\\(text|frac|times|sum|ge|le|pm|cdot|sqrt|approx|ne|alpha|beta|sigma|infty|left|right|begin|end)\b/,
          );

          if (mathDelimMatch || latexCmdMatch) {
            violations.push(`${file}:${index + 1}: "${line.trim()}"`);
          }
        });
      }

      expect(violations).toEqual([]);
    });
  });
});
