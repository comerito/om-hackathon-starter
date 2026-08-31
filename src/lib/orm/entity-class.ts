import type { EntityManager } from '@mikro-orm/postgresql'

/**
 * Resolve the entity constructor that MikroORM actually discovered.
 *
 * ## Why this exists
 *
 * `@open-mercato/core` publishes BOTH `src/*.ts` and a compiled `dist/*.js`, and its
 * `exports` map serves `dist` while `next.config.ts` lists the package in
 * `transpilePackages`. Next therefore compiles the package *source* for some importers
 * and resolves the published *dist* build for others. The result is two distinct module
 * instances of the same file, and therefore two distinct — but identically named —
 * entity classes.
 *
 * When a route holds one copy and the ORM registry holds the other, MikroORM rejects
 * the write:
 *
 * ```
 * ValidationError: Trying to persist not discovered entity of type Message.
 * Entity with this name was discovered, but not the prototype you are passing to the ORM.
 * ```
 *
 * This ONLY reproduces in production builds — `next dev` keeps a single module instance
 * per specifier — which is why `POST /api/competitions/portal/chat` returned 500 in
 * production while working perfectly in development. It predates the 0.4.8 → 0.6.7
 * upgrade (verified by reproducing it on the 0.5.0 tree under MikroORM 6).
 *
 * ## Why not fix it in the bundler instead
 *
 * Dropping `@open-mercato/core` from `transpilePackages` collapses the duplication, but
 * then core's `dist` is pulled into the client graph and the build fails to resolve
 * `fs` / `net` / `tls` / `child_process`. Adding the package to `serverExternalPackages`
 * is mutually exclusive with `transpilePackages`. So the duplication is fixed at the
 * point of use instead.
 *
 * ## Why not write raw SQL instead
 *
 * `messages.subject` and `messages.body` are declared encrypted
 * (`core/modules/messages/encryption.ts`). A raw `INSERT` would bypass the ORM's
 * encryption hooks and silently store plaintext. The ORM write path has to be preserved.
 *
 * ## Behaviour
 *
 * Looks the class up by NAME in the ORM's own metadata, so module identity is irrelevant.
 * Falls back to the passed constructor when metadata is unavailable or the entity is not
 * registered — in that case behaviour is exactly what it was before, so this can never
 * make things worse than the status quo.
 */
export function ormEntityClass<T extends new (...args: never[]) => object>(
  em: EntityManager,
  cls: T,
): T {
  try {
    const metadata = (em as unknown as { getMetadata?: () => unknown }).getMetadata?.()
    const getAll = (metadata as { getAll?: () => Map<unknown, { class?: unknown }> } | undefined)?.getAll
    if (typeof getAll !== 'function') return cls

    for (const meta of getAll.call(metadata).values()) {
      const discovered = meta?.class as T | undefined
      if (typeof discovered === 'function' && discovered.name === cls.name) {
        return discovered
      }
    }
  } catch {
    // Metadata unavailable (or a future MikroORM changes the API) — fall through.
  }
  return cls
}

/**
 * Instantiate an entity using the constructor the ORM discovered.
 *
 * Drop-in replacement for `new SomeEntity()` in code that later calls
 * `em.persist(...)`. See {@link ormEntityClass} for the full rationale.
 */
export function newOrmEntity<T extends new (...args: never[]) => object>(
  em: EntityManager,
  cls: T,
): InstanceType<T> {
  const Resolved = ormEntityClass(em, cls)
  return new Resolved() as InstanceType<T>
}
