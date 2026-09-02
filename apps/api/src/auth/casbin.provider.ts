import { Provider } from '@nestjs/common';
import { newEnforcer } from 'casbin';
import * as path from 'path';
import * as fs from 'fs';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DrizzleAdapter } from './casbin/drizzle-adapter';

export const CASBIN_ENFORCER = 'CASBIN_ENFORCER';

function resolveCasbinAsset(filename: string): string {
  const dirPath = path.join(__dirname, 'casbin', filename);
  if (fs.existsSync(dirPath)) return dirPath;

  const distAuthPath = path.join(
    __dirname,
    '..',
    '..',
    '..',
    '..',
    'auth',
    'casbin',
    filename,
  );
  if (fs.existsSync(distAuthPath)) return distAuthPath;

  const srcPath = path.join(process.cwd(), 'src', 'auth', 'casbin', filename);
  if (fs.existsSync(srcPath)) return srcPath;

  return dirPath;
}

export const CasbinEnforcerProvider: Provider = {
  provide: CASBIN_ENFORCER,
  inject: [DRIZZLE],
  useFactory: async (db: DrizzleDB) => {
    const modelPath = resolveCasbinAsset('model.conf');
    const adapter = new DrizzleAdapter(db);
    const enforcer = await newEnforcer(modelPath, adapter);
    await enforcer.loadPolicy();
    return enforcer;
  },
};
