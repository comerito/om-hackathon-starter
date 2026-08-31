import { asFunction, InjectionMode } from 'awilix'
import type { AppContainer } from '@open-mercato/shared/lib/di/container'
import { createOptimisticLockGuardService } from '@open-mercato/shared/lib/crud/optimistic-lock'
import { getAllOptimisticLockReaders } from '@open-mercato/shared/lib/crud/optimistic-lock-store'
import { bootstrap } from '@open-mercato/core/bootstrap'
import { applicationLifecycleEvents } from '@open-mercato/shared/lib/runtime/events'

const APP_BOOTSTRAP_STARTED_EMITTED_KEY = '__openMercatoApplicationBootstrapStartedEventEmitted__'
const APP_BOOTSTRAP_COMPLETED_EMITTED_KEY = '__openMercatoApplicationBootstrapCompletedEventEmitted__'
const APP_BOOTSTRAP_FAILED_EMITTED_KEY = '__openMercatoApplicationBootstrapFailedEventEmitted__'

async function emitApplicationLifecycleEvent(
  container: AppContainer,
  eventName: string,
  emittedKey: string,
  payload: Record<string, unknown>
) {
  if ((globalThis as Record<string, unknown>)[emittedKey] === true) return

  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit(eventName, payload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent(eventName, payload)
    } else {
      return
    }

    ;(globalThis as Record<string, unknown>)[emittedKey] = true
  } catch (error) {
    console.warn('[application] Failed to emit lifecycle event', {
      event: eventName,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

// App-level DI overrides/registrations.
// This runs after core defaults and module DI registrars.
/**
 * WORKAROUND for upstream open-mercato/open-mercato#4201.
 *
 * `createRequestContainer` builds the DI container in `InjectionMode.CLASSIC`
 * (`shared/lib/di/container.ts:165`), which resolves dependencies by parsing the
 * factory function's PARAMETER NAMES. It then registers:
 *
 *   const em = baseEm.fork(...)                                  // :164
 *   crudMutationGuardService: asFunction((em: EntityManager) => …) // :183
 *
 * The parameter `em` shadows the enclosing `const em`. When Next/Turbopack bundles
 * the package it renames the shadowing binding to `em2` to eliminate the shadow, so
 * Awilix tries to resolve a registration named `em2` and throws. Note this is scope
 * hoisting, NOT minification — `next.config.ts` already sets
 * `serverMinification: false` and `turbopackMinify: false`, so disabling minification
 * is not a workaround.
 *
 * `resolveLegacyGuardService` swallows the throw (`catch { return null }`) and logs
 * "CRUD mutation guard service could not be resolved; the legacy guard bridge is
 * disabled".
 *
 * SCOPE OF IMPACT — measured, not assumed. Upstream #4201 (filed against 0.6.5) says
 * this disables OSS optimistic locking outright. **That is no longer true at 0.6.7.**
 * A/B tested on a production build: with the registration broken, a PUT carrying a
 * stale `x-om-ext-optimistic-lock-expected-updated-at` still returns
 * `409 optimistic_lock_conflict`, because the modern `runMutationGuards` registry path
 * enforces the lock independently of this DI key. What actually breaks is only the
 * LEGACY bridge — i.e. any guard supplied through the deprecated
 * `crudMutationGuardService` DI key, such as the enterprise `record_locks` override or
 * a hand-registered custom guard. Those are silently skipped.
 *
 * Reproduces only in production builds; `next dev` does not rename the parameter.
 *
 * The fix here re-registers the same service with `InjectionMode.PROXY` for this one
 * resolver. In PROXY mode Awilix passes the cradle object itself, so nothing parses
 * parameter names — `cradle.em` is a property access, which bundlers do not rename.
 * Behaviour is otherwise identical to the upstream registration.
 *
 * REMOVE THIS once #4201 is fixed upstream and the pin is raised past the fix.
 */
function registerMinificationSafeMutationGuard(container: AppContainer): void {
  try {
    container.register({
      crudMutationGuardService: asFunction(
        (cradle: { em: unknown }) =>
          createOptimisticLockGuardService({
            getEm: () => cradle.em as never,
            readers: getAllOptimisticLockReaders(),
          }),
        { injectionMode: InjectionMode.PROXY },
      ).scoped(),
    } as never)
  } catch (error) {
    // Never let the workaround break bootstrap; worst case we are back to the
    // upstream behaviour this is compensating for.
    console.error('[app/di] could not re-register crudMutationGuardService', error)
  }
}

export async function register(container: AppContainer) {
  // Must run before anything resolves the guard service.
  registerMinificationSafeMutationGuard(container)

  const basePayload = {
    source: 'apps/mercato',
    emittedAt: new Date().toISOString(),
  }

  await emitApplicationLifecycleEvent(
    container,
    applicationLifecycleEvents.bootstrapStarted,
    APP_BOOTSTRAP_STARTED_EMITTED_KEY,
    basePayload
  )

  try {
    // Call core bootstrap to setup eventBus and auto-register subscribers.
    // Guard against duplicate bootstrap when core bootstrap already ran in createRequestContainer.
    if (!container.registrations?.eventBus) {
      await bootstrap(container)
    }
  } catch (error) {
    await emitApplicationLifecycleEvent(
      container,
      applicationLifecycleEvents.bootstrapFailed,
      APP_BOOTSTRAP_FAILED_EMITTED_KEY,
      {
        ...basePayload,
        errorMessage: error instanceof Error ? error.message : String(error),
      }
    )
    throw error
  }

  await emitApplicationLifecycleEvent(
    container,
    applicationLifecycleEvents.bootstrapCompleted,
    APP_BOOTSTRAP_COMPLETED_EMITTED_KEY,
    basePayload
  )
  // App-level overrides can follow here
}
