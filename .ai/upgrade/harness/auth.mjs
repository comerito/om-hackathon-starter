// Principals for the baseline harness.
//
// Verified against 0.4.8 on 2026-08-20:
//   admin    POST /api/auth/login                multipart/form-data  -> auth_token
//   customer POST /api/customer_accounts/login   application/json     -> customer_auth_token
//                                                                       + customer_session_token
//
// NOTE ON RATE LIMITS: the admin login route allows 5 attempts / 60s per email
// and 20 / 60s per IP; the customer route has its own limiter. The harness must
// log each principal in ONCE and reuse the jar for the whole run, or a full
// sweep will start returning 429s and poison the baseline.

import { BASE_URL, Jar } from './lib.mjs'

// Tenant/org ids are DISCOVERED, not hardcoded: `mercato init` mints fresh uuids
// every time it runs, so pinning them would silently break the harness the first
// time the upgrade database is rebuilt. They are read out of the admin JWT, which
// is the one login that does not itself require a tenantId.
let _scope = null
export async function scope() {
  if (_scope) return _scope
  const form = new FormData()
  form.set('email', 'superadmin@acme.com')
  form.set('password', 'secret')
  const res = await fetch(`${BASE_URL}/api/auth/login`, { method: 'POST', body: form, redirect: 'manual' })
  const body = await res.json().catch(() => ({}))
  if (!body?.token) throw new Error(`cannot discover scope: admin login returned ${res.status}`)
  const claims = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64url').toString())
  _scope = { tenantId: claims.tenantId, orgId: claims.orgId }
  return _scope
}

export const TENANT_ID = process.env.OM_TENANT_ID || (await scope()).tenantId
export const ORG_ID = process.env.OM_ORG_ID || (await scope()).orgId

export const PRINCIPALS = {
  admin: { kind: 'admin', email: 'admin@acme.com', password: 'secret' },
  superadmin: { kind: 'admin', email: 'superadmin@acme.com', password: 'secret' },
  alice: { kind: 'customer', email: 'alice.johnson@example.com', password: 'Password123!' },
  bob: { kind: 'customer', email: 'bob.smith@example.com', password: 'Password123!' },
  carol: { kind: 'customer', email: 'carol.white@example.com', password: 'Password123!' },
  anon: { kind: 'anon' },
}

export async function login(name) {
  const p = PRINCIPALS[name]
  if (!p) throw new Error(`unknown principal: ${name}`)
  const jar = new Jar()
  if (p.kind === 'anon') return { jar, ok: true, principal: name }

  if (p.kind === 'admin') {
    const form = new FormData()
    form.set('email', p.email)
    form.set('password', p.password)
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST', body: form, redirect: 'manual',
    })
    jar.absorb(res)
    const body = await res.json().catch(() => ({}))
    if (res.status !== 200 || !body.ok) {
      throw new Error(`admin login failed for ${p.email}: ${res.status} ${JSON.stringify(body)}`)
    }
    return { jar, ok: true, principal: name, userId: decodeSub(body.token) }
  }

  const res = await fetch(`${BASE_URL}/api/customer_accounts/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: p.email, password: p.password, tenantId: TENANT_ID }),
    redirect: 'manual',
  })
  jar.absorb(res)
  const body = await res.json().catch(() => ({}))
  if (res.status !== 200 || !body.ok) {
    throw new Error(`customer login failed for ${p.email}: ${res.status} ${JSON.stringify(body)}`)
  }
  return { jar, ok: true, principal: name, userId: body.user?.id, features: body.resolvedFeatures }
}

function decodeSub(jwt) {
  try {
    return JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).sub
  } catch { return undefined }
}

/** Log in every principal once and return a map of name -> session. */
export async function loginAll(names) {
  const out = {}
  for (const n of names) {
    out[n] = await login(n)
  }
  return out
}
