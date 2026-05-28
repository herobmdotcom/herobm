import { Project, SyntaxKind } from 'ts-morph';
import * as path from 'path';

const project = new Project();
project.addSourceFilesAtPaths('src/**/*.controller.ts');

let removedCount = 0;

for (const sourceFile of project.getSourceFiles()) {
  const classes = sourceFile.getClasses();
  let fileChanged = false;

  for (const cls of classes) {
    // Add ApiTags to settings controllers that are missing them
    if (sourceFile.getFilePath().includes('src/settings/')) {
      if (!cls.getDecorator('ApiTags')) {
        cls.addDecorator({ name: 'ApiTags', arguments: ["'System'"] });
        fileChanged = true;
      }
    }

    const methods = cls.getMethods();
    for (const method of methods) {
      // Add ApiOperation to settings controllers that are missing them
      if (sourceFile.getFilePath().includes('src/settings/')) {
        const hasRoute =
          method.getDecorator('Get') ||
          method.getDecorator('Post') ||
          method.getDecorator('Patch') ||
          method.getDecorator('Delete');
        if (hasRoute && !method.getDecorator('ApiOperation')) {
          method.addDecorator({
            name: 'ApiOperation',
            arguments: [
              `{ summary: '${method.getName()}', description: '${method.getName()} operation' }`,
            ],
          });
          fileChanged = true;
        }
      }

      // Cleanup duplicate generic decorators
      const okDecorators = method
        .getDecorators()
        .filter((d) => d.getName() === 'ApiOkResponse');
      if (okDecorators.length > 1) {
        for (const dec of okDecorators) {
          if (dec.getText().includes("schema: { type: 'object' }")) {
            dec.remove();
            removedCount++;
            fileChanged = true;
          }
        }
      }

      const createdDecorators = method
        .getDecorators()
        .filter((d) => d.getName() === 'ApiCreatedResponse');
      if (createdDecorators.length > 1) {
        for (const dec of createdDecorators) {
          if (dec.getText().includes("schema: { type: 'object' }")) {
            dec.remove();
            removedCount++;
            fileChanged = true;
          }
        }
      }

      const bodyDecorators = method
        .getDecorators()
        .filter((d) => d.getName() === 'ApiBody');
      if (bodyDecorators.length > 1) {
        for (const dec of bodyDecorators) {
          if (dec.getText().includes("schema: { type: 'object' }")) {
            dec.remove();
            removedCount++;
            fileChanged = true;
          }
        }
      }
    }
  }

  if (fileChanged) {
    sourceFile.saveSync();
  }
}

console.log(`Removed ${removedCount} duplicate generic decorators.`);
