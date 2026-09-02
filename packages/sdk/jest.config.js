const path = require('path');

module.exports = {
  moduleFileExtensions: ['ts', 'js', 'json'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/src/**/*.test.ts'],
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
