/**
 * App-level bootstrap file
 *
 * This thin wrapper imports generated files and passes them to the
 * shared bootstrap factory. The actual bootstrap logic lives in
 * @open-mercato/shared/lib/bootstrap.
 *
 * This file is imported by layout.tsx and API routes to initialize
 * the application before any package code executes.
 */

// Fill in PLATFORM_DOMAINS from APP_URL when it was not configured. Without it the customer
// portal answers every login on a non-localhost host with "This domain is not configured for
// any active organization". See src/lib/platform-domains.ts for the full rationale.
import { ensurePlatformDomains } from '@/lib/platform-domains'

ensurePlatformDomains()

// Register app dictionary loader before bootstrap (required for i18n in standalone packages)
import { registerAppDictionaryLoader } from '@open-mercato/shared/lib/i18n/server'
import type { Locale } from '@open-mercato/shared/lib/i18n/config'

registerAppDictionaryLoader(async (locale: Locale): Promise<Record<string, unknown>> => {
  switch (locale) {
    case 'en':
      return import('./i18n/en.json').then((m) => m.default)
    case 'pl':
      return import('./i18n/pl.json').then((m) => m.default)
    case 'es':
      return import('./i18n/es.json').then((m) => m.default)
    case 'de':
      return import('./i18n/de.json').then((m) => m.default)
    default:
      return import('./i18n/en.json').then((m) => m.default)
  }
})

// Generated imports (static - works with bundlers)
import { modules } from '@/.mercato/generated/modules.generated'
import { entities } from '@/.mercato/generated/entities.generated'
import { diRegistrars } from '@/.mercato/generated/di.generated'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { entityFieldsRegistry } from '@/.mercato/generated/entity-fields-registry'
import { dashboardWidgetEntries } from '@/.mercato/generated/dashboard-widgets.generated'
import { injectionWidgetEntries } from '@/.mercato/generated/injection-widgets.generated'
// Side-effect: registers translatable fields (must be before injection-tables which reads the registry)
import '@/.mercato/generated/translations-fields.generated'
import { injectionTables } from '@/.mercato/generated/injection-tables.generated'
import { searchModuleConfigs } from '@/.mercato/generated/search.generated'
import { eventModuleConfigs, allEvents } from '@/.mercato/generated/events.generated'
import { registerEventModuleConfigs } from '@open-mercato/shared/modules/events'
import { analyticsModuleConfigs } from '@/.mercato/generated/analytics.generated'
import { enricherEntries } from '@/.mercato/generated/enrichers.generated'
import { interceptorEntries } from '@/.mercato/generated/interceptors.generated'
import { componentOverrideEntries } from '@/.mercato/generated/component-overrides.generated'
import { guardEntries } from '@/.mercato/generated/guards.generated'
import { commandInterceptorEntries } from '@/.mercato/generated/command-interceptors.generated'
import { notificationHandlerEntries } from '@/.mercato/generated/notification-handlers.generated'
// 0.6.7: command registration became LAZY. Without registering the loaders the
// command registry only contains handlers that some other import happened to
// pull in, so CommandBus.resolveHandler throws
// "Command handler not registered for id ..." for anything not already loaded.
import { commandLoaderEntries } from '@/.mercato/generated/command-loaders.generated'
// 0.6.7: code-based workflow definitions must be registered explicitly, or
// migrations that retire a persisted seed row in favour of a code definition
// leave the workflow missing entirely.
import { allCodeWorkflows } from '@/.mercato/generated/workflows.generated'
import { messageTypes } from '@/.mercato/generated/message-types.generated'
import { messageObjectTypes } from '@/.mercato/generated/message-objects.generated'
import { registerMessageTypes } from '@open-mercato/core/modules/messages/lib/message-types-registry'
import { registerMessageObjectTypes } from '@open-mercato/core/modules/messages/lib/message-objects-registry'
// 0.6.x: the generator emits `bootstrap-registrations.generated.ts`, whose
// `runBootstrapRegistrations()` registers the backend and frontend ROUTE MANIFESTS.
// Its docstring says it exists so modules "can inject bootstrap-time side effects
// without bootstrap.ts knowing about them" — but the app still has to invoke it once.
// Nothing did, so `getBackendRouteManifests()` returned an empty list and
// `GET /api/auth/admin/nav` answered `{"groups":[]}` — the entire backend sidebar was
// blank for every user, superadmin included.
import { runBootstrapRegistrations } from '@/.mercato/generated/bootstrap-registrations.generated'
// 0.6.x unified `modules.ts` overrides (`entry.overrides.routes.*`). The dispatcher has
// to be handed the enabled-module list once; nothing did, so every override declared in
// src/modules.ts was silently inert. `registerApiRouteManifests` consults the override
// composer, so this MUST run before runBootstrapRegistrations() below.
import { applyModuleOverridesFromEnabledModules } from '@open-mercato/shared/modules/overrides'
import { enabledModules } from '@/modules'

// Register event configs globally (similar to search)
registerEventModuleConfigs(eventModuleConfigs)
registerMessageTypes(messageTypes, { replace: true })
registerMessageObjectTypes(messageObjectTypes, { replace: true })
// Overrides first: registerApiRouteManifests/registerPageRouteManifests compose them in.
// NOTE: the API catch-all (src/app/api/[...slug]/route.ts) resolves handlers straight
// from modules.generated and never consults the manifest registry, so `overrides.routes.api`
// does NOT affect API dispatch here — only page-route overrides take effect.
applyModuleOverridesFromEnabledModules(enabledModules)
// Must run before anything reads the route manifests (nav, route resolution).
runBootstrapRegistrations()

// Bootstrap factory from shared package
import { createBootstrap, isBootstrapped } from '@open-mercato/shared/lib/bootstrap'
// 0.6.7 wires the app's DI override hook through `BootstrapOptions.appDiRegistrar`.
// Without this the app's `register()` never runs — the documented DI escape hatch is
// dead, and with it the workaround for upstream #4201.
import { register as appDiRegister } from './di'

// Create bootstrap function with app's generated data
export const bootstrap = createBootstrap({
  modules,
  entities,
  diRegistrars,
  entityIds: E,
  entityFieldsRegistry,
  dashboardWidgetEntries,
  injectionWidgetEntries,
  injectionTables,
  searchModuleConfigs,
  analyticsModuleConfigs,
  enricherEntries,
  interceptorEntries,
  componentOverrideEntries,
  guardEntries,
  commandInterceptorEntries,
  commandLoaderEntries,
  notificationHandlerEntries,
  codeWorkflows: allCodeWorkflows,
}, {
  appDiRegistrar: appDiRegister,
})

export { isBootstrapped }
