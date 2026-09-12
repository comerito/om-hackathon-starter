/**
 * Jest transformer: ts-jest plus a small `import.meta` shim.
 *
 * A handful of published ESM files in node_modules (notably
 * `@mikro-orm/core/MikroORM.js` and `@mikro-orm/core/utils/fs-utils.js`) use
 * `import.meta`, which is a syntax error once Jest has compiled them down to
 * CommonJS. Those files sit on the import graph of almost every
 * `@open-mercato/*` entry point, so without this shim no unit test can import
 * framework code at all. We rewrite the few `import.meta.*` forms to their
 * CommonJS equivalents before handing the source to ts-jest.
 */
const tsJestModule = require('ts-jest')
const tsJest = tsJestModule.default ?? tsJestModule

const META_URL = '(typeof __filename === "string" ? require("node:url").pathToFileURL(__filename).href : "")'
const META_DIRNAME = '(typeof __dirname === "string" ? __dirname : "")'
const META_RESOLVE = '((s) => require("node:url").pathToFileURL(require.resolve(s)).href)'

function shim(src) {
  if (typeof src !== 'string' || !src.includes('import.meta')) return src
  return src
    .replace(/import\.meta\.resolve/g, META_RESOLVE)
    .replace(/import\.meta\.dirname/g, META_DIRNAME)
    .replace(/import\.meta\.filename/g, '(typeof __filename === "string" ? __filename : "")')
    .replace(/import\.meta\.url/g, META_URL)
}

module.exports = {
  createTransformer(options) {
    const inner = tsJest.createTransformer(options)
    return {
      canInstrument: inner.canInstrument,
      getCacheKey(sourceText, sourcePath, transformOptions) {
        const key = inner.getCacheKey(shim(sourceText), sourcePath, transformOptions)
        return `${key}:esm-meta-1`
      },
      process(sourceText, sourcePath, transformOptions) {
        return inner.process(shim(sourceText), sourcePath, transformOptions)
      },
    }
  },
}
