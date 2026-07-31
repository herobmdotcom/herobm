const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '../../../');
const herobmJsonPath = path.join(rootDir, 'herobm.json');
let enabledExtensions = [];
if (fs.existsSync(herobmJsonPath)) {
  const config = JSON.parse(fs.readFileSync(herobmJsonPath, 'utf8'));
  if (Array.isArray(config.extensions)) {
    enabledExtensions = config.extensions;
  }
}

const roots = ['<rootDir>'];
for (const ext of enabledExtensions) {
  roots.push(`<rootDir>/../../../extensions/${ext}`);
}

module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  roots,
  testEnvironment: 'node',
  testRegex: '.e2e-spec.ts$',
  maxWorkers: 1,
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      {
        isolatedModules: true,
      },
    ],
  },
  transformIgnorePatterns: ['node_modules/(?!(uuid)/)'],
  moduleNameMapper: {
    '^@api/(.*)$': '<rootDir>/../src/$1',
    '^@test/(.*)$': '<rootDir>/$1',
    '^@herobm/shared(.*)$': '<rootDir>/../../../packages/shared/src$1',
    '^uuid$': '<rootDir>/utils/uuid-mock.js',
  },
  setupFiles: ['./setup-env.ts'],
  setupFilesAfterEnv: ['./suite-setup.ts'],
  testTimeout: 120000,
};
