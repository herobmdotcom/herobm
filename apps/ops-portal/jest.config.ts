import type { Config } from 'jest';
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@herobm/extension-ma/(.*)$': '<rootDir>/../../extensions/ma/src/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  roots: ['<rootDir>', '<rootDir>/../../extensions'],
  testPathIgnorePatterns: ['<rootDir>/e2e/'],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
export default createJestConfig(config as any);
