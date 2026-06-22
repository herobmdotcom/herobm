import { Project, SyntaxKind, ClassDeclaration } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'C:/Users/Marcel/volz/modbm/modbm/apps/api/tsconfig.json',
});

function refactorDtosInFile(filePath: string, entityPairs: { create: string, update: string, base: string }[]) {
  const sourceFile = project.getSourceFileOrThrow(filePath);

  for (const pair of entityPairs) {
    const createClass = sourceFile.getClass(pair.create);
    const updateClass = sourceFile.getClass(pair.update);

    if (!createClass || !updateClass) {
      console.warn(`Could not find ${pair.create} or ${pair.update} in ${filePath}`);
      continue;
    }

    // Check if Base class already exists
    if (sourceFile.getClass(pair.base)) {
      console.log(`${pair.base} already exists, skipping...`);
      continue;
    }

    // 1. Create Base Class before Create class
    const baseClass = sourceFile.insertClass(createClass.getChildIndex(), {
      name: pair.base,
      isExported: true,
    });

    // 2. Move all properties from Create Class to Base Class
    const properties = createClass.getProperties();
    for (const prop of properties) {
      baseClass.addProperty({
        name: prop.getName(),
        type: prop.getTypeNode()?.getText(),
        hasQuestionToken: prop.hasQuestionToken(),
        hasExclamationToken: prop.hasExclamationToken(),
        decorators: prop.getDecorators().map(d => ({
          name: d.getName(),
          arguments: d.getArguments().map(a => a.getText())
        }))
      });
      prop.remove();
    }

    // 3. Make Create class extend Base class
    createClass.setExtends(pair.base);

    // 4. Remove all properties from Update class
    for (const prop of updateClass.getProperties()) {
      prop.remove();
    }

    // 5. Make Update class extend PartialType(Base)
    updateClass.setExtends(`PartialType(${pair.base})`);
  }

  // Add PartialType import if needed
  const swaggerImport = sourceFile.getImportDeclaration(dec => dec.getModuleSpecifierValue() === '@nestjs/swagger');
  if (swaggerImport) {
    if (!swaggerImport.getNamedImports().some(i => i.getName() === 'PartialType')) {
      swaggerImport.addNamedImport('PartialType');
    }
  } else {
    sourceFile.addImportDeclaration({
      moduleSpecifier: '@nestjs/swagger',
      namedImports: ['PartialType']
    });
  }

  sourceFile.saveSync();
  console.log(`Refactored DTOs in ${filePath}`);
}

// Customers
refactorDtosInFile('C:/Users/Marcel/volz/modbm/modbm/apps/api/src/customers/dto.ts', [
  { create: 'CreateAccountDto', update: 'UpdateAccountDto', base: 'BaseAccountDto' },
  { create: 'CreateAccountGroupDto', update: 'UpdateAccountGroupDto', base: 'BaseAccountGroupDto' }
]);

// Suppliers
refactorDtosInFile('C:/Users/Marcel/volz/modbm/modbm/apps/api/src/suppliers/dto.ts', [
  { create: 'CreateSupplierDto', update: 'UpdateSupplierDto', base: 'BaseSupplierDto' },
  { create: 'CreateSupplierGroupDto', update: 'UpdateSupplierGroupDto', base: 'BaseSupplierGroupDto' }
]);

// Products
refactorDtosInFile('C:/Users/Marcel/volz/modbm/modbm/apps/api/src/products/dto.ts', [
  { create: 'CreateProductDto', update: 'UpdateProductDto', base: 'BaseProductDto' },
  { create: 'CreateProductGroupDto', update: 'UpdateProductGroupDto', base: 'BaseProductGroupDto' }
]);
