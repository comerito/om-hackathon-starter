import type { EntityManager } from '@mikro-orm/postgresql'

/**
 * Raw SQL helpers for cross-module queries.
 *
 * Open Mercato forbids direct ORM relationships between modules, so app code that has to
 * join tables owned by another module — where no local entity exists — drops to raw SQL.
 * MikroORM 7 removed knex (`getConnection().getKnex()` is gone), leaving the driver
 * connection's `execute()` as the supported entrypoint. These helpers wrap it so call
 * sites stop repeating `em.getConnection().execute<Array<Row>>(...)` and so the parameter
 * rules below are documented in exactly one place.
 *
 * ## Placeholders are INLINED, not bound
 *
 * `execute()` does NOT send parameters to Postgres. `AbstractSqlConnection.execute()` calls
 * `platform.formatQuery(query, params)` and hands the finished string to
 * `CompiledQuery.raw()`, which carries no parameter list. Every `?` is substituted into the
 * SQL text before it leaves the process. Two consequences that have already caused real
 * bugs in this repo:
 *
 * 1. **A JS array renders as a comma-joined list of literals.** So `IN (?)` is correct and
 *    expands to `IN ('a','b','c')`, while `= ANY(?)` is a SYNTAX ERROR — it would need an
 *    array literal, and it gets a bare list instead.
 *
 * 2. **An empty array produces `IN ()`, which does not parse.** Always guard before
 *    calling:
 *
 *    ```ts
 *    if (!ids.length) return []
 *    const rows = await rawAll<Row>(em, `SELECT ... WHERE id IN (?)`, [ids])
 *    ```
 *
 * See `.ai/upgrade/KYSELY-PORTING-COOKBOOK.md` §17 for the failure this documents.
 *
 * Values are escaped by the platform's formatter, so ordinary parameters are still safe to
 * pass this way — but never interpolate untrusted text into the SQL string yourself.
 *
 * ## Choosing a helper
 *
 * - `rawAll` — a result set; returns the rows.
 * - `rawFirst` — at most one row; returns `null` rather than throwing when there is none.
 * - `rawRun` — INSERT / UPDATE / DELETE, where the result set carries nothing useful.
 *
 * The type parameter is the ROW type (`rawAll<{ id: string }>` → `{ id: string }[]`), not
 * the array type that the bare `execute<Array<Row>>` call took.
 */

export async function rawAll<T = Record<string, unknown>>(
  em: EntityManager,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const rows = await em.getConnection().execute<T[]>(sql, params as unknown[], 'all')
  return (rows ?? []) as T[]
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
