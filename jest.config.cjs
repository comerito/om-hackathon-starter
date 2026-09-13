/**
 * Unit-test config for the app's own `src/` code.
 *
 * `package.json` has always run `yarn test` as `jest --config jest.config.cjs`, but that file was
 * never committed, so `yarn test` failed repo-wide with "Can't find a root directory while
 * resolving a config file path". This is that missing file.
 *
 * Two things make the setup less obvious than a stock ts-jest config:
 *
 *  - The framework packages (`@open-mercato/*`) and their dependencies (`@mikro-orm/*`, `kysely`,
 *    `ai`/`@ai-sdk`, `@workflow`, `@standard-schema`) publish ESM only. Jest runs CommonJS here, so
 *    those packages have to be excluded from `transformIgnorePatterns` and compiled like our own
 *    sources.
 *  - A few of those compiled files use `import.meta` (notably `@mikro-orm/core/MikroORM.js`), which
 *    is a syntax error once the module has been downlevelled to CommonJS — and `@mikro-orm/core`
 *    sits on the import graph of nearly every `@open-mercato/*` entry point. The transformer in
 *    `scripts/jest-esm-meta-transformer.cjs` rewrites those few `import.meta.*` forms before handing
 *    the source to ts-jest.
 *
 * Integration tests are unaffected — they keep running through `yarn test:integration`
 * (the mercato CLI runner).
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  watchman: false,
  rootDir: '.',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    // Mirror the `paths` aliases from tsconfig.json.
    '^@/\\.mercato/(.*)$': '<rootDir>/.mercato/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(t|j)sx?$': [
      '<rootDir>/scripts/jest-esm-meta-transformer.cjs',
      {
        useESM: false,
        // The repo-wide type check is `yarn typecheck`; ts-jest only needs to emit here.
        diagnostics: false,
        tsconfig: {
          module: 'commonjs',
          moduleResolution: 'node',
          jsx: 'react-jsx',
          allowJs: true,
          esModuleInterop: true,
          experimentalDecorators: true,
          emitDecoratorMetadata: true,
          useDefineForClassFields: false,
          target: 'ES2022',
          verbatimModuleSyntax: false,
          ignoreDeprecations: '6.0',
        },
      },
    ],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@open-mercato|@mikro-orm|kysely|ai|@ai-sdk|@workflow|@standard-schema)/)',
  ],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.(ts|tsx)'],
  // Keep `yarn test` green on a tree that happens to carry no unit tests.
  passWithNoTests: true,
}
