import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';

describe('Swagger DTO Conventions', () => {
  it('should enforce that all classes used in @Body or @Query reside in a .dto.ts file', () => {
    const project = new Project();
    const apiSrcPath = path.resolve(__dirname, '../src/**/*.controller.ts');
    project.addSourceFilesAtPaths(apiSrcPath);

    const violations: string[] = [];

    project.getSourceFiles().forEach((sourceFile) => {
      sourceFile.getClasses().forEach((cls) => {
        cls.getMethods().forEach((method) => {
          const isEndpoint = method
            .getDecorators()
            .some((d) =>
              ['Get', 'Post', 'Put', 'Patch', 'Delete'].includes(d.getName()),
            );

          if (!isEndpoint) return;

          method.getParameters().forEach((param) => {
            const hasBodyOrQuery = param
              .getDecorators()
              .some((d) => ['Body', 'Query'].includes(d.getName()));

            if (!hasBodyOrQuery) return;

            const type = param.getType();
            if (!type.isClass()) {
              // We only care about classes. If they use primitive types, Swagger handles them or ignores them.
              // Though technically they should use classes for DTOs.
              return;
            }

            const symbol = type.getSymbol();
            if (!symbol) return;

            const decls = symbol.getDeclarations();
            if (!decls.length) return;

            const typeFile = decls[0].getSourceFile().getFilePath();

            // Ignore external node_modules imports (e.g., from external libraries if they happened to use them)
            if (typeFile.includes('node_modules')) return;

            // The file must end in dto.ts for the NestJS Swagger CLI plugin to auto-decorate it
            if (!typeFile.endsWith('dto.ts')) {
              violations.push(
                `Method '${method.getName()}' in ${cls.getName()} uses '${symbol.getName()}' from ${path.basename(typeFile)}. DTOs must reside in a .dto.ts file.`,
              );
            }
          });
        });
      });
    });

    if (violations.length > 0) {
      console.error(
        'Swagger DTO Convention Violations found:\n' + violations.join('\n'),
      );
    }

    expect(violations.length).toBe(0);
  });
});
