# Implementation Gaps Guide — Phase 1 & 2 Completion

This guide covers all missing features from the Phase 1 & 2 audit, organized by priority.
Each item includes: what to build, which files to create/modify, exact patterns to follow, and acceptance criteria.

---

## Priority 1 — Team Formation Workflow

These features are **blocking for hackathon operation**. Without them, participants cannot form teams.

---

### P1.1 — Create Team Form on My Team Page

**What:** When a participant has no team, the My Team page (`/portal/team`) should show three options:
1. "Create a Team" — inline form with team name + description
2. "Browse & Join a Team" — link to `/portal/teams`
3. "Mark yourself as Looking for a Team" — toggle button

**Files to modify:**
- `src/modules/teams/frontend/[orgSlug]/portal/team/page.tsx` — add create team form and looking-for-team toggle to the empty state

**Implementation:**

```tsx
// Inside MyTeamContent, when !myMembership:

// 1. Create Team form state
const [showCreateForm, setShowCreateForm] = React.useState(false)
const [teamName, setTeamName] = React.useState('')
const [teamDesc, setTeamDesc] = React.useState('')
const [creating, setCreating] = React.useState(false)

// 2. Create team handler — calls the teams CRUD API
async function handleCreateTeam() {
  if (!teamName.trim() || !selectedId) return
  setCreating(true)
  try {
    await createCrud('teams/teams', {
      name: teamName,
      description: teamDesc || undefined,
      competition_id: selectedId,
    })
    // After creation, the user is NOT automatically added as owner.
    // Need a custom endpoint or modify the create command to auto-add creator as OWNER.
    // See "Auto-add creator as team owner" below.
    queryClient.invalidateQueries({ queryKey: ['portal-my-membership'] })
    flash('Team created!', 'success')
  } catch (err) {
    flash(err instanceof Error ? err.message : 'Failed to create team', 'error')
  } finally {
    setCreating(false)
  }
}

// 3. Toggle looking-for-team handler
// Needs a portal API endpoint since participations CRUD uses staff auth.
// See P1.5 below for the portal endpoint.
```

**Critical dependency — Auto-add creator as team owner:**

The `teams.teams.create` command creates a Team record but does NOT add the creator as a `TeamMember` with role `OWNER`. This must be added to the command:

**File:** `src/modules/teams/commands/teams.ts` — modify `createTeamCommand.execute()`:

```typescript
// After creating the team:
const team = await de.createOrmEntity({ entity: Team, data: { ... } })

// Auto-add creator as OWNER
await de.createOrmEntity({
  entity: TeamMember,
  data: {
    teamId: team.id,
    customerUserId: ctx.auth?.userId ?? ctx.auth?.sub,
    competitionId: parsed.competition_id,
    role: 'owner',
    tenantId: scope.tenantId,
    organizationId: scope.organizationId,
  },
})
```

**Important:** This only works for portal-initiated creation. Backend admin creation should NOT auto-add a member. Add a flag like `auto_add_owner: boolean` to the create schema, defaulting to `false`. The portal form sends `auto_add_owner: true`.

**Portal API needed:** The portal pages use customer auth, but the teams CRUD route uses staff auth. You need either:
- A portal-specific create team endpoint at `src/modules/teams/api/portal/create-team/route.ts` using `getCustomerAuthFromRequest`
- OR modify the teams CRUD route to accept both auth types (not recommended)

Pattern for portal endpoint:
```typescript
// src/modules/teams/api/portal/create-team/route.ts
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'

export const metadata = { POST: { requireCustomerAuth: true } }

export async function POST(req: Request) {
  const auth = await getCustomerAuthFromRequest(req)
  if (!auth?.sub) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

  // Verify participation in the competition
  // Create team
  // Auto-add auth.sub as OWNER TeamMember
  // Return team ID
}
```

**Acceptance criteria:**
- [ ] Participant without a team sees "Create a Team" button
- [ ] Clicking opens inline form with name + description fields
- [ ] Submitting creates Team + adds user as OWNER member
- [ ] Page refreshes to show the new team
- [ ] "Browse Teams" link still visible
- [ ] "Looking for Team" toggle visible (see P1.5)

---

### P1.2 — Invitation Inbox on My Team Page

**What:** My Team page should show:
- For team owners: pending invitations sent + pending join requests received
- For all members: invitations received (pending)
- Accept/Decline buttons on each invitation

**Files to create:**
- `src/modules/teams/api/portal/my-invitations/route.ts` — portal endpoint returning invitations for the current user

**Files to modify:**
- `src/modules/teams/frontend/[orgSlug]/portal/team/page.tsx` — add invitations section

**Portal API endpoint:**
```typescript
// GET /api/teams/portal/my-invitations?competition_id=X
// Returns:
// - invitations where inviteeId === auth.sub (received)
// - invitations where inviterId === auth.sub (sent)
// - join requests for teams where the user is OWNER

export async function GET(req: Request) {
  const auth = await getCustomerAuthFromRequest(req)
  const url = new URL(req.url)
  const competitionId = url.searchParams.get('competition_id')

  // Fetch received invitations
  const received = await em.find(TeamInvitation, {
    inviteeId: auth.sub,
    competitionId,
    status: 'pending',
    tenantId: auth.tenantId,
  })

  // Fetch sent invitations (for team owners)
  const sent = await em.find(TeamInvitation, {
    inviterId: auth.sub,
    competitionId,
    status: 'pending',
    tenantId: auth.tenantId,
  })

  return NextResponse.json({ received, sent })
}
```

**Portal API endpoint for responding:**
```typescript
// POST /api/teams/portal/respond-invitation
// Body: { invitation_id, action: 'accept' | 'decline' }
// Validates: inviteeId matches auth.sub (can only respond to own invitations)
// On accept: creates TeamMember record, sets invitation status to ACCEPTED
// On decline: sets invitation status to DECLINED

export async function POST(req: Request) {
  const auth = await getCustomerAuthFromRequest(req)
  const { invitation_id, action } = await req.json()

  const invitation = await em.findOne(TeamInvitation, {
    id: invitation_id,
    inviteeId: auth.sub,  // CRITICAL: only respond to own invitations
    status: 'pending',
  })

  if (action === 'accept') {
    // Create TeamMember
    // Update invitation status
    // Emit teams.invitation.accepted event
  }
  if (action === 'decline') {
    // Update invitation status
    // Emit teams.invitation.declined event
  }
}
```

**UI component on My Team page:**
```tsx
// Add below the team details section:
<PortalCard>
  <PortalCardHeader title="Pending Invitations" />
  <div className="px-6 pb-6 divide-y">
    {receivedInvitations.map(inv => (
      <div key={inv.id} className="py-3 flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Team: {inv.team_name}</span>
          <span className="text-xs text-muted-foreground ml-2">
            {inv.type === 'invite' ? 'Invited you' : 'Your join request'}
          </span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => respond(inv.id, 'accept')}>Accept</Button>
          <Button size="sm" variant="outline" onClick={() => respond(inv.id, 'decline')}>Decline</Button>
        </div>
      </div>
    ))}
  </div>
</PortalCard>
```

**Acceptance criteria:**
- [ ] Received invitations shown with team name and action buttons
- [ ] Accept creates TeamMember and refreshes page to show team
- [ ] Decline updates status and removes from list
- [ ] Team owners see sent invitations and pending join requests
- [ ] Only pending invitations shown (not expired/accepted/declined)

---

### P1.3 — Join Request Button on Team Browser

**What:** Each team card on the Browse Teams page should have a "Request to Join" button.

**Files to create:**
- `src/modules/teams/api/portal/request-join/route.ts` — portal endpoint to create a join request

**Files to modify:**
- `src/modules/teams/frontend/[orgSlug]/portal/teams/page.tsx` — add join button to each team card

**Portal API endpoint:**
```typescript
// POST /api/teams/portal/request-join
// Body: { team_id }
// Creates TeamInvitation with type=JOIN_REQUEST, inviterId=auth.sub, inviteeId=team owner
// Validates: user not already on a team in this competition

export async function POST(req: Request) {
  const auth = await getCustomerAuthFromRequest(req)
  const { team_id } = await req.json()

  // Check user doesn't already have a team
  const existingMember = await em.findOne(TeamMember, {
    customerUserId: auth.sub,
    competitionId: team.competitionId,
    deletedAt: null,
  })
  if (existingMember) return error('You are already on a team')

  // Find team owner
  const owner = await em.findOne(TeamMember, {
    teamId: team_id,
    role: 'owner',
    deletedAt: null,
  })

  // Create join request invitation
  await em.create(TeamInvitation, {
    teamId: team_id,
    inviterId: auth.sub,
    inviteeId: owner.customerUserId,
    type: 'join_request',
    status: 'pending',
    expiresAt: addDays(new Date(), 7),
    ...
  })
}
```

**UI on team card:**
```tsx
<Button
  size="sm"
  variant="outline"
  onClick={() => requestJoin(team.id)}
  disabled={hasTeam || hasPendingRequest}
>
  {hasPendingRequest ? 'Request Sent' : 'Request to Join'}
</Button>
```

**Acceptance criteria:**
- [ ] "Request to Join" button on each team card in browser
- [ ] Disabled if user already on a team
- [ ] Shows "Request Sent" if pending request exists
- [ ] Creates join_request invitation targeting team owner
- [ ] Team owner sees request in their invitations list (P1.2)

---

### P1.4 — Track Selection on My Team Page

**What:** Team owner can select a track from a dropdown on the My Team page.

**Files to modify:**
- `src/modules/teams/frontend/[orgSlug]/portal/team/page.tsx` — add track selection UI for owners

**Implementation:**
```tsx
// In the team details section, for OWNER role:
// Fetch available tracks for the competition
const { data: tracksData } = useQuery({
  queryKey: ['portal-tracks-for-selection', selectedId],
  queryFn: () => fetchCrudList('tracks/tracks', { competition_id: selectedId, pageSize: '50' }),
  enabled: !!selectedId,
})

// Track selector (only for owners)
{myMembership.role === 'owner' && (
  <div className="flex items-center gap-3 mt-3">
    <label className="text-sm font-medium">Track:</label>
    <select
      value={team.track_id ?? ''}
      onChange={async (e) => {
        // Call the select-track API (already exists but uses staff auth)
        // Need portal endpoint — see below
      }}
    >
      <option value="">Select a track...</option>
      {tracks.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
    </select>
  </div>
)}
```

**Portal API needed:**
```typescript
// POST /api/teams/portal/select-track
// Body: { team_id, track_id }
// Validates: auth.sub is the team OWNER
// Updates team.trackId
```

The existing `/api/teams/select-track/route.ts` uses staff auth. Create a portal variant at `src/modules/teams/api/portal/select-track/route.ts` that:
1. Uses `getCustomerAuthFromRequest`
2. Verifies the caller is the team OWNER
3. Verifies the track belongs to the same competition
4. Updates `team.trackId`

**Acceptance criteria:**
- [ ] Track dropdown visible only for team owners
- [ ] Shows all tracks for the current competition
- [ ] Selecting a track calls the portal API
- [ ] Non-owners see track name as read-only text
- [ ] Track change emits `teams.team.track_selected` event

---

### P1.5 — "Looking for Team" Toggle

**What:** Participants without a team can toggle "Looking for a Team" status + description.

**Files to create:**
- `src/modules/competitions/api/portal/update-participation/route.ts` — portal endpoint to update own participation

**Files to modify:**
- `src/modules/teams/frontend/[orgSlug]/portal/team/page.tsx` — add toggle in empty state

**Portal API endpoint:**
```typescript
// PUT /api/competitions/portal/update-participation
// Body: { looking_for_team: boolean, looking_for_team_description?: string }
// Updates the caller's own CompetitionParticipation record

export async function PUT(req: Request) {
  const auth = await getCustomerAuthFromRequest(req)
  const body = await req.json()

  const participation = await em.findOne(CompetitionParticipation, {
    customerUserId: auth.sub,
    competitionId: body.competition_id,
    tenantId: auth.tenantId,
    deletedAt: null,
  })
  if (!participation) return error('Not a participant')

  participation.lookingForTeam = body.looking_for_team
  participation.lookingForTeamDescription = body.looking_for_team_description ?? null
  await em.persistAndFlush(participation)

  return NextResponse.json({ ok: true })
}
```

**UI on My Team page (when no team):**
```tsx
<div className="flex items-center gap-3">
  <input
    type="checkbox"
    checked={lookingForTeam}
    onChange={(e) => toggleLookingForTeam(e.target.checked)}
  />
  <span className="text-sm">I'm looking for a team</span>
</div>
{lookingForTeam && (
  <textarea
    placeholder="Describe your skills and what you're looking for..."
    value={lookingDescription}
    onChange={(e) => setLookingDescription(e.target.value)}
  />
)}
```

**Acceptance criteria:**
- [ ] Checkbox toggle visible when user has no team
- [ ] Toggling calls portal API to update participation
- [ ] Optional description textarea appears when checked
- [ ] Status visible in "People Looking for Teams" tab (P1.6)

---

### P1.6 — "People Looking for Teams" Tab on Team Browser

**What:** The Browse Teams page should have a tab/section showing individual participants who are looking for a team.

**Files to create:**
- `src/modules/competitions/api/portal/looking-for-team/route.ts` — returns participants with `lookingForTeam=true`

**Files to modify:**
- `src/modules/teams/frontend/[orgSlug]/portal/teams/page.tsx` — add tab/section

**Portal API endpoint:**
```typescript
// GET /api/competitions/portal/looking-for-team?competition_id=X
// Returns participants with lookingForTeam=true for this competition
// Joins with ParticipantProfile for skills/bio

export async function GET(req: Request) {
  const auth = await getCustomerAuthFromRequest(req)
  const competitionId = url.searchParams.get('competition_id')

  // Verify caller participates
  // Fetch participations with lookingForTeam=true
  // Join with ParticipantProfile for skills/bio
  // Return list
}
```

**UI:**
```tsx
// Tabs at top of Browse Teams page:
<div className="flex gap-1 border-b mb-4">
  <button onClick={() => setTab('teams')}
    className={tab === 'teams' ? 'border-b-2 border-primary' : ''}>
    Teams
  </button>
  <button onClick={() => setTab('people')}
    className={tab === 'people' ? 'border-b-2 border-primary' : ''}>
    People Looking for Teams
  </button>
</div>

// When tab === 'people':
// Show grid of participant cards with:
// - Name (or User ID)
// - Skills tags
// - Organization
// - "Looking for team" description
// - "Invite to Team" button (if current user is a team owner with open spots)
```

**Acceptance criteria:**
- [ ] Two tabs: "Teams" and "People Looking for Teams"
- [ ] People tab shows participants with `lookingForTeam=true`
- [ ] Each card shows skills, organization, description
- [ ] "Invite to Team" button for team owners
- [ ] Filters: skills, organization

---

## Priority 2 — Portal Completeness

These features complete the portal experience but are not blocking for basic team formation.

---

### P2.1 — Portal Dashboard Page

**What:** The portal nav links to `/portal/dashboard` but no custom dashboard page exists. The built-in portal dashboard shows generic widgets (orders, invoices) that are irrelevant.

**File to create:**
- `src/modules/competitions/frontend/[orgSlug]/portal/dashboard/page.tsx`

**Implementation:** Show "Your Current Task" card based on competition stage:

```tsx
// Stage-aware task prompt:
const taskPrompts: Record<string, { title: string; action: string; href: string }> = {
  open: { title: 'Complete your registration', action: 'Accept Code of Conduct', href: '/portal/profile' },
  team_formation: { title: 'Join or create a team', action: 'Browse Teams', href: '/portal/teams' },
  track_selection: { title: 'Select a track for your team', action: 'Go to My Team', href: '/portal/team' },
  hacking: { title: 'Work on your project', action: 'Edit Project', href: '/portal/project' },
  demos: { title: 'Prepare for your presentation', action: 'View Schedule', href: '/portal/presentations' },
  deliberation: { title: 'Vote for your favorite projects', action: 'Cast Votes', href: '/portal/voting' },
  finished: { title: 'Results are in!', action: 'View Results', href: '/portal/results' },
}

// Also show:
// - My team status (or "no team" prompt)
// - Next agenda item
// - Latest announcements (2-3 most recent)
// - Pending invitations count
```

**Acceptance criteria:**
- [ ] Dashboard page exists at `/portal/dashboard`
- [ ] Shows stage-aware "Your Current Task" card
- [ ] Shows team status summary
- [ ] Shows next upcoming agenda item
- [ ] Shows latest 2-3 announcements
- [ ] Shows pending invitation count

---

### P2.2 — Participants Directory Portal Page

**What:** Searchable list of all participants in the competition.

**File to create:**
- `src/modules/competitions/frontend/[orgSlug]/portal/participants/page.tsx`
- `src/modules/competitions/frontend/[orgSlug]/portal/participants/page.meta.ts`
- `src/modules/competitions/api/portal/participants/route.ts` — returns participants with profiles

**Portal API:**
```typescript
// GET /api/competitions/portal/participants?competition_id=X&skills=TypeScript&looking_for_team=true
// Joins CompetitionParticipation with ParticipantProfile
// Returns: name, organization, skills, lookingForTeam, role
```

**UI:**
- Card grid of participants
- Filters: skills, organization, "looking for team", role
- "Invite to Team" button (for team owners)

**Nav widget update:**
Add `participants` menu item to `src/modules/competitions/widgets/injection/portal-nav/widget.ts`.

**Acceptance criteria:**
- [ ] Page accessible from portal sidebar
- [ ] Shows all participants with profile info
- [ ] Filterable by skills, organization, looking-for-team status
- [ ] "Invite to Team" button for team owners with open spots

---

### P2.3 — Competition Context Response Enricher

**What:** Other modules need to access competition name/stage in their API responses.

**File to create:**
- `src/modules/competitions/data/enrichers.ts`

**Implementation:**
```typescript
// Enricher that targets teams:team and tracks:track entities
// Adds _competitions: { name, stage, slug } to responses

const competitionEnricher: ResponseEnricher = {
  id: 'competitions.competition-context',
  targetEntity: 'teams:team',  // Also tracks:track via separate enricher
  async enrichMany(records, context) {
    const competitionIds = [...new Set(records.map(r => r.competition_id))]
    const competitions = await em.find(Competition, { id: { $in: competitionIds } })
    const map = new Map(competitions.map(c => [c.id, c]))
    return records.map(r => ({
      ...r,
      _competitions: {
        name: map.get(r.competition_id)?.name ?? null,
        stage: map.get(r.competition_id)?.stage ?? null,
      },
    }))
  },
}
```

**Acceptance criteria:**
- [ ] Teams API responses include `_competitions.name` and `_competitions.stage`
- [ ] Tracks API responses include competition context
- [ ] Enricher properly cached

---

## Priority 3 — Operations Features

These features are needed for running the actual hackathon event.

---

### P3.1 — CoC / Privacy Policy Acceptance Gate

**What:** Portal access is blocked until both Code of Conduct and Privacy Policy are accepted.

**Approach:** Since we can't modify the framework's portal middleware, implement as a **client-side gate** in the `CompetitionProvider`:

```tsx
// In CompetitionProvider, after loading competitions:
// Check if the selected competition's participation has cocAccepted + privacyPolicyAccepted
// If not, render a blocking modal/overlay instead of children

// Portal API needed:
// GET /api/competitions/portal/my-participation?competition_id=X
// Returns: { cocAccepted, privacyPolicyAccepted, cocUrl, privacyPolicyUrl }

// PUT /api/competitions/portal/accept-coc
// Body: { competition_id }
// Sets cocAccepted=true, cocAcceptedAt=now()

// PUT /api/competitions/portal/accept-privacy
// Body: { competition_id }
// Sets privacyPolicyAccepted=true, privacyPolicyAcceptedAt=now()
```

**UI:**
```tsx
// Full-screen overlay with:
// 1. Competition name
// 2. Link to Code of Conduct document
// 3. Checkbox: "I have read and accept the Code of Conduct"
// 4. Link to Privacy Policy document
// 5. Checkbox: "I have read and accept the Privacy Policy"
// 6. "Continue" button (disabled until both checked)
```

**Acceptance criteria:**
- [ ] Portal shows acceptance overlay before any content
- [ ] Both CoC and Privacy Policy must be accepted
- [ ] Acceptance persisted to CompetitionParticipation record
- [ ] Timestamps recorded (cocAcceptedAt, privacyPolicyAcceptedAt)
- [ ] Once accepted, not shown again for that competition

---

### P3.2 — QR Code Generation + Check-in

**What:** Each participant gets a personal QR code. Admins scan to check in.

**Files to create:**
- `src/modules/competitions/frontend/[orgSlug]/portal/qr/page.tsx` — displays personal QR code
- `src/modules/competitions/backend/competitions/checkin/page.tsx` — admin QR scanner
- `src/modules/competitions/api/portal/checkin/route.ts` — check-in API

**QR code generation:** Use a client-side QR library like `qrcode.react`:
```bash
yarn add qrcode.react
```

```tsx
// Portal QR page:
import { QRCodeSVG } from 'qrcode.react'

// QR value = JSON with participationId + userId + competitionId
const qrValue = JSON.stringify({
  participationId: participation.id,
  userId: auth.user.id,
  competitionId: selectedId,
})

<QRCodeSVG value={qrValue} size={300} level="H" />
```

**Check-in API:**
```typescript
// POST /api/competitions/portal/checkin
// Body: { participation_id }
// Sets checkedIn=true, checkedInAt=now()
// Emits competitions.participation.checked_in event
```

**Backend scanner page:**
- Camera-based QR scanner (use `html5-qrcode` library)
- Manual search by name/email
- Live check-in count display

**Acceptance criteria:**
- [ ] Participant sees QR code at `/portal/qr`
- [ ] QR code uses error correction level H
- [ ] Admin can scan QR at `/backend/competitions/checkin`
- [ ] Scanning marks participant as checked in
- [ ] Live counter shows checked-in / total

---

### P3.3 — CSV Bulk Import

**What:** Admin can upload a CSV file to bulk-register participants.

**Files to create:**
- `src/modules/competitions/api/import-participants/route.ts` — CSV upload endpoint
- `src/modules/competitions/backend/competitions/participants/import/page.tsx` — upload UI

**CSV format:**
```csv
email,name,role,organization
alice@example.com,Alice Smith,participant,Acme Corp
bob@example.com,Bob Jones,judge,University
```

**Implementation:**
1. Frontend: file upload with drag-and-drop
2. Client-side preview with validation errors highlighted
3. Submit to API endpoint
4. API parses CSV, creates CustomerUser invitations via `customer_accounts` module
5. Creates CompetitionParticipation records
6. Returns report: X created, Y errors

**Acceptance criteria:**
- [ ] CSV upload page accessible from participants list
- [ ] Preview shows parsed rows with error highlighting
- [ ] Bulk creates users and participations
- [ ] Error report downloadable

---

### P3.4 — Disqualify Button on Backend Teams Table

**What:** Admin should be able to disqualify a team directly from the teams list.

**File to modify:**
- `src/modules/teams/components/TeamsTable.tsx` — add disqualify row action

**Implementation:**
```tsx
// In RowActions items:
{
  label: 'Disqualify',
  destructive: true,
  onSelect: async () => {
    const reason = prompt('Disqualification reason:')
    if (!reason) return
    await apiCall('/api/teams/disqualify', {
      method: 'POST',
      body: JSON.stringify({ team_id: row.id, reason }),
    })
    flash('Team disqualified', 'success')
    queryClient.invalidateQueries({ queryKey: ['teams'] })
  },
}
```

Note: Replace `prompt()` with `useConfirmDialog` or a custom dialog (framework rule: never use `window.confirm` or `window.prompt`).

**Acceptance criteria:**
- [ ] "Disqualify" action in row actions dropdown
- [ ] Opens dialog to enter reason
- [ ] Calls disqualify API endpoint
- [ ] Team status badge updates to "Disqualified"

---

## Summary of All Portal API Endpoints Needed

| Endpoint | Method | Auth | Module | Purpose |
|----------|--------|------|--------|---------|
| `/api/teams/portal/create-team` | POST | Customer | teams | Create team + auto-add owner |
| `/api/teams/portal/my-invitations` | GET | Customer | teams | List pending invitations |
| `/api/teams/portal/respond-invitation` | POST | Customer | teams | Accept/decline invitation |
| `/api/teams/portal/request-join` | POST | Customer | teams | Create join request |
| `/api/teams/portal/select-track` | POST | Customer | teams | Select track for team |
| `/api/competitions/portal/update-participation` | PUT | Customer | competitions | Toggle looking-for-team |
| `/api/competitions/portal/looking-for-team` | GET | Customer | competitions | List participants looking |
| `/api/competitions/portal/participants` | GET | Customer | competitions | Participants directory |
| `/api/competitions/portal/accept-coc` | PUT | Customer | competitions | Accept Code of Conduct |
| `/api/competitions/portal/accept-privacy` | PUT | Customer | competitions | Accept Privacy Policy |
| `/api/competitions/portal/checkin` | POST | Staff | competitions | Check in participant |

All portal endpoints use `getCustomerAuthFromRequest` from `@open-mercato/core/modules/customer_accounts/lib/customerAuth` and verify participation before allowing actions.

---

## Implementation Order

```
Week 1: P1.1 → P1.2 → P1.3 (team formation core)
Week 2: P1.4 → P1.5 → P1.6 (track selection + looking for team)
Week 3: P2.1 → P2.2 → P2.3 (portal completeness)
Week 4: P3.1 → P3.2 → P3.3 → P3.4 (operations)
```

Each item can be implemented independently but P1.1 should come first as P1.2-P1.6 depend on the portal team API pattern it establishes.
