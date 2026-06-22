import { Project, SyntaxKind, ObjectLiteralExpression } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

// We need to find all pg.db.insert().values() calls that are missing the newly required fields.
const sourceFiles = project.getSourceFiles();

let updatedFiles = 0;

for (const sourceFile of sourceFiles) {
  let fileUpdated = false;

  // Find all ObjectLiteralExpressions that might be passed to .values()
  const calls = sourceFile.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const call of calls) {
    const expression = call.getExpression();
    if (expression.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expression.asKind(SyntaxKind.PropertyAccessExpression);
      if (propAccess && propAccess.getName() === 'values') {
        const args = call.getArguments();
        if (args.length > 0) {
          const arg = args[0];
          
          if (arg.getKind() === SyntaxKind.ObjectLiteralExpression) {
            const obj = arg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);
            fileUpdated = checkAndUpdateObject(obj) || fileUpdated;
          } else if (arg.getKind() === SyntaxKind.ArrayLiteralExpression) {
            const arr = arg.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
            for (const elem of arr.getElements()) {
               if (elem.getKind() === SyntaxKind.ObjectLiteralExpression) {
                  fileUpdated = checkAndUpdateObject(elem.asKindOrThrow(SyntaxKind.ObjectLiteralExpression)) || fileUpdated;
               }
            }
          }
        }
      }
    }
  }

  if (fileUpdated) {
    sourceFile.saveSync();
    updatedFiles++;
    console.log(`Updated ${sourceFile.getFilePath()}`);
  }
}

console.log(`Finished. Updated ${updatedFiles} files.`);

function checkAndUpdateObject(obj: ObjectLiteralExpression): boolean {
  let updated = false;
  
  // Products: needs productType, baseUom
  // Look for productNumber or name without productType
  const hasProductNumber = obj.getProperty('productNumber') !== undefined;
  const hasProductName = obj.getProperty('name') !== undefined;
  
  // If this looks like a product insert
  if ((hasProductNumber || obj.getProperty('productId') !== undefined) && hasProductName && obj.getProperty('macroType') === undefined && obj.getProperty('binNumber') === undefined) {
    if (!obj.getProperty('productType')) {
      obj.addPropertyAssignment({ name: 'productType', initializer: "'inventory'" });
      updated = true;
    }
    if (!obj.getProperty('baseUom') && !obj.getProperty('structureType')) {
      // Wait, structureType is for products but might not be present. Just add baseUom.
      obj.addPropertyAssignment({ name: 'baseUom', initializer: "'EA'" });
      updated = true;
    }
  }

  // Bins: needs binType
  // Look for binNumber
  if (obj.getProperty('binNumber') !== undefined) {
    if (!obj.getProperty('binType')) {
      obj.addPropertyAssignment({ name: 'binType', initializer: "'storage'" });
      updated = true;
    }
  }

  // Macros: needs macroType
  if (obj.getProperty('macroId') !== undefined || obj.getProperty('content') !== undefined) {
    // wait, macro has name, content, macroId
    if (obj.getProperty('content') !== undefined && obj.getProperty('name') !== undefined) {
      if (!obj.getProperty('macroType')) {
        obj.addPropertyAssignment({ name: 'macroType', initializer: "'text_template'" });
        updated = true;
      }
    }
  }
  
  return updated;
}
