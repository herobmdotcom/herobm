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

        // Match @Get, @Post, @Patch, @Delete to ensure they have @ApiOkResponse or @ApiCreatedResponse
        const methodMatch = /@(Get|Post|Patch|Delete|Put)\(/.test(line);
        if (methodMatch) {
          // Look backwards for decorators on this method
          let hasResponseDec = false;
          let hasTypelessResponseDec = false;
          for (let j = i - 1; j >= 0; j--) {
            const prevLine = lines[j];
            if (
              prevLine.includes('@ApiOkResponse') ||
              prevLine.includes('@ApiCreatedResponse') ||
              prevLine.includes('@ApiPaginatedResponse')
            ) {
              hasResponseDec = true;
              if (
                prevLine.includes('type: Object') ||
                (!prevLine.includes('type:') &&
                  !prevLine.includes('@ApiPaginatedResponse'))
              ) {
                if (
                  !prevLine.includes('BYPASS-TYPING-TEST') &&
                  !lines[j + 1]?.includes('BYPASS-TYPING-TEST')
                ) {
                  hasTypelessResponseDec = true;
                }
              }
              break;
            }
            if (
              prevLine.includes('@Get') ||
              prevLine.includes('@Post') ||
              prevLine.includes('@Patch') ||
              prevLine.includes('@Delete') ||
              prevLine.includes('@Put') ||
              prevLine.includes('class ') ||
              prevLine.trim().startsWith('async ') ||
              (prevLine.includes('{') && !prevLine.trim().startsWith('@')) ||
              (prevLine.includes('(') && !prevLine.trim().startsWith('@'))
            ) {
              break;
            }
          }
          // Look forwards if not found backwards
          if (!hasResponseDec) {
            for (let j = i + 1; j < lines.length; j++) {
              const nextLine = lines[j];
              if (
                nextLine.includes('@ApiOkResponse') ||
                nextLine.includes('@ApiCreatedResponse') ||
                nextLine.includes('@ApiPaginatedResponse')
              ) {
                hasResponseDec = true;
                if (
                  nextLine.includes('type: Object') ||
                  (!nextLine.includes('type:') &&
                    !nextLine.includes('@ApiPaginatedResponse'))
                ) {
                  if (
                    !nextLine.includes('BYPASS-TYPING-TEST') &&
                    !lines[j + 1]?.includes('BYPASS-TYPING-TEST')
                  ) {
                    hasTypelessResponseDec = true;
                  }
                }
                break;
              }
              if (
                nextLine.includes('@Get') ||
                nextLine.includes('@Post') ||
                nextLine.includes('@Patch') ||
                nextLine.includes('@Delete') ||
                nextLine.includes('@Put') ||
                nextLine.includes('class ') ||
                nextLine.trim().startsWith('async ') ||
                (nextLine.includes('{') && !nextLine.trim().startsWith('@')) ||
                (nextLine.includes('(') && !nextLine.trim().startsWith('@'))
              ) {
                break;
              }
            }
          }

          if (!hasResponseDec) {
            // For now we just check if it's missing entirely (some routes might legitimately return void, but let's enforce explicitly typing them)
            errors.push(
              `\nFile: ${file}:${i + 1}\nReason: Route is missing @ApiOkResponse or @ApiCreatedResponse.\nLine: ${line.trim()}`,
            );
          } else if (hasTypelessResponseDec) {
            errors.push(
              `\nFile: ${file}:${i + 1}\nReason: Route uses typeless @ApiOkResponse / @ApiCreatedResponse (e.g. type: Object or missing type).\nLine: ${line.trim()}`,
            );
          }
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
