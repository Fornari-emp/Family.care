/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFiles: ['./jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testPathIgnorePatterns: ['/node_modules/', '/coverage/'],
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/store/**/*.ts', 'src/content/**/*.ts'],
  coverageThreshold: {
    './src/domain/': { statements: 90, branches: 90, functions: 90, lines: 90 },
  },
};
