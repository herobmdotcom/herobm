import { Project, SyntaxKind, MethodDeclaration } from 'ts-morph';

const project = new Project({
  tsConfigFilePath: 'tsconfig.json',
});

const sourceFiles = project.getSourceFiles('src/**/*.controller.ts');

let totalAdded = 0;

for (const sourceFile of sourceFiles) {
  let modifiedFile = false;
  let importAdded = false;

  const classes = sourceFile.getClasses();
  for (const cls of classes) {
    const methods = cls.getMethods();
    for (const method of methods) {
      const parameters = method.getParameters();
      for (const param of parameters) {
        const queryDecorator = param.getDecorator('Query');
        if (queryDecorator) {
          const arg = queryDecorator.getArguments()[0];
          // We only care if they explicitly named it @Query('name')
          if (arg && arg.getKind() === SyntaxKind.StringLiteral) {
            const queryName = arg.getText().replace(/['"]/g, '');
            const isOptional = param.isOptional();
            
            // If it is optional or has a default value, we want to make sure it's marked required: false in Swagger.
            // Also, if it has a default value, it's technically optional to the client.
            if (isOptional || param.hasInitializer()) {
              const methodDecorators = method.getDecorators();
              const hasApiQuery = methodDecorators.some(d => {
                if (d.getName() === 'ApiQuery') {
                  const args = d.getArguments();
                  if (args.length > 0 && args[0].getKind() === SyntaxKind.ObjectLiteralExpression) {
                    const obj = args[0].asKind(SyntaxKind.ObjectLiteralExpression);
                    const nameProp = obj?.getProperty('name');
                    if (nameProp && nameProp.getText().includes(queryName)) {
                      return true;
                    }
                  }
                }
                return false;
              });

              if (!hasApiQuery) {
                method.addDecorator({
                  name: 'ApiQuery',
                  arguments: [`{ name: '${queryName}', required: false }`],
                });
                modifiedFile = true;
                importAdded = true;
                totalAdded++;
                console.log(`Added @ApiQuery for ${queryName} in ${cls.getName()}.${method.getName()}`);
              }
            }
          }
        }
      }
    }
  }

  if (modifiedFile) {
    // Make sure ApiQuery is imported from @nestjs/swagger
    const swaggerImport = sourceFile.getImportDeclaration(decl => decl.getModuleSpecifierValue() === '@nestjs/swagger');
    if (swaggerImport) {
      const namedImports = swaggerImport.getNamedImports().map(i => i.getName());
      if (!namedImports.includes('ApiQuery')) {
        swaggerImport.addNamedImport('ApiQuery');
      }
    } else {
      sourceFile.addImportDeclaration({
        moduleSpecifier: '@nestjs/swagger',
        namedImports: ['ApiQuery'],
      });
    }

    sourceFile.saveSync();
  }
}

console.log(`Done. Added ${totalAdded} @ApiQuery decorators.`);
