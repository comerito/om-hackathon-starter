# Kysely Porting Cookbook (knex → MikroORM 7 / Kysely)

Evidence-based reference for porting knex query code to MikroORM 7, which replaced knex with
Kysely as its SQL layer.

**All BEFORE/AFTER pairs below are verbatim from the Open Mercato framework's own migration:**

| Era | Source tree |
|---|---|
| knex (0.4.8) | `/tmp/pkg/0.4.8/core/package/src`, `/tmp/pkg/0.4.8/shared/package/src` |
| kysely (0.6.7) | `/tmp/pkg/0.6.7/core/package/src`, `/tmp/pkg/0.6.7/shared/package/src` |
| ORM API | `@mikro-orm/sql@7.1.7` d.ts + js (verified against `@mikro-orm/postgresql@7.1.5`) |

Paths in this document are given **relative to those roots** (e.g. `modules/messages/api/route.ts`).

---

## 0. TL;DR conversion table

| knex | kysely (0.6.7) |
|---|---|
| `em.getConnection().getKnex()` | `em.getKysely<any>()` |
| `knex('t')` / `knex('t as a')` | `db.selectFrom('t')` / `db.selectFrom('t as a')` |
| `.where(col, val)` | `.where(col, '=', val)` |
| `.where({a: 1, b: 2})` | `.where('a','=',1).where('b','=',2)` |
| `.whereNull(col)` | `.where(col, 'is', null)` |
| `.whereNotNull(col)` | `.where(col, 'is not', null)` |
| `.whereNot(col, v)` | `.where(col, '!=', v)` |
| `.whereIn(col, arr)` | `.where(col, 'in', arr)` |
| `.whereNotIn(col, arr)` | `.where(col, 'not in', arr)` |
| `.whereILike(col, p)` | `.where(col, 'ilike', p)` |
| `.where(fn)` w/ `orWhere` | `.where((eb) => eb.or([...]))` |
| `.whereExists(sub)` | `.where((eb) => eb.exists(sub))` |
| `.whereNotExists(sub)` | `.where((eb) => eb.not(eb.exists(sub)))` |
| `.whereRaw('a = ??', [col])` | `.whereRef(a, '=', col)` **or** `.where(sql\`...\`)` |
| `.join(t, fn)` | `.innerJoin(t, (jb) => jb.onRef(...).on(...))` |
| `.leftJoin` | `.leftJoin` (same name, different callback shape) |
| `.count('* as count')` | `.select(sql<string>\`count(*)\`.as('count'))` |
| `.countDistinct('t.id as count')` | `.select(sql<string>\`count(distinct ${sql.ref('t.id')})\`.as('count'))` |
| `.first()` | `.executeTakeFirst()` |
| *(implicit await = rows)* | `.execute()` **← mandatory, kysely is not a thenable** |
| `.orderByRaw(s)` | `.orderBy(sql\`${sql.raw(s)} ${sql.raw(dir)}\`)` |
| `.update({...})` | `.updateTable(t).set({...}).execute()` |
| `.delete()` / `.del()` | `.deleteFrom(t)...execute()` |
| `.insert(row)` | `.insertInto(t).values(row).execute()` |
| `.onConflict([...]).merge(p)` | `.onConflict((oc) => oc.columns([...]).doUpdateSet(p))` |
| `trx.batchInsert(t, rows, 500)` | manual chunk loop + `insertInto().values(chunk)` |
| `knex.fn.now()` | `` sql`now()` `` |
| `knex.raw('?', [v])` | `` sql`${v}` `` (auto-parameterized) |
| `knex.raw('??', [col])` | `sql.ref(col)` |
| `knex.raw('literal sql')` | `sql.raw('literal sql')` |
| `.clone()` | **not needed** — builders are immutable |
| `.clearSelect()/.clearOrder()` | `.clearSelect()/.clearOrderBy()/.clearGroupBy()` |
| `.toSQL()` → `{sql, bindings}` | `.compile()` → `{sql, parameters}` |
| `knex.transaction(async trx => …)` | `db.transaction().execute(async trx => …)` |

---

## 1. Obtaining the query interface

There are **two** interfaces in 0.6.7 and the framework uses both for different jobs.

### 1a. Kysely builder — `em.getKysely()`

**BEFORE** — `modules/messages/api/unread-count/route.ts:2,11-13` (0.4.8)
```ts
import type { Knex } from 'knex'

function getKnex(em: EntityManager): Knex {
  return (em.getConnection() as unknown as { getKnex: () => Knex }).getKnex()
}
```

**AFTER** — `modules/messages/api/unread-count/route.ts:2,27-29` (0.6.7)
```ts
import { type Kysely, sql } from 'kysely'

function getDb(em: EntityManager): Kysely<any> {
  return em.getKysely<any>()
}
```

Other verbatim forms the framework uses:

```ts
// modules/inbox_ops/api/proposals/counts/route.ts:52
const db = ctx.em.getKysely<any>() as any

// modules/customers/cli.ts:1879
const db = em.getKysely<any>() as any

// modules/query_index/di.ts:75 — when `em` is typed loosely
const db = (em as any).getKysely()
```

**Exact import statements (verbatim from framework):**
```ts
import { type Kysely, sql } from 'kysely'          // most files
import type { Kysely } from 'kysely'               // type-only (customers/lib/kysely.ts:1)
import { sql } from 'kysely'                       // value-only (shared/lib/query/join-utils.ts:2)
import type { RawBuilder } from 'kysely'           // for typing sql`` fragments
```

**API confirmation** (`@mikro-orm/sql/SqlEntityManager.d.ts:57`):
```ts
getKysely<TDB = undefined, TOptions extends GetKyselyOptions = GetKyselyOptions>(
  options?: TOptions
): Kysely<...>
```
`getKysely()` lives on **`SqlEntityManager`** (i.e. `em`), *not* on `getConnection()`.
`PostgreSqlConnection` only exposes `createKyselyDialect()` — there is **no** `connection.getKysely()`.

Per the doc comment at `SqlEntityManager.d.ts:34-55`, the returned instance is **transaction-aware**:
inside `em.transactional(...)` its queries join the current transaction; use `em.fork().getKysely()`
to run outside it.

**Rule:** replace `(em as any).getConnection().getKnex()` with `em.getKysely<any>()`; keep it in a
small local `getDb(em)` helper as the framework does.

### 1b. Raw SQL — `em.getConnection().execute()`

Used when the SQL is easier written by hand than built (upserts with `on conflict do update`,
dynamically concatenated `UPDATE`, one-off scans).

```ts
// modules/customers/lib/dealsOrganizationScope.ts:32-35
const rows = await em.getConnection().execute<Array<{ id: string }>>(
  `SELECT id FROM organizations WHERE tenant_id = ? AND deleted_at IS NULL`,
  [tenantId],
)
```

**Rule:** use `em.getKysely()` for anything composed/conditional; use
`em.getConnection().execute()` for hand-written statements (see §9).

### 1c. Typed schema (optional, framework-endorsed)

`modules/customers/lib/kysely.ts:9-54,69-76` declares a **narrow local DB interface** rather than a
project-wide schema, and a null-returning resolver:

```ts
export interface CustomerKyselyDb {
  customer_settings: { organization_id: string; tenant_id: string; stuck_threshold_days: number | string | null }
  customer_deals:    { id: string; organization_id: string; tenant_id: string; deleted_at: Date | string | null; created_at: Date | string | null }
  // …
}
export type CustomerKysely = Kysely<CustomerKyselyDb>

export function resolveKyselyClient<TDb = CustomerKyselyDb>(em: unknown): Kysely<TDb> | null {
  if (em == null || typeof em !== 'object') return null
  const candidate = (em as { getKysely?: unknown }).getKysely
  if (typeof candidate !== 'function') return null
  const db = (candidate as () => unknown).call(em)
  if (db == null) return null
  return db as Kysely<TDb>
}
```

**Rule:** default to `getKysely<any>()`; declare a narrow `Kysely<MyDb>` interface only for a
module's own hot-path helpers, and use a `resolveKyselyClient`-style guard when `em` is typed
`unknown` (e.g. enricher contexts) or when unit tests pass a stub EM.

---

## 2. `knex('table')` select → `selectFrom`

**BEFORE** — `modules/inbox_ops/api/proposals/counts/route.ts:48-58` (0.4.8)
```ts
const knex = ctx.em.getKnex()
const categoryRows = await knex('inbox_proposals')
  .select('category')
  .count('* as count')
  .where({
    organization_id: ctx.organizationId,
    tenant_id: ctx.tenantId,
    is_active: true,
  })
  .whereNull('deleted_at')
  .groupBy('category')
```

**AFTER** — `modules/inbox_ops/api/proposals/counts/route.ts:52-61` (0.6.7)
```ts
const db = ctx.em.getKysely<any>() as any
const categoryRows = await db
  .selectFrom('inbox_proposals')
  .select(['category', sql<string>`count(*)`.as('count')])
  .where('organization_id', '=', ctx.organizationId)
  .where('tenant_id', '=', ctx.tenantId)
  .where('is_active', '=', true)
  .where('deleted_at', 'is', null)
  .groupBy('category')
  .execute() as Array<{ category: string | null; count: string | number }>
```

Aliasing uses a string, not an object:

| knex | kysely |
|---|---|
| `knex('message_recipients as r')` | `db.selectFrom('message_recipients as r')` |
| `builder.leftJoin({ ei: 'entity_indexes' }, …)` | `q.leftJoin('entity_indexes as ei', …)` |
| `knex({ [first.alias]: first.table })` | ``db.selectFrom(`${first.table} as ${first.alias}`)`` |

**Rules:**
- `knex(t)` → `db.selectFrom(t)`; **`.execute()` is required** — kysely builders are not thenables,
  a bare `await q` returns the builder.
- `{alias: table}` object aliasing → `'table as alias'` string aliasing.
- The framework never ported `select('m.*')` blindly. In `modules/messages/api/route.ts:206-213` it
  replaced `.select('m.*', 'r.status as recipient_status', 'r.read_at')` with an **explicit column
  list**, then hydrated full rows via `findWithDecryption`. `selectAll()` exists and is used where a
  full row really is wanted (`modules/query_index/lib/indexer.ts:23`, `api/status.ts:183`).

---

## 3. `.where(col, val)` → operator is explicit

The canonical mapping is the framework's own switch, ported 1:1.

**BEFORE** — `shared/lib/query/engine.ts:254-267` (0.4.8)
```ts
switch (op) {
  case 'eq': builder.where(column, value); break
  case 'ne': builder.whereNot(column, value); break
  case 'gt': builder.where(column, '>', value); break
  case 'gte': builder.where(column, '>=', value); break
  case 'lt': builder.where(column, '<', value); break
  case 'lte': builder.where(column, '<=', value); break
  case 'in': builder.whereIn(column, Array.isArray(value) ? value : [value]); break
  case 'nin': builder.whereNotIn(column, Array.isArray(value) ? value : [value]); break
  case 'like': builder.where(column, 'like', value); break
  case 'ilike': builder.where(column, 'ilike', value); break
  case 'exists': value ? builder.whereNotNull(column) : builder.whereNull(column); break
  default: break
}
return builder
```

**AFTER** — `shared/lib/query/engine.ts:1060-1093` (0.6.7)
```ts
private applyColumnOp(builder: AnyBuilder, column: string | RawBuilder<unknown>, op: string, value: unknown): AnyBuilder {
  switch (op) {
    case 'eq':
      return value === null
        ? builder.where(column as any, 'is', null)
        : builder.where(column as any, '=', value as any)
    case 'ne':
      return value === null
        ? builder.where(column as any, 'is not', null)
        : builder.where(column as any, '!=', value as any)
    case 'gt':  return builder.where(column as any, '>', value as any)
    case 'gte': return builder.where(column as any, '>=', value as any)
    case 'lt':  return builder.where(column as any, '<', value as any)
    case 'lte': return builder.where(column as any, '<=', value as any)
    case 'in':  return builder.where(column as any, 'in', Array.isArray(value) ? value : [value])
    case 'nin': return builder.where(column as any, 'not in', Array.isArray(value) ? value : [value])
    case 'like':  return builder.where(column as any, 'like', value as any)
    case 'ilike': return builder.where(column as any, 'ilike', value as any)
    case 'exists':
      return value
        ? builder.where(column as any, 'is not', null)
        : builder.where(column as any, 'is', null)
    default:
      return builder
  }
}
```

**Rules:**
- Two-arg `.where(col, val)` is gone. Always three args: `.where(col, op, val)`.
- **`null` must use `'is'` / `'is not'`, never `'='`.** The framework added an explicit
  `value === null` branch for `eq`/`ne` precisely because of this.
- Object-form `.where({a: 1, b: 2})` has no kysely equivalent — expand into one `.where()` per key
  (see §2 BEFORE/AFTER, and `modules/query_index/lib/search-tokens.ts:155-158`).
- **Every `.where()` returns a NEW builder.** Mutating helpers must be rewritten to return the
  builder (the framework changed `applyFilterOp`'s signature to `(…): AnyBuilder` and every call
  site to `q = applyFilterOp(q, …)` — `shared/lib/query/engine.ts:339,513`).

There is also an expression-builder twin used inside `eb` callbacks
(`shared/lib/query/engine.ts:1095-1110`):
```ts
private buildColumnOpExpression(eb: any, column: string, op: string, value: unknown): any {
  switch (op) {
    case 'eq': return value === null ? eb(column, 'is', null) : eb(column, '=', value)
    case 'ne': return value === null ? eb(column, 'is not', null) : eb(column, '!=', value)
    case 'in': return eb(column, 'in', Array.isArray(value) ? value : [value])
    // …
  }
}
```

---

## 4. `whereIn` / `whereNull` / `whereNot` / `whereILike` / OR groups

### 4a. Flat predicates

**BEFORE** — `modules/messages/api/unread-count/route.ts:20-32` (0.4.8)
```ts
let query = knex('message_recipients as r')
  .join('messages as m', 'm.id', 'r.message_id')
  .where('r.recipient_user_id', scope.userId)
  .where('r.status', 'unread')
  .whereNull('r.deleted_at')
  .whereNull('r.archived_at')
  .where('m.tenant_id', scope.tenantId)
  .whereNull('m.deleted_at')

if (scope.organizationId) {
  query = query.where('m.organization_id', scope.organizationId)
} else {
  query = query.whereNull('m.organization_id')
}
```

**AFTER** — `modules/messages/api/unread-count/route.ts:49-63` (0.6.7)
```ts
let query = db
  .selectFrom('message_recipients as r')
  .innerJoin('messages as m', 'm.id', 'r.message_id')
  .where('r.recipient_user_id', '=', scope.userId)
  .where('r.status', '=', 'unread')
  .where('r.deleted_at', 'is', null)
  .where('r.archived_at', 'is', null)
  .where('m.tenant_id', '=', scope.tenantId)
  .where('m.deleted_at', 'is', null)

if (scope.organizationId) {
  query = query.where('m.organization_id', '=', scope.organizationId)
} else {
  query = query.where('m.organization_id', 'is', null)
}
```

`whereNotNull` → `'is not', null` — `modules/messages/api/route.ts:94-107` (0.6.7):
```ts
q = q
  .where('r.message_id', 'is not', null)
  .where('r.deleted_at', 'is', null)
  .where('r.archived_at', 'is not', null)
```

`whereIn` — `modules/messages/api/route.ts:141,148,251` (0.6.7):
```ts
q = q.where('m.external_email_hash', 'in', lookupHashCandidates(input.externalEmail))
q = q.where('m.id', 'in', searchIds)
.where('record_id', 'in', messageIds)
```

`whereNotIn` — `modules/notifications/lib/notificationService.ts:645` (0.6.7):
```ts
.where('status' as any, 'not in', ['actioned', 'dismissed'])
```
was `modules/notifications/lib/notificationService.ts:501` (0.4.8):
```ts
.whereNotIn('status', ['actioned', 'dismissed'])
```

`whereILike` — 0.4.8 `modules/messages/api/route.ts:152` used
`.whereILike('m.external_email', \`%${input.externalEmail}%\`)`.
0.6.7 keeps `ilike` as an operator: `builder.where(column, 'ilike', value)`
(`shared/lib/query/engine.ts:1085-1086`).

### 4b. Nested callback OR groups

**BEFORE** — `modules/messages/api/route.ts:120-123` (0.4.8)
```ts
joinRecipient()
query = query.where(function () {
  this.where('m.sender_user_id', scope.userId).orWhereNotNull('r.message_id')
})
```

**AFTER** — `modules/messages/api/route.ts:123-128` (0.6.7)
```ts
joinRecipient()
q = q.where((eb: any) => eb.or([
  eb('m.sender_user_id', '=', scope.userId),
  eb('r.message_id', 'is not', null),
]))
```

Conditional OR-group with a 1-element short-circuit — `shared/lib/query/engine.ts:1432-1444` (0.6.7),
replacing `shared/lib/query/engine.ts:950-968` (0.4.8):

```ts
// 0.4.8
private applyOrganizationScope(q: any, column: string, scope: { ids: string[]; includeNull: boolean }): any {
  if (!scope) return q
  if (scope.ids.length === 0 && !scope.includeNull) return q.whereRaw('1 = 0')
  return q.where((builder: any) => {
    let applied = false
    if (scope.ids.length > 0) { builder.whereIn(column as any, scope.ids); applied = true }
    if (scope.includeNull) {
      if (applied) builder.orWhereNull(column)
      else builder.whereNull(column)
      applied = true
    }
    if (!applied) builder.whereRaw('1 = 0')
  })
}

// 0.6.7
private applyOrganizationScope(q: AnyBuilder, column: string, scope: { ids: string[]; includeNull: boolean }): AnyBuilder {
  if (!scope) return q
  if (scope.ids.length === 0 && !scope.includeNull) {
    return q.where(sql<boolean>`1 = 0`)
  }
  return q.where((eb: any) => {
    const parts: any[] = []
    if (scope.ids.length > 0) parts.push(eb(column, 'in', scope.ids))
    if (scope.includeNull) parts.push(eb(column, 'is', null))
    if (parts.length === 1) return parts[0]
    return eb.or(parts)
  })
}
```

`orWhere` + `orWhereNull` inside a `modify()` callback — `modules/query_index/di.ts:87-93` (0.4.8):
```ts
.modify((qb: any) => {
  if (orgId != null) qb.andWhere((b: any) => b.where({ organization_id: orgId }).orWhereNull('organization_id'))
  else qb.whereNull('organization_id')
  if (tenantId != null) qb.andWhere((b: any) => b.where({ tenant_id: tenantId }).orWhereNull('tenant_id'))
  else qb.whereNull('tenant_id')
})
```
→ `modules/query_index/di.ts:94-109` (0.6.7):
```ts
if (orgId != null) {
  cfQuery = cfQuery.where((eb: any) => eb.or([
    eb('organization_id' as any, '=', orgId),
    eb('organization_id' as any, 'is', null),
  ]))
} else {
  cfQuery = cfQuery.where('organization_id' as any, 'is', null as any)
}
if (tenantId != null) {
  cfQuery = cfQuery.where((eb: any) => eb.or([
    eb('tenant_id' as any, '=', tenantId),
    eb('tenant_id' as any, 'is', null),
  ]))
} else {
  cfQuery = cfQuery.where('tenant_id' as any, 'is', null as any)
}
```

Composite `whereIn` over **tuples** — `modules/query_index/lib/search-tokens.ts:148` / `:161-170`:
```ts
// 0.4.8
if (fieldPairs.length) deleteQuery.whereIn(['entity_id', 'field'], fieldPairs)

// 0.6.7 — OR of ANDs
deleteQuery = deleteQuery.where((eb: any) => eb.or(
  fieldPairs.map(([rid, field]) => eb.and([
    eb('entity_id' as any, '=', rid),
    eb('field' as any, '=', field),
  ])),
))
```
> Note the framework's own follow-up comment at `modules/query_index/lib/search-tokens.ts:229-231`:
> "a per-field OR over the whole batch **overflows the query compiler's call stack** on large
> batches" — they replaced the batch variant with a plain `'in'` on `entity_id`.
> **Rule:** don't expand large tuple-`IN` sets into OR trees; narrow the predicate instead.

### 4c. EXISTS / NOT EXISTS

**BEFORE** — `modules/messages/api/route.ts:169-176` (0.4.8)
```ts
if (input.hasObjects !== undefined) {
  const subquery = knex('message_objects').select(1).whereRaw('message_objects.message_id = m.id')
  query = input.hasObjects ? query.whereExists(subquery) : query.whereNotExists(subquery)
}

if (input.hasAttachments !== undefined) {
  const subquery = knex('attachments')
    .select(1)
    .where('attachments.entity_id', MESSAGE_ATTACHMENT_ENTITY_ID)
    .whereRaw('attachments.record_id = m.id')
  query = input.hasAttachments ? query.whereExists(subquery) : query.whereNotExists(subquery)
}
```

**AFTER** — `modules/messages/api/route.ts:153-181` (0.6.7)
```ts
if (input.hasObjects !== undefined) {
  const existsFn = (eb: any) => eb.exists(
    eb.selectFrom('message_objects')
      .select(sql<number>`1`.as('one'))
      .whereRef('message_objects.message_id', '=', 'm.id')
  )
  const notExistsFn = (eb: any) => eb.not(eb.exists(
    eb.selectFrom('message_objects')
      .select(sql<number>`1`.as('one'))
      .whereRef('message_objects.message_id', '=', 'm.id')
  ))
  q = input.hasObjects ? q.where(existsFn) : q.where(notExistsFn)
}

if (input.hasAttachments !== undefined) {
  const existsFn = (eb: any) => eb.exists(
    eb.selectFrom('attachments')
      .select(sql<number>`1`.as('one'))
      .where('attachments.entity_id', '=', MESSAGE_ATTACHMENT_ENTITY_ID)
      .where(sql<boolean>`attachments.record_id = m.id::text`)
  )
  const notExistsFn = (eb: any) => eb.not(eb.exists(/* same */))
  q = input.hasAttachments ? q.where(existsFn) : q.where(notExistsFn)
}
```

And with a pre-built subquery — `shared/lib/query/join-utils.ts:364-370` (0.6.7):
```ts
if (existsDirective === false) {
  const capturedSub = sub
  nextBuilder = nextBuilder.where((eb: any) => eb.not(eb.exists(capturedSub)))
} else {
  const capturedSub = sub
  nextBuilder = nextBuilder.where((eb: any) => eb.exists(capturedSub))
}
```
(was `shared/lib/query/join-utils.ts:234-235` in 0.4.8:
`builder = builder.whereNotExists(sub)` / `builder.whereExists(sub)`)

**Rules:**
- `.select(1)` → `.select(sql<number>\`1\`.as('one'))` — kysely selections need a name.
- `.whereRaw('a.x = b.y')` (correlation) → `.whereRef('a.x', '=', 'b.y')`. Keep `sql\`\`` only where
  a cast is involved (`attachments.record_id = m.id::text`).
- Capture the subquery in a `const` before using it inside the `eb` closure (the framework does this
  explicitly, `capturedSub`).

---

## 5. Joins

### 5a. Simple join

`.join(t, l, r)` → `.innerJoin(t, l, r)`; `.leftJoin` keeps its name. Three-arg form is unchanged:

```ts
// 0.4.8 modules/messages/api/unread-count/route.ts:21
.join('messages as m', 'm.id', 'r.message_id')
// 0.6.7 modules/messages/api/unread-count/route.ts:50
.innerJoin('messages as m', 'm.id', 'r.message_id')

// 0.6.7 modules/audit_logs/services/actionLogService.ts:446
query = query.leftJoin('users as audit_actor', 'audit_actor.id', 'action_logs.actor_user_id')
```

### 5b. Join with a mixed ON (column-ref + literal value)

**BEFORE** — `modules/messages/api/route.ts:85-89` (0.4.8)
```ts
const joinRecipient = () => {
  query = query.leftJoin('message_recipients as r', function () {
    this.on('m.id', '=', 'r.message_id').andOn('r.recipient_user_id', '=', knex.raw('?', [scope.userId]))
  })
}
```

**AFTER** — `modules/messages/api/route.ts:88-92` (0.6.7)
```ts
const joinRecipient = () => {
  q = q.leftJoin('message_recipients as r', (jb: any) => jb
    .onRef('m.id', '=', 'r.message_id')
    .on('r.recipient_user_id', '=', scope.userId))
}
```

**Rule:** in a kysely join callback, `onRef` = column↔column, `on` = column↔value.
knex's `this.on(a,'=',b)`/`andOn` were both column-refs and needed `knex.raw('?')` to force a value;
kysely splits that into two distinct methods and parameterizes automatically.

### 5c. Composite ON built from N conditional fragments

**BEFORE** — `modules/query_index/lib/engine.ts:355-367` (0.4.8): string-concatenated `AND` fragments
handed to `knex.raw`.
```ts
const baseJoinParts: string[] = []
baseJoinParts.push(`ei.entity_type = ${knex.raw('?', [entity]).toString()}`)
baseJoinParts.push(`ei.entity_id = (${qualify('id')}::text)`)
if (hasOrganizationColumn) {
  baseJoinParts.push(`ei.organization_id = ${qualify('organization_id')}`)
  baseJoinParts.push('ei.organization_id is not null')
}
if (hasTenantColumn) {
  baseJoinParts.push(`ei.tenant_id = ${qualify('tenant_id')}`)
  baseJoinParts.push('ei.tenant_id is not null')
}
if (!opts.withDeleted) baseJoinParts.push(`ei.deleted_at is null`)
builder = builder.leftJoin({ ei: 'entity_indexes' }, knex.raw(baseJoinParts.join(' AND ')))
```

**AFTER** — `modules/query_index/lib/engine.ts:577-597` (0.6.7): a *reassigned* join-builder inside
the callback.
```ts
const applyEntityIndexesJoin = (q: AnyBuilder): AnyBuilder => {
  return q.leftJoin('entity_indexes as ei', (jb: any) => {
    let jc = jb
      .on('ei.entity_type', '=', String(entity))
      .onRef('ei.entity_id', '=', sql<string>`(${sql.ref(qualify('id'))}::text)`)
    if (hasOrganizationColumn) {
      jc = jc
        .onRef('ei.organization_id', '=', qualify('organization_id'))
        .on('ei.organization_id', 'is not', null)
    }
    if (hasTenantColumn) {
      jc = jc
        .onRef('ei.tenant_id', '=', qualify('tenant_id'))
        .on('ei.tenant_id', 'is not', null)
    }
    if (!opts.withDeleted) {
      jc = jc.on('ei.deleted_at', 'is', null)
    }
    return jc
  })
}
```

**Rule:** the join callback is immutable too — accumulate with `let jc = jb; jc = jc.on(...)` and
**return `jc`**. Never build ON clauses by string concatenation any more.

### 5d. Dynamic join type (`leftJoin` vs `innerJoin` at runtime)

**BEFORE** — `shared/lib/query/join-utils.ts:214-215` (0.4.8)
```ts
if (cfg.type === 'inner') sub.join(joinArgs, joinFn)
else sub.leftJoin(joinArgs, joinFn)
```

**AFTER** — `shared/lib/query/join-utils.ts:331-334` (0.6.7)
```ts
const joinFn = cfg.type === 'inner' ? 'innerJoin' : 'leftJoin'
sub = (sub as any)[joinFn](`${cfg.table} as ${cfg.alias}`, (jb: any) =>
  jb.onRef(`${cfg.alias}.${cfg.toField}`, '=', rightRef))
```
Same shape at `modules/query_index/lib/engine.ts:604-606`:
```ts
const joinType = (join.type ?? 'left') === 'inner' ? 'innerJoin' : 'leftJoin'
next = (next as any)[joinType](`${source.table} as ${source.alias}`, (jb: any) =>
  jb.onRef(`${source.alias}.${join.toField}`, '=', qualify(join.fromField)))
```

### 5e. Selecting FROM a subquery

**BEFORE** — `modules/query_index/lib/engine.ts:741-742` (0.4.8)
```ts
const countSource = optimizedCountBuilder.clone().clearSelect().clearOrder()
  .select(knex.raw(`${qualify('id')} as id`)).groupBy(qualify('id'))
const countQuery = knex.from(countSource.as('sq')).count({ count: knex.raw('*') })
```

**AFTER** — `modules/query_index/lib/engine.ts:877-878` (0.6.7)
```ts
const sub = countCore.select(sql.ref(qualify('id')).as('id')).groupBy(qualify('id')).as('sq')
const countQuery = db.selectFrom(sub as any).select(sql<string>`count(*)`.as('count'))
```

**Rule:** `knex.from(sub.as('x'))` → `db.selectFrom(sub.as('x'))`; the `.as()` still lives on the
subquery builder.

### 5f. JOINing **onto** a subquery — **NO FRAMEWORK PRECEDENT**

The framework's kysely code never joins against a derived table; it only *selects from* one (§5e) or
uses correlated `EXISTS` subqueries (§4c) — see `shared/lib/query/join-utils.ts:300-373`, where the
0.4.8 code already used `whereExists(sub)` rather than a join.

> **Recommendation (not observed practice):** kysely accepts a builder in the same first-argument
> position, so the shape is
> ```ts
> q = q.leftJoin(
>   db.selectFrom('t').select(['k', sql<string>`count(*)`.as('c')]).groupBy('k').as('agg'),
>   (jb) => jb.onRef('agg.k', '=', 'base.k'),
> )
> ```
> Prefer the framework's actual pattern instead: run the aggregate as a **separate query keyed by
> the page's ids** and join in JS. That is exactly what `modules/messages/api/route.ts:247-272` does
> for attachment and recipient counts.

---

## 6. Aggregates, `groupBy`, and reading the result

### 6a. `count`

**BEFORE** — `modules/messages/api/unread-count/route.ts:35-36` (0.4.8)
```ts
const row = await query.count('* as count').first<{ count: string | number }>()
const count = Number(row?.count ?? 0)
```

**AFTER** — `modules/messages/api/unread-count/route.ts:65-68` (0.6.7)
```ts
const row = await query
  .select(sql<number>`count(*)`.as('count'))
  .executeTakeFirst() as { count: string | number } | undefined
const count = Number(row?.count ?? 0)
```

### 6b. `countDistinct`

**BEFORE** — `shared/lib/query/engine.ts:587-594` (0.4.8)
```ts
const countClone: any = q.clone()
if (typeof countClone.clearSelect === 'function') countClone.clearSelect()
if (typeof countClone.clearOrder === 'function') countClone.clearOrder()
if (typeof countClone.clearGroup === 'function') countClone.clearGroup()
const countRow = await countClone
  .countDistinct(`${table}.id as count`)
  .first()
const total = Number((countRow as any)?.count ?? 0)
```

**AFTER** — `shared/lib/query/engine.ts:920-928` (0.6.7)
```ts
const countExpr = mayMultiplyBaseRows
  ? sql<string>`count(distinct ${sql.ref(`${table}.id`)})`
  : sql<string>`count(*)`
const countBuilder = hasJoinedAggregates
  ? qFull.clearSelect().clearOrderBy().clearGroupBy().select(countExpr.as('count'))
  : qFull.clearSelect().clearOrderBy().select(countExpr.as('count'))
const countRow = await countBuilder.executeTakeFirst() as { count: unknown } | undefined
const total = Number((countRow as any)?.count ?? 0)
```

### 6c. `groupBy` + per-key counts

**BEFORE** — `modules/messages/api/route.ts:209-215,223-229` (0.4.8)
```ts
? await getKnex(em)('attachments')
    .select('record_id')
    .count('* as count')
    .where('entity_id', MESSAGE_ATTACHMENT_ENTITY_ID)
    .whereIn('record_id', messageIds)
    .groupBy('record_id')
```

**AFTER** — `modules/messages/api/route.ts:248-254,262-269` (0.6.7)
```ts
? await (getDb(em) as any)
    .selectFrom('attachments')
    .select(['record_id', sql<string>`count(*)`.as('count')])
    .where('entity_id', '=', MESSAGE_ATTACHMENT_ENTITY_ID)
    .where('record_id', 'in', messageIds)
    .groupBy('record_id')
    .execute()
```

### 6d. Aggregate functions via the expression builder + `HAVING`

`modules/customers/lib/stuckDeals.ts:52-61` (0.6.7) — the framework's only typed-`eb.fn` example:
```ts
const oldTransitionRows = await db
  .selectFrom('customer_deal_stage_transitions')
  .select(['deal_id'])
  .select((eb) => eb.fn.max('transitioned_at').as('last_transition'))
  .where('organization_id', '=', organizationId)
  .where('tenant_id', '=', tenantId)
  .where('deleted_at', 'is', null)
  .groupBy('deal_id')
  .having((eb) => eb(eb.fn.max('transitioned_at'), '<', cutoff))
  .execute()
```
`.distinct()` also exists (`modules/customers/lib/stuckDeals.ts:66`; `modules/query_index/di.ts:154`).

`havingRaw` → `.having(sql\`\`)` — `shared/lib/query/engine.ts:772` (0.4.8):
```ts
.havingRaw(`count(distinct ${alias}.token_hash) >= ?`, [opts.hashes.length])
```
→ `shared/lib/query/engine.ts:1227` (0.6.7):
```ts
.having(sql<boolean>`count(distinct ${sql.ref(`${alias}.token_hash`)}) >= ${opts.hashes.length}`)
```
Also `modules/messages/lib/searchLookup.ts:44-47`:
```ts
const rows = await searchQuery
  .groupBy('entity_id')
  .having(sql<boolean>`count(distinct token_hash) >= ${tokens.hashes.length}`)
  .execute()
```

### 6e. `avg` / `sum` — **NO FRAMEWORK PRECEDENT**

Grepping both 0.4.8 and 0.6.7 trees finds no `.avg(`, `.sum(`, `avg(`, or `sum(` in query code.
> **Recommendation (not observed practice):** follow the `count` pattern exactly —
> `.select(sql<string>\`avg(${sql.ref('t.amount')})\`.as('avg_amount'))`, or the typed form
> `.select((eb) => eb.fn.avg('amount').as('avg_amount'))` mirroring `eb.fn.max` in §6d.
> Postgres returns `numeric` for `avg`/`sum` → the driver hands back a **string**; wrap in
> `Number(...)` as the framework does for every count.

### 6f. How the result is read

| knex | kysely |
|---|---|
| `await q.count('* as count').first()` → `{count}` \| `undefined` | `await q.select(sql\`count(*)\`.as('count')).executeTakeFirst()` → `{count}` \| `undefined` |
| `await q.count(...)` (no `.first()`) → `[{count}]` | `await q.select(...).execute()` → `[{count}]` |

**Rule:** the count value comes back as a **string** (Postgres `bigint`). Every framework call site
wraps it: `Number(row?.count ?? 0)` — `unread-count/route.ts:68`, `shared/lib/query/engine.ts:928`,
`inbox_ops/.../counts/route.ts:70`.

---

## 7. `.first()` → `.executeTakeFirst()`

**BEFORE** — `modules/query_index/di.ts:77` (0.4.8)
```ts
const row = await knex(table).select(['organization_id', 'tenant_id']).where({ id }).first()
orgId = row?.organization_id ?? orgId
tenantId = row?.tenant_id ?? tenantId
```

**AFTER** — `modules/query_index/di.ts:77-83` (0.6.7)
```ts
const row = await db
  .selectFrom(table as any)
  .select(['organization_id' as any, 'tenant_id' as any])
  .where('id' as any, '=', id)
  .executeTakeFirst() as { organization_id: string | null; tenant_id: string | null } | undefined
orgId = row?.organization_id ?? orgId
tenantId = row?.tenant_id ?? tenantId
```

Also `modules/customers/lib/stuckDeals.ts:21-26`:
```ts
const row = await db
  .selectFrom('customer_settings')
  .select(['stuck_threshold_days'])
  .where('organization_id', '=', organizationId)
  .where('tenant_id', '=', tenantId)
  .executeTakeFirst()
```

**Rules:**
- `.first()` → `.executeTakeFirst()`, returns `T | undefined` (same nullability as knex).
- `.first<T>()` type-param → a trailing `as T | undefined` cast (the framework's consistent style
  when the builder is `Kysely<any>`).
- `executeTakeFirstOrThrow()` exists in kysely but is **not used anywhere in the framework** — the
  codebase always handles `undefined` explicitly.

---

## 8. `orderBy`, `orderByRaw`, `limit`, `offset`

`orderBy` on a column is unchanged in shape (`shared/lib/query/engine.ts:576` → `:887`):
```ts
// 0.4.8
q = q.orderBy(qualify(column), s.dir ?? 'asc')
// 0.6.7
q = q.orderBy(qualify(s.field), (s.dir ?? 'asc') as any)
```

`orderByRaw` → `orderBy(sql\`…\`)` — `modules/query_index/lib/engine.ts:725` (0.4.8):
```ts
builder = builder.orderByRaw(`${textSql} ${direction}`)
```
→ `modules/query_index/lib/engine.ts:836-837` (0.6.7):
```ts
const direction = sql.raw(coerceSortDirection(s.dir))
next = next.orderBy(sql`${textExpr} ${direction}`)
```

Dynamic column + direction — `modules/customers/api/interactions/route.ts:571`:
```ts
rowsQuery = rowsQuery.orderBy(sql`${sql.raw(sortSql)} ${sql.raw(sortDir)}`).orderBy('id', sortDir)
```
Fixed raw expression — `modules/customers/lib/interactionProjection.ts:48`:
```ts
.orderBy(sql`priority desc nulls last`)
```
JSON-path sort — `modules/query_index/lib/engine.ts:1752`:
```ts
next = next.orderBy(sql`(${sql.ref(alias + '.doc')} ->> ${s.field}) ${direction}`)
```

`limit` / `offset` are identical, but the terminal `await` becomes `.execute()`
(`shared/lib/query/engine.ts:595` → `:1025-1026`):
```ts
// 0.4.8
const items = await q.limit(pageSize).offset((page - 1) * pageSize)
// 0.6.7
const dataQuery = qFull.limit(pageSize).offset((page - 1) * pageSize)
const items = await dataQuery.execute() as ResultRow[]
```

**Rules:**
- `sql.raw(x)` interpolates **unescaped SQL text** — only for values you control
  (direction keywords, whitelisted sort expressions). Never for user input.
- `sql.ref(x)` interpolates a **quoted identifier** (the `??` of knex).
- Bare `${x}` inside a `sql` template is a **bound parameter** (the `?` of knex).
- **`sql.raw(sortSql)` in `modules/customers/api/interactions/route.ts:571` is safe only because
  `sortSql` comes from a fixed whitelist.** Preserve that invariant when porting.

---

## 9. `knex.raw(...)` → `sql` templates and `execute()`

### 9a. Inside a builder: use the `sql` tagged template

| knex | kysely | meaning |
|---|---|---|
| `knex.raw('?', [v])` | `` sql`${v}` `` | bound parameter |
| `knex.raw('??', [col])` | `sql.ref(col)` | quoted identifier |
| `knex.raw('count(*)')` | `` sql`count(*)` `` / `sql.raw('count(*)')` | literal SQL |
| `knex.fn.now()` | `` sql`now()` `` | SQL function |
| `.whereRaw(s, [v])` | `.where(sql<boolean>\`… ${v}\`)` | raw predicate |
| `expr.toString()` string-concat | `${expr}` inside a `sql` template | fragment composition |

Framework examples:

```ts
// modules/query_index/lib/engine.ts:969-971 (0.4.8)
return knex.raw(`coalesce(${alias}.doc -> ?, ${alias}.doc -> ?)`, [key, bare])
return knex.raw(`${alias}.doc -> ?`, [key])
// modules/query_index/lib/engine.ts:1218-1220 (0.6.7)
return sql`coalesce(${sql.ref(alias + '.doc')} -> ${key}, ${sql.ref(alias + '.doc')} -> ${bare})`
return sql`${sql.ref(alias + '.doc')} -> ${key}`

// modules/query_index/lib/engine.ts:1066-1072 (0.4.8)
case 'like':   return builder.where(textExpr, 'like', value as Knex.Value)
case 'exists': return value
  ? builder.whereRaw(`${textExpr.toString()} is not null`)
  : builder.whereRaw(`${textExpr.toString()} is null`)
// modules/query_index/lib/engine.ts:1302-1310 (0.6.7)
case 'like':   return builder.where(sql<boolean>`${textExpr} like ${value}`)
case 'exists': return value
  ? builder.where(sql<boolean>`${textExpr} is not null`)
  : builder.where(sql<boolean>`${textExpr} is null`)

// dynamic operator — modules/query_index/lib/engine.ts:1314-1315 (0.6.7)
const operator = sql.raw(op === 'gt' ? '>' : op === 'gte' ? '>=' : op === 'lt' ? '<' : '<=')
return builder.where(sql<boolean>`${textExpr} ${operator} ${value}`)

// IS NOT DISTINCT FROM — modules/query_index/lib/search-tokens.ts:146-147 (0.4.8)
.andWhereRaw('organization_id is not distinct from ?', [organizationId])
.andWhereRaw('tenant_id is not distinct from ?', [tenantId])
// modules/query_index/lib/search-tokens.ts:158-159 (0.6.7)
.where(sql<boolean>`organization_id is not distinct from ${organizationId}`)
.where(sql<boolean>`tenant_id is not distinct from ${tenantId}`)

// value list — modules/query_index/lib/engine.ts:1300 (0.6.7)
return builder.where(sql<boolean>`${textExpr} not in (${sql.join(values.map((v) => sql`${v}`), sql`, `)})`)

// JSONB literal on write — modules/query_index/lib/indexer.ts:202 (0.6.7)
doc: sql`${JSON.stringify(doc)}::jsonb`,
```

### 9b. Standalone raw SQL: `em.getConnection().execute()`

**Parameter binding is knex-style positional `?` — NOT `$1`.**

```ts
// modules/customers/lib/dealsOrganizationScope.ts:32-35
const rows = await em.getConnection().execute<Array<{ id: string }>>(
  `SELECT id FROM organizations WHERE tenant_id = ? AND deleted_at IS NULL`,
  [tenantId],
)
const ids = rows.map((row: { id: string }) => String(row.id)).filter((id: string) => id.length > 0)

// modules/attachments/lib/reconcileOrganization.ts:100-103
const rows = (await em.getConnection().execute(
  'select id, entity_id, record_id, organization_id from attachments where tenant_id = ?',
  [tenantId],
)) as AttachmentScanRow[]

// modules/sales/services/salesDocumentNumberGenerator.ts:133-142 — INSERT … ON CONFLICT … RETURNING
const rows = await this.em.getConnection().execute<{ current_value: string }[]>(
  `
    insert into sales_document_sequences (id, organization_id, tenant_id, document_kind, current_value, created_at, updated_at)
    values (gen_random_uuid(), ?, ?, ?, ?, now(), now())
    on conflict (organization_id, tenant_id, document_kind)
    do update set current_value = sales_document_sequences.current_value + 1, updated_at = now()
    returning current_value
  `,
  [scope.organizationId, scope.tenantId, kind, DEFAULT_SEQUENCE_START]
)
const value = Number(rows?.[0]?.current_value ?? DEFAULT_SEQUENCE_START)
```

**Signature** (`@mikro-orm/sql/AbstractSqlConnection.d.ts:61`):
```ts
execute<T = EntityData<AnyEntity>[]>(
  query: string | NativeQueryBuilder | RawQueryFragment,
  params?: readonly unknown[],
  method?: 'all' | 'get' | 'run',
  ctx?: Transaction,
  loggerContext?: LoggingOptions,
): Promise<T>
```

**Return shape** (`@mikro-orm/sql/AbstractSqlConnection.js:267-280`, verbatim):
```js
transformRawResult(res, method) {
    if (method === 'get') {  return res.rows[0];  }
    if (method === 'all') {  return res.rows;     }
    return {
        affectedRows: Number(res.numAffectedRows ?? res.rows.length),
        insertId: res.insertId != null ? Number(res.insertId) : res.insertId,
        row: res.rows[0],
        rows: res.rows,
    };
}
```

| `method` | returns |
|---|---|
| `'all'` (default) | **a plain array of rows** — no `.rows` unwrapping needed |
| `'get'` | a single row object or `undefined` |
| `'run'` | `{ affectedRows, insertId, row, rows }` |

**Placeholder handling** (`AbstractSqlConnection.js:185-196` → `Platform.formatQuery`,
`@mikro-orm/core/platforms/Platform.js:567-600`): the SQL string is passed through
`platform.formatQuery(query, params)`, which walks the string replacing `?` with a quoted value and
`??` with a quoted identifier (`\?` escapes a literal `?`). The compiled query then goes to kysely as
`CompiledQuery.raw(q.formatted)` with **no** separate parameters array.

**Rules:**
- Use `?` positional placeholders. `$1`-style will **not** be substituted.
- `??` still means "quote this identifier" — same as knex.
- `await conn.execute(sql, params)` gives you the rows array directly; use `method: 'run'` when you
  need `affectedRows`.

### 9c. Building raw SQL conditionally

`modules/entities/cli.ts:933-943` (0.6.7) — string append + a parallel params array:
```ts
let deactivateSql = `UPDATE encryption_maps SET is_active = false, deleted_at = now() WHERE tenant_id = ? AND deleted_at IS NULL`
const deactivateParams: unknown[] = [tenantIdArg]
if (organizationIdArg) {
  deactivateSql += ` AND (organization_id = ? OR organization_id IS NULL)`
  deactivateParams.push(organizationIdArg)
}
if (entityIdArg) {
  deactivateSql += ` AND entity_id = ?`
  deactivateParams.push(entityIdArg)
}
await conn.execute(deactivateSql, deactivateParams)
```
and `modules/entities/cli.ts:600-604` for a dynamic SET list:
```ts
const setSql = Object.keys(updates).map((col) => `"${col}" = ?`).join(', ')
await conn.execute(
  `update ${qualifiedTable} set ${setSql} where "${pk}" = ?`,
  [...Object.values(updates), row[pk]],
)
```

---

## 10. UPDATE / DELETE / INSERT

### 10a. UPDATE

**BEFORE** — `modules/notifications/lib/notificationService.ts:499-505` (0.4.8)
```ts
const result = await knex('notifications')
  .where('expires_at', '<', knex.fn.now())
  .whereNotIn('status', ['actioned', 'dismissed'])
  .update({
    status: 'dismissed',
    dismissed_at: knex.fn.now(),
  })
return result
```

**AFTER** — `modules/notifications/lib/notificationService.ts:638-649` (0.6.7)
```ts
const updateResult = await db
  .updateTable('notifications' as any)
  .set({
    status: 'dismissed',
    dismissed_at: sql`now()`,
  } as any)
  .where('expires_at' as any, '<', sql`now()`)
  .where('status' as any, 'not in', ['actioned', 'dismissed'])
  .executeTakeFirst() as { numUpdatedRows?: bigint | number } | undefined

return Number(updateResult?.numUpdatedRows ?? 0)
```

Conditional-claim UPDATE reading the affected count —
`modules/notifications/lib/notificationService.ts:487-503` (0.6.7):
```ts
const claimResult = (await getDb(em)
  .updateTable('notifications' as any)
  .set({ status: 'actioned', actioned_at: actionedAt, action_taken: input.actionId } as any)
  .where('id' as any, '=', notification.id)
  .where('recipient_user_id' as any, '=', ctx.userId as any)
  .where('tenant_id' as any, '=', ctx.tenantId)
  .where('status' as any, '!=', 'actioned')
  .executeTakeFirst()) as { numUpdatedRows?: bigint | number } | undefined

if (Number(claimResult?.numUpdatedRows ?? 0) === 0) {
  throw conflict('Notification action already executed')
}
```

**Rules:**
- `.update(obj)` → `.updateTable(t).set(obj)` and the `where`s move **after** `set`
  (kysely order: `updateTable → set → where`).
- knex returned the affected-row count directly (`if (!updated)`); kysely returns an
  `UpdateResult` — `Number(result?.numUpdatedRows ?? 0)`. The framework rewrote every truthiness
  check accordingly (compare `modules/query_index/lib/indexer.ts:186` with `:225-229`).
- `numUpdatedRows` is a **bigint** — always coerce with `Number()`.
- `knex.fn.now()` → `` sql`now()` `` on both sides of the statement.

### 10b. Postgres `UPDATE … FROM` — **NO FRAMEWORK PRECEDENT**

Neither tree contains an `UPDATE … FROM`, an `.updateTable(...).from(...)`, an `.updateTable(...)
.whereRef(...)`, nor a `USING (...)` clause. All multi-table writes in 0.6.7 are done as
read-then-write loops (`modules/customers/cli.ts:2036-2061`) or single-table conditional updates.

> **Recommendation (not observed practice):** kysely's Postgres dialect supports
> ```ts
> await db.updateTable('a')
>   .from('b')
>   .set((eb) => ({ col: eb.ref('b.col') }))
>   .whereRef('a.b_id', '=', 'b.id')
>   .where('a.tenant_id', '=', tenantId)
>   .executeTakeFirst()
> ```
> Given there is no in-repo example to pattern-match against, the **safer port** for a knex
> `UPDATE … FROM` is `em.getConnection().execute()` with the SQL written out and `?` placeholders —
> that is the escape hatch the framework itself uses for every statement it did not want to model in
> the builder (§9b). Verify the generated SQL with `.compile()` before trusting the builder form.

### 10c. DELETE

**BEFORE** — `modules/notifications/lib/notificationService.ts:514-520` (0.4.8)
```ts
const result = await knex('notifications')
  .where({
    source_entity_type: sourceEntityType,
    source_entity_id: sourceEntityId,
    tenant_id: ctx.tenantId,
  })
  .delete()
```

**AFTER** — `modules/notifications/lib/notificationService.ts:655-663` (0.6.7)
```ts
const deleteResult = await db
  .deleteFrom('notifications' as any)
  .where('source_entity_type' as any, '=', sourceEntityType)
  .where('source_entity_id' as any, '=', sourceEntityId)
  .where('tenant_id' as any, '=', ctx.tenantId)
  .executeTakeFirst() as { numDeletedRows?: bigint | number } | undefined

return Number(deleteResult?.numDeletedRows ?? 0)
```

**Rule:** `knex(t).where(...).delete()`/`.del()` → `db.deleteFrom(t).where(...)`, then either
`.execute()` (discard count) or `.executeTakeFirst()` → `Number(r?.numDeletedRows ?? 0)`.

### 10d. INSERT and upsert (`onConflict … merge`)

**BEFORE** — `modules/query_index/lib/indexer.ts:158-187` (0.4.8)
```ts
const payload = {
  entity_type: args.entityType,
  entity_id: String(args.recordId),
  organization_id: args.organizationId ?? null,
  tenant_id: args.tenantId ?? null,
  doc,
  index_version: 1,
  updated_at: knex.fn.now(),
  deleted_at: null,
}
try {
  const insertQ = knex('entity_indexes').insert({ ...payload, created_at: knex.fn.now() })
  await insertQ
    .onConflict(['entity_type', 'entity_id', 'organization_id_coalesced'])
    .merge(payload)
} catch {
  const updated = await knex('entity_indexes')
    .where({ entity_type: args.entityType, entity_id: String(args.recordId), organization_id: args.organizationId ?? null })
    .andWhereRaw('tenant_id is not distinct from ?', [args.tenantId ?? null])
    .update(payload)
  if (!updated) {
    try { await knex('entity_indexes').insert({ ...payload, created_at: knex.fn.now() }) } catch {}
  }
}
```

**AFTER** — `modules/query_index/lib/indexer.ts:197-237` (0.6.7)
```ts
const payload = {
  entity_type: args.entityType,
  entity_id: String(args.recordId),
  organization_id: args.organizationId ?? null,
  tenant_id: args.tenantId ?? null,
  doc: sql`${JSON.stringify(doc)}::jsonb`,
  index_version: 1,
  updated_at: sql`now()`,
  deleted_at: null,
}

try {
  await db
    .insertInto('entity_indexes' as any)
    .values({ ...payload, created_at: sql`now()` } as any)
    .onConflict((oc: any) => oc
      .columns(['entity_type', 'entity_id', 'organization_id_coalesced'])
      .doUpdateSet({
        tenant_id: args.tenantId ?? null,
        doc: sql`${JSON.stringify(doc)}::jsonb`,
        index_version: 1,
        updated_at: sql`now()`,
        deleted_at: null,
      } as any))
    .execute()
} catch {
  const updated = await scopeEntityIndexes(
    db.updateTable('entity_indexes' as any).set(payload as any) as any,
    args,
  ).executeTakeFirst() as { numUpdatedRows?: bigint | number } | undefined
  if (!updated || Number(updated.numUpdatedRows ?? 0) === 0) {
    try {
      await db.insertInto('entity_indexes' as any).values({ ...payload, created_at: sql`now()` } as any).execute()
    } catch {}
  }
}
```

`excluded.*` in `doUpdateSet` — `modules/customers/cli.ts:2022-2035` (0.6.7):
```ts
await trx
  .insertInto('entity_indexes')
  .values(rows.map((row) => ({ ...row, doc: sql`${JSON.stringify(row.doc)}::jsonb` })))
  .onConflict((oc: any) => oc
    .columns(['entity_type', 'entity_id', 'organization_id_coalesced'])
    .doUpdateSet({
      doc: sql`excluded.doc`,
      index_version: sql`excluded.index_version`,
      organization_id: sql`excluded.organization_id`,
      tenant_id: sql`excluded.tenant_id`,
      deleted_at: sql`excluded.deleted_at`,
      updated_at: sql`excluded.updated_at`,
    }))
  .execute()
```

### 10e. Transactions and `batchInsert`

**BEFORE** — `modules/query_index/lib/search-tokens.ts:143-157` (0.4.8)
```ts
await knex.transaction(async (trx) => {
  const deleteQuery = trx('search_tokens')
    .where({ entity_type: params.entityType })
    .andWhereRaw('organization_id is not distinct from ?', [organizationId])
    .andWhereRaw('tenant_id is not distinct from ?', [tenantId])
  if (fieldPairs.length) deleteQuery.whereIn(['entity_id', 'field'], fieldPairs)
  else deleteQuery.where('entity_id', String(params.recordId))
  await deleteQuery.del()
  if (!rows.length) return
  const payloads = rows.map((row) => ({ ...row, created_at: trx.fn.now() }))
  await trx.batchInsert('search_tokens', payloads, 500)
})
```

**AFTER** — `modules/query_index/lib/search-tokens.ts:154-176` (0.6.7)
```ts
await db.transaction().execute(async (trx) => {
  let deleteQuery = trx
    .deleteFrom('search_tokens' as any)
    .where('entity_type' as any, '=', params.entityType)
    .where(sql<boolean>`organization_id is not distinct from ${organizationId}`)
    .where(sql<boolean>`tenant_id is not distinct from ${tenantId}`)
  if (fieldPairs.length) {
    deleteQuery = deleteQuery.where((eb: any) => eb.or(
      fieldPairs.map(([rid, field]) => eb.and([
        eb('entity_id' as any, '=', rid),
        eb('field' as any, '=', field),
      ])),
    ))
  } else {
    deleteQuery = deleteQuery.where('entity_id' as any, '=', String(params.recordId))
  }
  await deleteQuery.execute()
  if (!rows.length) return
  const payloads = rows.map((row) => ({ ...row, created_at: sql`now()` }))
  for (const batch of chunk(payloads, INSERT_BATCH_SIZE)) {
    await trx.insertInto('search_tokens' as any).values(batch as any).execute()
  }
})
```

And in the CLI seeder — `modules/customers/cli.ts:2184-2188` (0.4.8) vs `:2330-2336` (0.6.7):
```ts
// 0.4.8
const insertRows = async (trx: any, table: string, rows: unknown[]) => {
  if (!rows.length) return
  await trx.batchInsert(table, rows, entityInsertBatchSize)
  rows.length = 0
}
// 0.6.7
const insertRows = async (trx: any, table: string, rows: unknown[]) => {
  if (!rows.length) return
  for (let i = 0; i < rows.length; i += entityInsertBatchSize) {
    const chunk = rows.slice(i, i + entityInsertBatchSize)
    await trx.insertInto(table).values(chunk as any).execute()
  }
  rows.length = 0
}
```

**Rules:**
- `knex.transaction(cb)` → `db.transaction().execute(cb)`. The `trx` handle is a full `Kysely`
  instance (use `trx.selectFrom/insertInto/updateTable/deleteFrom`), not a callable.
- **`batchInsert` does not exist.** Chunk manually (framework batch size: `500` for tokens,
  `entityInsertBatchSize` = 1000 for seed rows) and call `.values(chunk).execute()` per chunk.
- `trx.fn.now()` → `` sql`now()` `` (there is no `trx.fn`).
- If the surrounding code already runs inside `em.transactional(...)`, `em.getKysely()` **already
  joins that transaction** (`SqlEntityManager.d.ts:34-48`) — don't open a second one.

---

## 11. Result key casing

**Answer: snake_case — the database column names, unchanged.**

Evidence, three independent sources:

1. **Plugin default** (`@mikro-orm/sql/plugin/index.d.ts`, `MikroKyselyPluginOptions`):
   ```ts
   /** Use database table names ('table') or entity names ('entity') in queries. @default 'table' */
   tableNamingStrategy?: 'table' | 'entity';
   /** Use database column names ('column') or property names ('property') in queries. @default 'column' */
   columnNamingStrategy?: 'column' | 'property';
   ```
   `getKysely()` takes these via `GetKyselyOptions extends MikroKyselyPluginOptions`
   (`SqlEntityManager.d.ts:17-22`). The framework never passes them → defaults apply → **raw
   table/column names in, raw column names out.**

2. **Framework read sites** — every row property is snake_case:
   ```ts
   // modules/query_index/di.ts:82-83
   orgId = row?.organization_id ?? orgId
   tenantId = row?.tenant_id ?? tenantId
   // modules/customers/cli.ts:1888
   entityIndexesColumnRows.map((row: any) => String(row.column_name).toLowerCase())
   // modules/messages/api/route.ts:219, 234
   const messageIds = typedRows.map((row) => row.id)
   … typedRows.map((row) => row.sender_user_id)
   // modules/messages/lib/searchLookup.ts:50
   .map((row: { entity_id?: unknown }) => (typeof row.entity_id === 'string' ? row.entity_id : null))
   ```
   The row type at `modules/messages/api/route.ts:30-42` is declared entirely in snake_case
   (`MessageListScopeRow`).

3. **Raw `execute()`** returns `res.rows` untouched from the `pg` driver
   (`AbstractSqlConnection.js:271-272`) → snake_case, e.g.
   `rows?.[0]?.current_value` (`salesDocumentNumberGenerator.ts:143`),
   `row.entity_id`, `row.record_id` (`reconcileOrganization.ts:109-111`).

**Rules:**
- Write `selectFrom('inbox_proposals')`, not `selectFrom('InboxProposal')`; write
  `.where('organization_id', …)`, not `.where('organizationId', …)`.
- Read rows as `row.organization_id`. Aliases you set with `.as('count')` keep exactly the name
  you gave them.
- Numeric columns coming back from Postgres `bigint`/`numeric` arrive as **strings** — the framework
  types them `string | number` and always wraps in `Number()`.

---

## 12. Dynamic / conditional query building (immutable builders)

Kysely builders are immutable: **every method returns a new builder, mutations are lost.** The
framework's port is a mechanical rule: `q.where(...)` → `q = q.where(...)`, and every helper that
mutated a builder now returns it.

**BEFORE** — `shared/lib/query/join-utils.ts:172-173` (0.4.8): helper mutates in place, returns void
```ts
applyAliasScope: (builder: Knex.QueryBuilder, alias: string, table: string) => Promise<void> | void
applyFilterOp: (builder: Knex.QueryBuilder, column: string, op: FilterOp, value?: unknown) => void
```
…and the body mutated `sub` directly:
```ts
const sub = knex({ [first.alias]: first.table }).select(1)
await applyAliasScope(sub, first.alias, first.table)
sub.whereRaw('?? = ??', [`${first.alias}.${first.toField}`, qualifyBase(first.fromField)])
…
applyFilterOp(sub, qualified, filter.op, filter.value)
if (existsDirective === false) builder = builder.whereNotExists(sub)
else builder = builder.whereExists(sub)
```

**AFTER** — `shared/lib/query/join-utils.ts:294-295, 318-370` (0.6.7): helpers **return** the builder
```ts
applyAliasScope: (builder: AnyBuilder, alias: string, table: string) => Promise<AnyBuilder> | AnyBuilder
applyFilterOp: (builder: AnyBuilder, column: string, op: FilterOp, value?: unknown) => AnyBuilder
```
```ts
let nextBuilder = builder
for (const [alias, filtersForAlias] of joinFilters.entries()) {
  const chain = buildJoinChain(alias, joinMap, baseTable)
  if (!chain.length) continue
  const first = chain[0]
  let sub: AnyBuilder = db.selectFrom(`${first.table} as ${first.alias}` as any).select(sql`1`.as('one'))
  sub = await applyAliasScope(sub, first.alias, first.table)
  const parentAlias = resolveAliasName(first.fromAlias)
  const parentRef = parentAlias === baseTable ? qualifyBase(first.fromField) : `${parentAlias}.${first.fromField}`
  sub = sub.whereRef(`${first.alias}.${first.toField}`, '=', parentRef)
  for (const cfg of chain.slice(1)) {
    …
    sub = (sub as any)[joinFn](`${cfg.table} as ${cfg.alias}`, (jb: any) =>
      jb.onRef(`${cfg.alias}.${cfg.toField}`, '=', rightRef))
    sub = await applyAliasScope(sub, cfg.alias, cfg.table)
  }
  …
  sub = applyFilterOp(sub, qualified, filter.op, filter.value)
  …
}
return nextBuilder
```

Simple conditional chaining — `modules/messages/lib/searchLookup.ts:30-42` (0.6.7):
```ts
let searchQuery = db
  .selectFrom('search_tokens')
  .select('entity_id')
  .where('entity_type', '=', 'messages:message')
  …
if (organizationId) {
  searchQuery = searchQuery.where('organization_id', '=', organizationId)
} else {
  searchQuery = searchQuery.where(sql<boolean>`organization_id is not distinct from ${null}`)
}
```

`.modify(cb)` has no equivalent — the framework replaced it with plain reassignment
(`modules/query_index/di.ts:87-93` → `:89-110`, quoted in §4b).

**Rules:**
- Convert every mutating helper to `(builder, …) => builder` and every call to `x = fn(x, …)`.
- knex's `.modify(cb)` → straight-line `if (cond) q = q.where(...)`.
- The framework's `AnyBuilder = any` alias (`shared/lib/query/join-utils.ts:6`) is the pragmatic
  escape when a builder's type changes shape across a conditional chain.

---

## 13. `.clone()` / `.clearSelect()` — count-of-a-filtered-query

**Kysely builders are immutable, so `.clone()` is unnecessary and does not exist.**
`clearSelect()`, `clearOrderBy()`, `clearGroupBy()` **do** exist — but note the renames
(`clearOrder` → `clearOrderBy`, `clearGroup` → `clearGroupBy`).

**BEFORE** — `shared/lib/query/engine.ts:587-595` (0.4.8)
```ts
const countClone: any = q.clone()
if (typeof countClone.clearSelect === 'function') countClone.clearSelect()
if (typeof countClone.clearOrder === 'function') countClone.clearOrder()
if (typeof countClone.clearGroup === 'function') countClone.clearGroup()
const countRow = await countClone.countDistinct(`${table}.id as count`).first()
const total = Number((countRow as any)?.count ?? 0)
const items = await q.limit(pageSize).offset((page - 1) * pageSize)
```

**AFTER** — `shared/lib/query/engine.ts:920-928, 1025-1026` (0.6.7)
```ts
const countExpr = mayMultiplyBaseRows
  ? sql<string>`count(distinct ${sql.ref(`${table}.id`)})`
  : sql<string>`count(*)`
const countBuilder = hasJoinedAggregates
  ? qFull.clearSelect().clearOrderBy().clearGroupBy().select(countExpr.as('count'))
  : qFull.clearSelect().clearOrderBy().select(countExpr.as('count'))
const countRow = await countBuilder.executeTakeFirst() as { count: unknown } | undefined
const total = Number((countRow as any)?.count ?? 0)
…
const dataQuery = qFull.limit(pageSize).offset((page - 1) * pageSize)
const items = await dataQuery.execute() as ResultRow[]
```
Note: **no `.clone()`**, and `qFull` is reused afterwards for the data page — safe precisely because
`clearSelect()` returned a *new* builder and left `qFull` intact.

The framework also uses a **second, more explicit strategy: a build-the-query-twice factory.**
`shared/lib/query/engine.ts:897, 904-910` (0.6.7):
```ts
return { builder: q, hasJoinedAggregates, cfJsonAliases, cfMultiAliasByAlias, resolvedCustomFieldDefinitions }
}
…
const { builder: qFull, hasJoinedAggregates, … } = await buildQuery('full')
```
`modules/messages/api/route.ts:76, 200-203, 206` (0.6.7) does the same — `buildBaseQuery()` is a
closure called once for the count and once for the page, replacing `query.clone()`:
```ts
const buildBaseQuery = () => { … return q }
…
const countResult = await buildBaseQuery()
  .select(sql<number>`count(*)`.as('count'))
  .executeTakeFirst() as { count: string | number } | undefined
…
const scopeRows = await buildBaseQuery()
  .select([...])
  .orderBy(…).limit(…).offset(…)
  .execute()
```
(0.4.8 was `modules/messages/api/route.ts:186`: `const countResult = await query.clone().count('* as count').first()`)

**Rules:**
- Drop `.clone()` entirely — reusing the same builder variable for two derived queries is safe.
- `clearSelect()` / `clearOrderBy()` / `clearGroupBy()` replace
  `clearSelect()` / `clearOrder()` / `clearGroup()`.
- When the query is built by a long conditional pipeline, prefer the framework's
  **`buildBaseQuery()` closure** over trying to un-build a shared builder — it is what both
  `shared/lib/query/engine.ts` and `modules/messages/api/route.ts` converged on.

---

## 14. Debugging / compiled SQL

**BEFORE** — `modules/query_index/lib/engine.ts:743-746` (0.4.8)
```ts
const { sql, bindings } = countQuery.clone().toSQL()
this.debug('query:sql:count', { entity, sql, bindings })
```

**AFTER** — `modules/query_index/lib/engine.ts:879-882` (0.6.7)
```ts
const compiled = countQuery.compile()
this.debug('query:sql:count', { entity, sql: compiled.sql, bindings: compiled.parameters })
```

**Rule:** `.toSQL()` → `.compile()`; `{ sql, bindings }` → `{ sql, parameters }`. No `.clone()` first.

---

## 15. Patterns with NO framework precedent (summary)

| Pattern | Status | Fallback |
|---|---|---|
| JOIN **onto** a subquery / derived table | none in 0.6.7 (only `selectFrom(sub.as('x'))`) | separate keyed query + JS join (`modules/messages/api/route.ts:247-272`), or `leftJoin(subBuilder.as('x'), jb => jb.onRef(...))` |
| Postgres `UPDATE … FROM` / `USING` | none in either tree | `em.getConnection().execute()` with hand-written SQL and `?` binds |
| `avg()` / `sum()` | none in either tree | `sql\`avg(...)\`.as('x')` or `eb.fn.avg('x')`, mirroring `eb.fn.max` at `stuckDeals.ts:55` |
| `DISTINCT ON` | none in 0.6.7 | `sql\`distinct on (...)\`` in the select, or `eb.fn.max` + `groupBy` as `stuckDeals.ts` does |
| `executeTakeFirstOrThrow()` | never used | framework always handles `undefined` explicitly — do the same |
| CTEs (`with`) | none in query code | — |

---

## 16. Porting checklist

1. `getKnex()` helper → `getDb(em) = em.getKysely<any>()` (§1).
2. `knex('t')` → `db.selectFrom('t')`; add **`.execute()` / `.executeTakeFirst()`** to every query (§2, §7).
3. Every `.where(col, val)` → `.where(col, '=', val)`; **`null` → `'is'` / `'is not'`** (§3).
4. `whereNull`/`whereNotNull`/`whereIn`/`whereNotIn`/`whereNot`/`whereILike` → operator strings (§4a).
5. `function(){ this.orWhere… }` → `(eb) => eb.or([...])`; `whereExists` → `(eb) => eb.exists(sub)` (§4b, §4c).
6. `.join` → `.innerJoin`; join callbacks → `onRef` (col↔col) / `on` (col↔value); accumulate with `let jc` (§5).
7. `.count('* as count')` → `.select(sql\`count(*)\`.as('count'))`; `Number(row.count)` (§6).
8. `orderByRaw` → `orderBy(sql\`${sql.raw(expr)} ${sql.raw(dir)}\`)` (§8).
9. `knex.raw('?',[v])` → `${v}`; `knex.raw('??',[c])` → `sql.ref(c)`; literal SQL → `sql.raw(...)`;
   `knex.fn.now()` → `` sql`now()` `` (§9a).
10. Standalone raw SQL → `em.getConnection().execute(sql, params)` with **`?`** placeholders;
    default return is a **rows array** (§9b).
11. `.update()` → `.updateTable().set().where()`; `.delete()` → `.deleteFrom()`; read
    `numUpdatedRows` / `numDeletedRows` via `Number()` (§10).
12. `onConflict([...]).merge(p)` → `onConflict(oc => oc.columns([...]).doUpdateSet(p))`;
    `batchInsert` → manual chunk loop; `knex.transaction(cb)` → `db.transaction().execute(cb)` (§10d, §10e).
13. Column/row keys stay **snake_case** (§11).
14. Reassign on every conditional step (`q = q.where(...)`); mutating helpers must **return** the
    builder (§12).
15. Delete `.clone()`; use `clearOrderBy`/`clearGroupBy`; prefer a `buildBaseQuery()` closure for
    count + page (§13).
16. `.toSQL()` → `.compile()`; `bindings` → `parameters` (§14).
