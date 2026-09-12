/**
 * Unit-test config for the app's own `src/` code.
 *
 * `package.json` already pointed `yarn test` at this file, but the file itself was never committed,
 * so `yarn test` failed with "Can't find a root directory while resolving a config file path".
 * Integration tests keep running through `yarn test:integration` (the mercato CLI runner).
 */
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/\\.mercato/(.*)$': '<rootDir>/.mercato/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // The framework packages ship ESM in `dist/`, which plain Jest cannot require. Resolve them to
    // their TypeScript sources so ts-jest transforms them like the rest of the suite.
    '^@open-mercato/([^/]+)$': '<rootDir>/node_modules/@open-mercato/$1/src/index.ts',
    '^@open-mercato/([^/]+)/(.*)$': '<rootDir>/node_modules/@open-mercato/$1/src/$2',
  },
  transformIgnorePatterns: ['/node_modules/(?!@open-mercato/)'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          moduleResolution: 'node',
          esModuleInterop: true,
          target: 'ES2022',
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          verbatimModuleSyntax: false,
        },
      },
    ],
  },
}
