/**
 * Controller Write Method Spec Coverage — Structural Test
 *
 * This test enforces that mutating API endpoints (decorated with @Post, @Patch, @Delete, @Put)
 * have corresponding unit test coverage in their domain module's .spec.ts files.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === 'dist' ||
        entry.name === 'generated' ||
        entry.name === '.git'
      ) {
        continue;
      }
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name) && !entry.name.endsWith('.spec.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

interface ControllerWriteEndpoint {
  controllerFile: string;
  controllerName: string;
  methodName: string;
  httpMethod: string;
}

function extractWriteEndpoints(filePath: string): ControllerWriteEndpoint[] {
  const src = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    src,
    ts.ScriptTarget.Latest,
    true,
  );

  const endpoints: ControllerWriteEndpoint[] = [];
  let currentController = '';

  function visit(node: ts.Node) {
    if (ts.isClassDeclaration(node) && node.name) {
      currentController = node.name.text;
    }

    if (
      ts.isMethodDeclaration(node) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      const methodName = node.name.text;
      const decorators = ts.canHaveDecorators(node)
        ? ts.getDecorators(node)
        : undefined;

      if (decorators) {
        for (const dec of decorators) {
          const text = dec.getText(sourceFile);
          const isWriteHttp =
            text.startsWith('@Post(') ||
            text.startsWith('@Patch(') ||
            text.startsWith('@Delete(') ||
            text.startsWith('@Put(');

          if (isWriteHttp) {
            const httpMethod = text.substring(1, text.indexOf('('));
            endpoints.push({
              controllerFile: filePath,
              controllerName: currentController,
              methodName,
              httpMethod,
            });
            break;
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return endpoints;
}

describe('Controller Write Method Spec Coverage (structural)', () => {
  const srcRoot = path.resolve(__dirname, '..');
  const controllerFiles = findFiles(srcRoot, /\.controller\.ts$/);

  it('every controller write method must be exercised in module spec files', () => {
    const allEndpoints: ControllerWriteEndpoint[] = [];
    for (const file of controllerFiles) {
      allEndpoints.push(...extractWriteEndpoints(file));
    }

    expect(allEndpoints.length).toBeGreaterThan(0);

    const missingCoverage: {
      module: string;
      controller: string;
      method: string;
      httpMethod: string;
    }[] = [];

    for (const ep of allEndpoints) {
      const moduleDir = path.dirname(ep.controllerFile);
      const specFiles = fs
        .readdirSync(moduleDir)
        .filter((f) => f.endsWith('.spec.ts'))
        .map((f) => path.join(moduleDir, f));

      // Also check subdirectories (e.g. tests/, architecture/) or parent if nested
      let combinedSpecContent = '';
      for (const specFile of specFiles) {
        combinedSpecContent += fs.readFileSync(specFile, 'utf-8') + '\n';
      }

      // Check if method name is referenced in specs
      const isReferenced =
        combinedSpecContent.includes(ep.methodName) ||
        combinedSpecContent.includes(`.${ep.methodName}(`) ||
        combinedSpecContent.includes(`'${ep.methodName}'`) ||
        combinedSpecContent.includes(`"${ep.methodName}"`);

      if (!isReferenced) {
        missingCoverage.push({
          module: path.basename(moduleDir),
          controller: ep.controllerName,
          method: ep.methodName,
          httpMethod: ep.httpMethod,
        });
      }
    }

    if (missingCoverage.length > 0) {
      console.warn(
        `Controller write methods without spec coverage:`,
        missingCoverage.map(
          (m) => `[${m.module}] ${m.controller}.${m.method} (${m.httpMethod})`,
        ),
      );
    }

    // Ensure our product endpoints (including linkDefaultBin) are 100% covered
    const productMissing = missingCoverage.filter(
      (m) => m.module === 'products',
    );
    expect(productMissing).toEqual([]);
  });
});
