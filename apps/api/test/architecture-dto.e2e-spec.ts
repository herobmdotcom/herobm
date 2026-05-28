import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Structural Test: Controllers (e2e)', () => {
  it("should not use @Body('prop') inline properties or typeless @Body() payloads", () => {
    const srcDir = path.join(__dirname, '../src');

    function walk(dir: string): string[] {
      let results: string[] = [];
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.controller.ts')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const controllerFiles = walk(srcDir);
    const errors: string[] = [];

    for (const file of controllerFiles) {
      const code = fs.readFileSync(file, 'utf8');
      const lines = code.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Match @Body('someProp')
        if (/@Body\(['"]/.test(line)) {
          errors.push(
            `\nFile: ${file}:${i + 1}\nReason: Uses @Body('prop') which breaks OpenAPI schema generation.\nLine: ${line.trim()}`,
          );
        }

        // Match @Body() something: any
        if (/@Body\(\)\s+\w+:\s*any/.test(line)) {
          errors.push(
            `\nFile: ${file}:${i + 1}\nReason: Uses @Body() with 'any' type which breaks OpenAPI schema generation.\nLine: ${line.trim()}`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `\nTypeless Body Anti-Pattern detected in controllers:\n\n${errors.join('\n')}\n\n` +
          `To fix this, create a proper DTO class and use @Body() dto: MyDto.`,
      );
    }
  });
});
