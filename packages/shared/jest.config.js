const path = require('path');

/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts'],
  moduleDirectories: ['node_modules', path.resolve(__dirname, '../../node_modules')],
  transform: {
    '^.+\\.(t|j)s$': [
      require.resolve('ts-jest'),
      {
        isolatedModules: true,
      },
    ],
  },
};
