/**
 * Raw SQL helpers for cross-module queries.
 *
 * MikroORM v7 dropped knex, so app code that needs raw cross-module SQL (joining
 * tables owned by other modules, where no local entity exists) uses the driver
 * connection's `execute()` directly. Placeholders use `?` (MikroORM converts
 * them to positional `$n` for Postgres). `rawAll` returns the result rows;
 * `rawRun` is for statements without a useful result set (INSERT/UPDATE/DELETE).
 */
import type { EntityManager } from '@mikro-orm/postgresql'

export async function rawAll<T = Record<string, unknown>>(
  em: EntityManager,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const rows = await em.getConnection().execute(sql, params as unknown[], 'all')
  return rows as unknown as T[]
}

export async function rawFirst<T = Record<string, unknown>>(
  em: EntityManager,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T | null> {
  const rows = await rawAll<T>(em, sql, params)
  return rows[0] ?? null
}

export async function rawRun(
  em: EntityManager,
  sql: string,
  params: readonly unknown[] = [],
): Promise<void> {
  await em.getConnection().execute(sql, params as unknown[], 'run')
}
