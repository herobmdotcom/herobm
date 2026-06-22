import { Project, SyntaxKind } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'C:/Users/Marcel/volz/modbm/modbm/apps/api/tsconfig.json',
});

const filePaths = [
  'C:/Users/Marcel/volz/modbm/modbm/apps/api/src/customers/customers-write.service.ts',
  'C:/Users/Marcel/volz/modbm/modbm/apps/api/src/suppliers/suppliers-write.service.ts',
];

for (const filePath of filePaths) {
  const sourceFile = project.getSourceFile(filePath);
  if (!sourceFile) continue;

  let changed = false;

  // Find all VariableStatements that declare 'allowedKeys'
  const allowedKeysDecls = sourceFile.getDescendantsOfKind(SyntaxKind.VariableStatement)
    .filter(vs => vs.getDeclarations().some(d => d.getName() === 'allowedKeys'));

  for (const decl of allowedKeysDecls) {
    const parentBlock = decl.getParentIfKind(SyntaxKind.Block);
    if (!parentBlock) continue;

    // Find the associated sanitizedDto declaration in the same block
    const sanitizedDtoDecl = parentBlock.getStatements().find(s => 
      s.getKind() === SyntaxKind.VariableStatement && 
      s.getText().includes('sanitizedDto')
    );

    // Find the associated recordDto declaration
    const recordDtoDecl = parentBlock.getStatements().find(s => 
      s.getKind() === SyntaxKind.VariableStatement && 
      s.getText().includes('recordDto')
    );

    // Find the associated for-of loop
    const forLoop = parentBlock.getStatements().find(s => 
      s.getKind() === SyntaxKind.ForOfStatement && 
      s.getText().includes('allowedKeys')
    );

    const insertionIndex = decl.getChildIndex();

    // Remove the old statements
    if (forLoop) forLoop.remove();
    if (recordDtoDecl) recordDtoDecl.remove();
    if (sanitizedDtoDecl) sanitizedDtoDecl.remove();
    decl.remove();

    // Insert the new one
    parentBlock.insertStatements(insertionIndex, 'const sanitizedDto: any = buildUpdatePayload(dto);');
    changed = true;
  }

  // Also clean up my botch in customers-write.service.ts create if it exists
  const botchedIf = sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement)
    .find(s => s.getText().includes(`'customerNumber' in dto`));
  if (botchedIf) {
    botchedIf.remove();
    changed = true;
  }

  if (changed) {
    // Add import if missing
    const drizzleUtilsImport = sourceFile.getImportDeclaration(dec => dec.getModuleSpecifierValue().includes('drizzle-utils'));
    if (drizzleUtilsImport) {
      if (!drizzleUtilsImport.getNamedImports().some(i => i.getName() === 'buildUpdatePayload')) {
        drizzleUtilsImport.addNamedImport('buildUpdatePayload');
      }
    } else {
      sourceFile.addImportDeclaration({
        moduleSpecifier: '../common/utils/drizzle-utils',
        namedImports: ['buildUpdatePayload']
      });
    }

    sourceFile.saveSync();
    console.log(`Refactored ${filePath}`);
  }
}
