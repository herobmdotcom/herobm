import { Project, SyntaxKind, ObjectLiteralExpression } from 'ts-morph';
import * as path from 'path';
import { SystemResource } from '@herobm/shared';

describe('Casbin VALID_ACTIONS Sync (e2e)', () => {
  it('should ensure frontend VALID_ACTIONS matches backend Casbin decorators', () => {
    const project = new Project();

    // 1. Parse all backend controllers
    const apiSrcPath = path.join(__dirname, '../src/**/*.controller.ts');
    project.addSourceFilesAtPaths(apiSrcPath);

    const backendActionsMap = new Map<string, Set<string>>();

    for (const sourceFile of project.getSourceFiles()) {
      const classes = sourceFile.getClasses();

      for (const cls of classes) {
        // Find @CasbinResource decorator on the class
        const classResourceDec = cls.getDecorator('CasbinResource');
        let classResourceName: string | undefined;

        if (classResourceDec) {
          const args = classResourceDec.getArguments();
          if (args.length > 0) {
            const argText = args[0].getText();
            if (argText.startsWith('SystemResource.')) {
              const key = argText.split('.')[1] as keyof typeof SystemResource;
              classResourceName = SystemResource[key];
            } else if (!argText.startsWith('(')) {
              classResourceName = argText.replace(/['"]/g, '');
            }
          }
        }

        // Find all @CasbinAction decorators on methods
        for (const method of cls.getMethods()) {
          const skipCasbinDec = method.getDecorator('SkipCasbin');
          if (skipCasbinDec) continue;

          let methodResourceName = classResourceName;
          const methodResourceDec = method.getDecorator('CasbinResource');
          if (methodResourceDec) {
            const args = methodResourceDec.getArguments();
            if (args.length > 0) {
              const argText = args[0].getText();
              if (argText.startsWith('SystemResource.')) {
                const key = argText.split(
                  '.',
                )[1] as keyof typeof SystemResource;
                methodResourceName = SystemResource[key];
              } else if (!argText.startsWith('(')) {
                methodResourceName = argText.replace(/['"]/g, '');
              }
            }
          }

          if (!methodResourceName) continue;

          if (!backendActionsMap.has(methodResourceName)) {
            backendActionsMap.set(methodResourceName, new Set());
          }

          const resourceSet = backendActionsMap.get(methodResourceName)!;

          const casbinActionDec = method.getDecorator('CasbinAction');
          if (casbinActionDec) {
            const args = casbinActionDec.getArguments();
            if (args.length > 0) {
              const action = args[0].getText().replace(/['"]/g, '');
              resourceSet.add(action);
            }
          }
        }
      }
    }

    // 2. Read frontend constants.ts
    const frontendConstantsPath = path.join(
      __dirname,
      '../../ops-portal/app/admin/users/roles/constants.ts',
    );
    const frontendFile = project.addSourceFileAtPath(frontendConstantsPath);
    const validActionsDecl =
      frontendFile.getVariableDeclaration('VALID_ACTIONS');
    expect(validActionsDecl).toBeDefined();

    const initializer = validActionsDecl!.getInitializerIfKindOrThrow(
      SyntaxKind.ObjectLiteralExpression,
    );

    const frontendActionsMap = new Map<string, Set<string>>();

    for (const prop of initializer.getProperties()) {
      if (prop.getKind() === SyntaxKind.PropertyAssignment) {
        const propAssign = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
        const resourceName = propAssign.getName().replace(/['"]/g, '');
        const arrayExpr = propAssign.getInitializerIfKind(
          SyntaxKind.ArrayLiteralExpression,
        );
        if (arrayExpr) {
          const actions = arrayExpr
            .getElements()
            .map((e) => e.getText().replace(/['"]/g, ''));
          frontendActionsMap.set(resourceName, new Set(actions));
        }
      }
    }

    // 3. Compare maps
    const errors: string[] = [];

    // Check if frontend has everything backend has
    for (const [resource, backendActions] of backendActionsMap.entries()) {
      if (resource === 'data-export') continue; // purely frontend-side permission

      const frontendActions = frontendActionsMap.get(resource) || new Set();

      for (const backendAction of backendActions) {
        if (!frontendActions.has(backendAction)) {
          errors.push(
            `Frontend VALID_ACTIONS is missing '${backendAction}' for resource '${resource}'`,
          );
        }
      }
    }

    // Check if backend has everything frontend has
    for (const [resource, frontendActions] of frontendActionsMap.entries()) {
      if (resource === 'data-export') continue; // purely frontend-side permission

      const backendActions = backendActionsMap.get(resource) || new Set();

      for (const frontendAction of frontendActions) {
        if (!backendActions.has(frontendAction)) {
          errors.push(
            `Frontend VALID_ACTIONS has extra action '${frontendAction}' for resource '${resource}' which does not exist in any backend controller`,
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        'VALID_ACTIONS in frontend is out of sync with backend Casbin decorators:\n' +
          errors.join('\n'),
      );
    }
  });
});
