# BUG: LocalLockStrategy — PostgreSQL Advisory Lock Never Released

**Issue**: open-mercato/open-mercato#1154  
**Severity**: High  
**Affected**: All apps using `QUEUE_STRATEGY=local` with any scheduled job  
**Status**: Reported, pending fix  

## Symptom

The scheduled job executes successfully on the first poll cycle, but every subsequent cycle logs:

```
[scheduler:local] Schedule <name> is already locked, skipping
```

This continues indefinitely until the Node.js process is restarted.

## Root Cause

`LocalLockStrategy` (`@open-mercato/scheduler/src/modules/scheduler/lib/localLockStrategy.ts`) uses PostgreSQL **session-scoped** advisory locks (`pg_try_advisory_lock` / `pg_advisory_unlock`), but MikroORM uses a **connection pool**. Each call to `em.getConnection().execute(...)` can check out a **different pool connection** (= different PostgreSQL session).

```
tryLock()  → pool connection [A] → pg_try_advisory_lock(hash)  → ACQUIRED on session A
unlock()   → pool connection [B] → pg_advisory_unlock(hash)    → SILENT NO-OP (session B never held this lock)
```

The lock remains held on connection A (which sits in the pool) forever. `pg_advisory_unlock()` returns `false` when the session doesn't hold the lock, but the return value is never checked — the failure is completely silent.

## Key Files

| File | Role |
|------|------|
| `node_modules/@open-mercato/scheduler/src/modules/scheduler/lib/localLockStrategy.ts` | Bug location — lock/unlock on different pool connections |
| `node_modules/@open-mercato/scheduler/src/modules/scheduler/services/localSchedulerService.ts` | Calls `tryLock` (line 138) and `unlock` (line 243) |
| `src/modules/bounties/setup.ts` | Defines the `*/1 * * * *` cron schedule that triggers the bug |

## Reproduction

1. Create any scheduled job (e.g., cron `*/1 * * * *` targeting a queue)
2. Start the local scheduler (`QUEUE_STRATEGY=local`)
3. First poll cycle — job executes and completes successfully
4. All subsequent polls — `"is already locked, skipping"` forever

## Why DI Override Won't Work

`LocalSchedulerService` hard-creates the lock strategy with `new LocalLockStrategy(em)` in its constructor (line 50). It is not resolved from the DI container, so registering an override has no effect.

## Fix Plan

### Upstream (framework repo)

**Pinned-connection fix** in `localLockStrategy.ts`:  
Store the raw knex connection used by `tryLock` in a `Map<lockKey, connection>`, then reuse that exact connection in `unlock`. This ensures both operations happen on the same PostgreSQL session.

Alternative approaches:
- **Transaction-scoped locks** (`pg_try_advisory_xact_lock`) — auto-released on commit/rollback, but requires refactoring the `tryLock/unlock` API into a `withLock(fn)` wrapper
- **Table-based locking** (`SELECT ... FOR UPDATE SKIP LOCKED`) — immune to connection pool issues, works for distributed setups too

### Local workaround (this project)

Use **patch-package** to apply the fix to `node_modules/@open-mercato/scheduler` locally. The patch survives `yarn install` and can be removed once the upstream fix is released.

```bash
# After editing the file in node_modules:
npx patch-package @open-mercato/scheduler
```

### Temporary workaround

Restart the dev server — closing the Node.js process closes all pool connections, which releases all session-scoped advisory locks.
