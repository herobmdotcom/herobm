import { HelpTopic, HelpFieldDefinition } from './help.types';
import * as path from 'path';

/**
 * Parses frontmatter YAML block and markdown body from raw file contents.
 */
export function parseHelpMarkdown(
  rawContent: string,
  filePath: string,
): HelpTopic {
  const normalized = rawContent.replace(/\r\n/g, '\n');
  const frontmatterMatch = normalized.match(
    /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/,
  );

  const fallbackId = path
    .basename(filePath, path.extname(filePath))
    .replace(/_/g, '-');

  if (!frontmatterMatch) {
    const titleMatch = normalized.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : fallbackId;
    return {
      id: fallbackId,
      title,
      content: normalized.trim(),
      filePath,
      order: 999,
      routes: [],
      tags: [],
    };
  }

  const yamlBlock = frontmatterMatch[1];
  const markdownBody = frontmatterMatch[2] ? frontmatterMatch[2].trim() : '';

  const meta = parseSimpleYaml(yamlBlock);

  const titleMatch = markdownBody.match(/^#\s+(.+)$/m);
  const fallbackTitle = titleMatch ? titleMatch[1].trim() : fallbackId;

  return {
    id: typeof meta.id === 'string' ? meta.id : fallbackId,
    title: typeof meta.title === 'string' ? meta.title : fallbackTitle,
    category: typeof meta.category === 'string' ? meta.category : 'General',
    description:
      typeof meta.description === 'string' ? meta.description : undefined,
    order: typeof meta.order === 'number' ? meta.order : 999,
    routes: Array.isArray(meta.routes) ? (meta.routes as string[]) : [],
    resource: typeof meta.resource === 'string' ? meta.resource : undefined,
    action: typeof meta.action === 'string' ? meta.action : 'read',
    tags: Array.isArray(meta.tags) ? (meta.tags as string[]) : [],
    fields:
      typeof meta.fields === 'object' && meta.fields !== null
        ? (meta.fields as Record<string, HelpFieldDefinition | string>)
        : undefined,
    related: Array.isArray(meta.related) ? (meta.related as string[]) : [],
    content: markdownBody,
    filePath,
  };
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yaml.split('\n');

  let currentKey: string | null = null;
  let currentNestedKey: string | null = null;
  let inNestedMap = false;

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (!rawLine.trim() || rawLine.trim().startsWith('#')) continue;

    // Check indentation level
    const indent = rawLine.search(/\S/);
    const line = rawLine.trim();

    // Nested property (indent >= 4) inside a map of maps (e.g. fields -> field_name -> title / summary)
    if (indent >= 4 && inNestedMap && currentKey && currentNestedKey) {
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        const subKey = match[1];
        const val = cleanYamlValue(match[2]);
        const parentMap = result[currentKey] as
          | Record<string, Record<string, unknown>>
          | undefined;
        if (parentMap && parentMap[currentNestedKey]) {
          parentMap[currentNestedKey][subKey] = val;
        }
      }
      continue;
    }

    // Indented property (indent >= 2)
    if (indent >= 2 && currentKey) {
      // Bullet list item
      if (line.startsWith('- ')) {
        const item = cleanYamlValue(line.substring(2));
        if (!Array.isArray(result[currentKey])) {
          result[currentKey] = [];
        }
        (result[currentKey] as unknown[]).push(item);
        inNestedMap = false;
        continue;
      }

      // Key-value inside a dictionary (e.g., `fields:`)
      const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
      if (match) {
        const subKey = match[1];
        const subVal = match[2].trim();

        if (!result[currentKey] || typeof result[currentKey] !== 'object') {
          result[currentKey] = {};
        }

        const currentDict = result[currentKey] as Record<string, unknown>;

        if (subVal) {
          currentDict[subKey] = cleanYamlValue(subVal);
          currentNestedKey = null;
        } else {
          // Object key starts (e.g. `customer_id:`)
          currentDict[subKey] = {};
          currentNestedKey = subKey;
          inNestedMap = true;
        }
        continue;
      }
    }

    // Top-level property (indent == 0)
    currentNestedKey = null;
    inNestedMap = false;

    const match = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (match) {
      const key = match[1];
      const val = match[2].trim();

      currentKey = key;

      if (!val) {
        // Will be populated by following indented lines (list or map)
        result[key] = [];
      } else if (val.startsWith('[') && val.endsWith(']')) {
        // JSON array format: ["item1", "item2"]
        try {
          // Convert single quotes to double quotes for standard JSON parsing if needed
          const jsonString = val.replace(/'/g, '"');
          result[key] = JSON.parse(jsonString);
        } catch {
          result[key] = val
            .slice(1, -1)
            .split(',')
            .map((s) => cleanYamlValue(s.trim()))
            .filter(Boolean);
        }
      } else {
        result[key] = cleanYamlValue(val);
      }
    }
  }

  return result;
}

function cleanYamlValue(val: string): string | number | boolean | null {
  let cleaned = val.trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1);
  }

  if (cleaned === 'true') return true;
  if (cleaned === 'false') return false;
  if (cleaned === 'null') return null;
  if (/^-?\d+$/.test(cleaned)) return parseInt(cleaned, 10);
  if (/^-?\d+\.\d+$/.test(cleaned)) return parseFloat(cleaned);

  return cleaned;
}
