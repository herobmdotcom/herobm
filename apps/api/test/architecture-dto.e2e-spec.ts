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

          // Gather preceding lines into a single block to handle multiline decorators
          let decoratorBlock = '';
          for (let j = i - 1; j >= 0; j--) {
            const prevLine = lines[j];
            decoratorBlock = prevLine + '\n' + decoratorBlock;
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

          // Gather succeeding lines if decorator isn't above (rare but possible)
          let forwardDecoratorBlock = '';
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j];
            forwardDecoratorBlock += nextLine + '\n';
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

          const combinedBlock = decoratorBlock + '\n' + forwardDecoratorBlock;

          if (
            combinedBlock.includes('@ApiOkResponse') ||
            combinedBlock.includes('@ApiCreatedResponse') ||
            combinedBlock.includes('@ApiPaginatedResponse')
          ) {
            hasResponseDec = true;
            if (
              combinedBlock.includes('type: Object') ||
              (!combinedBlock.includes('type:') &&
                !combinedBlock.includes('@ApiPaginatedResponse'))
            ) {
              if (!combinedBlock.includes('BYPASS-TYPING-TEST')) {
                hasTypelessResponseDec = true;
              }
            }
          }

          if (!hasResponseDec) {
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

  it('should enforce @ApiQuery({ required: false }) for optional @Query parameters', () => {
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

      // Match @Query('paramName') paramVar?: type
      // Match @Query('paramName') paramVar: type =
      // We do a global regex over the whole file string for easier multi-line matching

      const queryRegex =
        /@Query\(['"]([^'"]+)['"]\)\s+\w+\s*(?:[?]:|:\s*\w+\s*=)/g;
      let match;
      while ((match = queryRegex.exec(code)) !== null) {
        const paramName = match[1];

        // Find the method this belongs to by looking backwards for @Get, @Post, etc.
        const textBefore = code.substring(0, match.index);

        // Find the nearest method decorator before this parameter
        const methodMatchIndex = Math.max(
          textBefore.lastIndexOf('@Get('),
          textBefore.lastIndexOf('@Post('),
          textBefore.lastIndexOf('@Patch('),
          textBefore.lastIndexOf('@Put('),
          textBefore.lastIndexOf('@Delete('),
        );

        if (methodMatchIndex !== -1) {
          // Extract the block from the method decorator down to the match
          // Wait, the @ApiQuery decorators usually appear ABOVE the @Get/@Post decorators.
          // Let's grab a chunk of text above the method decorator.
          const searchStart = Math.max(0, methodMatchIndex - 2000); // look up to 2000 chars above
          const decoratorBlock = code.substring(searchStart, match.index);

          // Check if it has @ApiQuery({ name: 'paramName', required: false })
          // We look for name: 'paramName' and required: false within the same @ApiQuery block
          const apiQueryRegex = new RegExp(
            `@ApiQuery\\([^)]*name:\\s*['"]${paramName}['"][^)]*required:\\s*false[^)]*\\)`,
          );

          if (
            !apiQueryRegex.test(decoratorBlock) &&
            !decoratorBlock.includes('BYPASS-OPTIONAL-TEST')
          ) {
            errors.push(
              `\nFile: ${file}\nReason: Optional parameter '${paramName}' is missing @ApiQuery({ name: '${paramName}', required: false })`,
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `\nOptional Query Parameter Anti-Pattern detected:\n\n${errors.join('\n')}\n\n` +
          `To fix this, add @ApiQuery({ name: 'paramName', required: false }) above the route method.`,
      );
    }
  });

  it('should provide generic types for array responses in @ApiOkResponse', () => {
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

      // Match methods that explicitly return an array: Promise<SomeType[]> or SomeType[]
      // For simplicity, we match async methodName(...): Promise<Type[]> or methodName(...): Type[]
      const methodRegex =
        /(?:async\s+)?\w+\s*\([^)]*\)\s*:\s*(?:Promise<)?\w+\[\](?:>)?\s*\{/g;

      let match;
      while ((match = methodRegex.exec(code)) !== null) {
        const methodSig = match[0];

        const textBefore = code.substring(0, match.index);
        const searchStart = Math.max(0, match.index - 2000);
        const decoratorBlock = code.substring(searchStart, match.index);

        // If it's a route method, it must have @Get, @Post, etc.
        if (!/@(?:Get|Post|Patch|Put|Delete)\(/.test(decoratorBlock)) {
          continue;
        }

        // Must have type: [...] or @ApiPaginatedResponse
        // We look for type: [ within the decorator block
        if (
          !/type:\s*\[/.test(decoratorBlock) &&
          !/@ApiPaginatedResponse/.test(decoratorBlock) &&
          !decoratorBlock.includes('BYPASS-ARRAY-TEST')
        ) {
          errors.push(
            `\nFile: ${file}\nReason: Method returning an array lacks type: [Dto] in its response decorator.\nSignature: ${methodSig.trim()}`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `\nTypeless Array Anti-Pattern detected:\n\n${errors.join('\n')}\n\n` +
          `To fix this, ensure your @ApiOkResponse uses type: [MyDto].`,
      );
    }
  });
});
