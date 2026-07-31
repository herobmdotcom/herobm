import * as fs from 'fs';
import * as path from 'path';

/**
 * Extract the JS property names from a Drizzle `pgSchema.table(...)` call.
 */
export function getSchemaColumns(
  schemaFilePath: string,
  tableName: string,
): string[] {
  let src = '';
  if (fs.statSync(schemaFilePath).isDirectory()) {
    const files = fs
      .readdirSync(schemaFilePath)
      .filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      src += fs.readFileSync(path.join(schemaFilePath, file), 'utf-8') + '\\n';
    }
  } else if (schemaFilePath.endsWith('index.ts')) {
    const dir = path.dirname(schemaFilePath);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
    for (const file of files) {
      src += fs.readFileSync(path.join(dir, file), 'utf-8') + '\\n';
    }
  } else {
    src = fs.readFileSync(schemaFilePath, 'utf-8');
  }

  // Find the table definition block: export const <tableName> = herobmCore.table(...)
  const tableRegex = new RegExp(
    `export const ${tableName}\\s*=\\s*(?:herobmCore\\.)?table\\([^,]+,\\s*\\{([\\s\\S]*?)\\n[ \\t]*\\}(?:\\);|,)`,
    's',
  );
  const match = src.match(tableRegex);
  if (!match) {
    throw new Error(
      `Could not find table '${tableName}' in schema file: ${schemaFilePath}`,
    );
  }

  const body = match[1];
  // Extract property names (the JS key before the colon) where the value is a function call
  // like `customerId: uuid('customer_id')` to avoid matching `{ withTimezone: true }`
  const propRegex = /^\s*(\w+)\s*:\s*\w+\(/gm;
  const columns: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = propRegex.exec(body)) !== null) {
    columns.push(m[1]);
  }
  return columns;
}

/**
 * Extract the field names from the `.select({...})` block inside a specified method in a service.
 */
export function getFindOneProjectionFields(
  serviceFilePath: string,
  methodName = 'async findOne(',
): string[] {
  const src = fs.readFileSync(serviceFilePath, 'utf-8');

  // Locate the method and its select({...}) block
  const methodIdx = src.indexOf(methodName);
  if (methodIdx === -1) {
    throw new Error(
      `Could not find method '${methodName}' in ${serviceFilePath}`,
    );
  }

  const afterMethod = src.substring(methodIdx);

  // Find the .select({ ... }) block
  const selectStart = afterMethod.indexOf('.select({');
  if (selectStart === -1) {
    // If no explicit select, it returns all columns — pass automatically
    return [];
  }

  // Extract the content between .select({ and the matching })
  const selectBody = afterMethod.substring(selectStart + '.select({'.length);
  const closingIdx = selectBody.indexOf('})');
  if (closingIdx === -1) {
    throw new Error('Could not find closing }) for select projection');
  }

  const projectionBody = selectBody.substring(0, closingIdx);

  // Extract property names (keys of the projection object)
  const propRegex = /^\s*(\w+)\s*:/gm;
  const fields: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = propRegex.exec(projectionBody)) !== null) {
    fields.push(m[1]);
  }
  return fields;
}

/**
 * Extract property names from a NestJS DTO class.
 * This reads the source file and extracts properties defined in the class.
 */
export function getDtoProperties(
  dtoFilePath: string,
  className: string,
): string[] {
  const src = fs.readFileSync(dtoFilePath, 'utf-8');

  // Match the class body, stopping at the first `}` that is at the start of a line
  // This avoids stopping at nested braces in decorators like `@Transform(({ value }) => ...)`
  const classRegex = new RegExp(
    `export class ${className}[^\\{]*\\{([\\s\\S]*?)^\\s*\\}`,
    'sm',
  );
  const match = src.match(classRegex);
  if (!match) {
    throw new Error(`Could not find class '${className}' in ${dtoFilePath}`);
  }

  const body = match[1];

  // Extract property names, skipping decorators.
  // Match lines like: `propertyName!: string;` or `propertyName?: string;`
  // We look for a valid identifier followed by !: or ?: or :
  const propRegex = /^\s*(\w+)[!?]?\s*:/gm;
  const fields: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = propRegex.exec(body)) !== null) {
    fields.push(m[1]);
  }
  return fields;
}
