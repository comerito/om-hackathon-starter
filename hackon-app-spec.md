# HackOn App — Comprehensive Application Specification

## 1. Product Vision

HackOn App is a purpose-built hackathon management platform designed for on-site, time-boxed hackathon events. It handles the full lifecycle from participant onboarding through team formation, project development, stage presentations, judging, and results announcement. The platform serves four distinct user roles: **Participants**, **Mentors**, **Judges**, and **Admins**.

Unlike general-purpose platforms (Devpost, TAIKAI, Eventornado), HackOn App is opinionated about the on-site hackathon format — it enforces stage-based progression, supports physical check-in workflows, manages live demo presentations with timers and queues, and provides real-time event coordination for everyone in the same venue.

---

## 2. User Roles & Permissions

### 2.1 Role Definitions

| Role | Description | Created By |
|------|-------------|------------|
| **Admin** | Full platform control. Manages competitions, users, tracks, judging criteria, agenda, sponsors, prizes. Can impersonate any role for testing. | System (seeded) |
| **Participant** | Hackathon attendee. Can form/join teams, select tracks, submit projects, vote in People's Choice. | Admin (manual registration via backend panel) |
| **Mentor** | Domain expert available for consultation during the hacking phase. Can view all teams/projects in their assigned track(s), provide feedback. Cannot score. | Admin (manual registration) |
| **Judge** | Evaluates and scores published projects against defined criteria. Assigned to judge panels. Cannot be a team member. | Admin (manual registration) |

### 2.2 Auth & Registration Model

All users are **pre-registered by Admin** in the backend panel. There is no public self-registration. The flow:

1. Admin creates user account with: name, email, role, (optional) organization/company, (optional) bio/skills tags.
2. System sends an invitation email with a magic link or temporary credentials.
3. User activates account, sets password, completes profile (avatar, short bio, skills, social links).
4. **User must accept the Code of Conduct** before gaining access to competition features (team formation, check-in, etc.). Acceptance is recorded with timestamp.
5. On event day, user checks in via QR code or admin confirmation — changing their status from `registered` → `checked_in`.

---

## 3. Core Domain Objects

### 3.1 Competition

The top-level entity representing a single hackathon event.

```
Competition {
  id: UUID
  name: string                    // e.g. "HackOn: Agentic Software Engineering"
  slug: string                    // URL-friendly identifier
  description: text               // Rich text, markdown supported
  location: string                // Physical venue
  starts_at: datetime
  ends_at: datetime
  timezone: string                // e.g. "Europe/Warsaw"
  stage: CompetitionStage         // Current phase (see 3.1.1)
  
  // Configuration
  min_team_size: int              // Default: 2
  max_team_size: int              // Default: 5
  max_teams_per_track: int?       // Optional cap
  allow_track_change: boolean     // Can teams switch tracks after selection?
  project_submission_deadline: datetime
  judging_deadline: datetime
  
  // Stage Overlap Configuration
  stage_config: {
    allow_simultaneous_formation_and_track: boolean   // Teams can form and pick track at the same time
    allow_team_changes_during_hacking: boolean         // Grace period for swaps after hacking starts
    team_change_grace_period_minutes: int?             // e.g. 60 min into hacking
    allow_solo_participants: boolean                    // Below min_team_size exception
  }
  
  // Demo Presentation Configuration
  demo_config: {
    format: STAGE_PRESENTATION              // Stage presentation style
    presentation_duration_minutes: int      // Default: 3
    qa_duration_minutes: int                // Default: 2
    setup_buffer_minutes: int               // Default: 1 (transition between teams)
    finalists_per_track: int?               // If using two-round judging, how many advance
  }
  
  // Judging Configuration
  judging_config: {
    rounds: 1 | 2                           // Single round or preliminary + final
    preliminary_judges_per_project: int     // Default: 3 (for round 1)
    finalists_per_track: int                // Default: 3-5 (teams advancing to final round)
    final_round_format: STAGE_PRESENTATION  // Finals always on stage
  }
  
  // People's Choice Voting Configuration
  peer_voting_config: {
    enabled: boolean                        // Default: true
    votes_per_person: int                   // Default: 3
    voting_starts_at: datetime              // Typically during/after demos
    voting_ends_at: datetime
  }

  // Code of Conduct & Legal
  code_of_conduct_url: string               // Link to CoC document (REQUIRED)
  rules_url: string?                        // Link to Regulamin
  privacy_policy_url: string?
  
  // Relations
  tracks: Track[]
  teams: Team[]
  agenda_items: AgendaItem[]
  judge_panels: JudgePanel[]
  announcements: Announcement[]
  sponsors: Sponsor[]
  prizes: Prize[]
  incident_reports: IncidentReport[]
  
  // Metadata
  cover_image_url: string?
  created_at: datetime
  updated_at: datetime
}
```

#### 3.1.1 Competition Stages (State Machine)

```
┌──────────┐    ┌──────────┐    ┌─────────────────┐    ┌─────────────────┐
│  DRAFT   │───▶│   OPEN   │───▶│ TEAM_FORMATION   │───▶│ TRACK_SELECTION  │
└──────────┘    └──────────┘    └─────────────────┘    └─────────────────┘
                                                                 │
                                                       ┌────────▼────────┐
                                                       │    HACKING      │
                                                       └────────┬────────┘
                                                                │
┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────▼────────┐
│ ARCHIVED │◀───│ FINISHED │◀───│ DELIBERATION │◀───│      DEMOS        │
└──────────┘    └──────────┘    └──────────────┘    └───────────────────┘
```

| Stage | Description | Allowed Actions |
|-------|-------------|-----------------|
| `DRAFT` | Competition created but not visible to participants. Admin setup phase. | Admin: configure tracks, criteria, agenda, sponsors, prizes |
| `OPEN` | Visible to all registered users. Check-in is active. | Participants: check in, browse tracks, view agenda, accept CoC |
| `TEAM_FORMATION` | Participants can create/join teams. | Create team, invite members, accept/decline invites |
| `TRACK_SELECTION` | Teams must select their track. Can overlap with TEAM_FORMATION if configured. | Team leaders select a track for their team |
| `HACKING` | Active development phase. Projects are in draft. Team membership locked (with optional grace period). | Teams: create/edit project, disclose pre-existing code, request mentor help |
| `DEMOS` | **Live stage presentations.** Teams present sequentially to judges and audience. Submissions locked. | Teams: present on stage. Judges: take notes. Admin: manage presentation queue and timer. Participants: vote in People's Choice (if enabled). |
| `DELIBERATION` | **Judges finalize scores** after all presentations. Private scoring/discussion phase. | Judges: submit/update scores. Admin: monitor scoring progress, detect anomalies. |
| `FINISHED` | Results announced. Scores and prizes visible. | All: view results, leaderboard, prizes |
| `ARCHIVED` | Event concluded. Read-only historical record. | All: view archived data |

**Stage transition rules:**
- Only Admin can advance stages (manually or via scheduled triggers).
- `TEAM_FORMATION` and `TRACK_SELECTION` can overlap (configurable via `stage_config.allow_simultaneous_formation_and_track`).
- Moving to `HACKING` auto-locks team membership (unless `allow_team_changes_during_hacking` is true, in which case a grace period applies).
- Moving to `DEMOS` auto-sets all `DRAFT` projects to `PUBLISHED` status (or flags teams with no submission). Presentation queue is finalized.
- Moving to `DELIBERATION` closes People's Choice voting and locks the presentation queue.
- Moving to `FINISHED` calculates final scores (judge scores + optional People's Choice weighting), generates the leaderboard, and assigns prizes.

---

### 3.2 Track

A thematic category within a competition that teams choose to compete in.

```
Track {
  id: UUID
  competition_id: UUID            // FK → Competition
  name: string                    // e.g. "Agentic Flow", "Bounty Hunting", "Showcase"
  description: text               // What this track is about, expected outcomes
  color: string                   // Hex color for UI badges/tags
  icon_url: string?               // Optional icon/emoji
  
  // Constraints
  max_teams: int?                 // Optional cap on teams per track
  
  // Judging
  judging_criteria: JudgingCriterion[]  // Track-specific criteria
  judge_panel_id: UUID?           // FK → JudgePanel (assigned panel)
  
  // Relations
  teams: Team[]
  mentors: User[]                 // Mentors assigned to this track
  prizes: Prize[]                 // Prizes available for this track
  
  // Computed
  teams_count: int                // Current number of teams
  
  created_at: datetime
  updated_at: datetime
}
```

---

### 3.3 Team

A group of participants competing together in a specific competition and track.

```
Team {
  id: UUID
  competition_id: UUID            // FK → Competition
  track_id: UUID?                 // FK → Track (null until track is selected)
  
  name: string                    // Team display name
  description: text?              // Short team pitch / motto
  avatar_url: string?
  
  // Status
  status: TeamStatus              // ACTIVE | DISQUALIFIED | WITHDRAWN
  disqualification_reason: text?  // Reason if disqualified
  disqualified_at: datetime?
  disqualified_by: UUID?          // FK → User (admin who made the call)
  
  // Demo Presentation (assigned during DEMOS stage)
  presentation_order: int?        // Position in presentation queue
  presentation_time_slot: datetime? // Scheduled start time for their presentation
  is_finalist: boolean            // Advanced to final round (if two-round judging)
  
  // Table Assignment (for expo/setup area during event)
  table_number: int?              // Physical table number at venue
  table_location: string?         // "Hall A, Row 3" — descriptive location
  
  // Relations
  members: TeamMember[]
  project: Project?               // One project per team per competition
  invitations: TeamInvitation[]
  
  // Computed
  member_count: int
  is_full: boolean                // member_count >= competition.max_team_size
  
  created_at: datetime
  updated_at: datetime
}

enum TeamStatus {
  ACTIVE          // Normal operating status
  DISQUALIFIED    // Removed from competition (hidden from leaderboard, preserved in DB)
  WITHDRAWN       // Team voluntarily withdrew
}
```

**Business rules:**
- Disqualified teams' projects are hidden from the leaderboard but preserved in the database. Admin sees them with a strikethrough indicator.
- Disqualification reasons include: undisclosed code reuse, Code of Conduct violations, failure to submit, ineligible participants.
- Withdrawn teams can be reactivated by admin before `DEMOS` stage.

---

### 3.4 TeamMember

Join table connecting Users to Teams with role information.

```
TeamMember {
  id: UUID
  team_id: UUID                   // FK → Team
  user_id: UUID                   // FK → User
  role: TeamRole                  // OWNER | MEMBER
  joined_at: datetime
}

enum TeamRole {
  OWNER    // Team creator. Can invite, remove members, select track, manage project.
  MEMBER   // Regular team member. Can edit project.
}
```

**Business rules:**
- Each participant can belong to **exactly one team** per competition.
- A team must have **exactly one OWNER**.
- If the owner leaves, ownership transfers to the longest-standing member (or team is dissolved if only owner remains).
- Team size is enforced: `competition.min_team_size <= team.member_count <= competition.max_team_size`.
- Teams below `min_team_size` at stage `HACKING` receive a warning. Admin can grant exceptions (via `stage_config.allow_solo_participants`).

---

### 3.5 TeamInvitation

```
TeamInvitation {
  id: UUID
  team_id: UUID                   // FK → Team
  inviter_id: UUID                // FK → User (must be team OWNER)
  invitee_id: UUID                // FK → User (must be a Participant without a team)
  type: InvitationType            // INVITE | JOIN_REQUEST
  status: InvitationStatus        // PENDING | ACCEPTED | DECLINED | EXPIRED | CANCELLED
  message: string?                // Optional personal message
  created_at: datetime
  responded_at: datetime?
  expires_at: datetime            // Auto-expire after configurable window (e.g. 2 hours)
}
```

**Business rules:**
- Only OWNER can send invitations (type: INVITE).
- Any teamless participant can send a join request (type: JOIN_REQUEST) to any non-full team.
- Cannot invite users who already belong to a team in the same competition.
- Cannot invite if team is already full.
- Invitations expire automatically if not responded to within the window.

---

### 3.6 Project

The deliverable a team produces during the hackathon.

```
Project {
  id: UUID
  team_id: UUID                   // FK → Team (one-to-one)
  competition_id: UUID            // FK → Competition
  track_id: UUID                  // FK → Track (inherited from team)
  
  // Content
  title: string
  tagline: string                 // One-liner pitch (max 140 chars)
  description: text               // Rich text / markdown — full project description
  problem_statement: text?        // What problem does this solve?
  solution: text?                 // How does the project solve it?
  tech_stack: string[]            // Tags: ["Next.js", "Claude API", "PostgreSQL"]
  
  // Media
  demo_url: string?               // Live demo link
  repo_url: string?               // GitHub/GitLab repository
  video_url: string?              // Demo video (YouTube/Loom)
  presentation_url: string?       // Slides link
  screenshots: ProjectImage[]     // Uploaded images
  attachments: ProjectAttachment[] // PDFs, docs, etc.
  
  // Originality Disclosure
  uses_preexisting_code: boolean              // REQUIRED disclosure flag
  preexisting_code_description: text?         // What was reused and how (required if above is true)
  built_during_hackathon_description: text?   // What is NEW work done during the hackathon
  flagged_for_reuse: boolean                  // Admin flag if undisclosed reuse is found
  flagged_by: UUID?                           // FK → User (admin)
  flagged_at: datetime?
  flagged_reason: text?                       // Admin notes on why it was flagged
  
  // Status
  status: ProjectStatus
  submitted_at: datetime?         // When status changed to PUBLISHED
  
  // Scoring (populated during/after judging)
  scores: ProjectScore[]
  final_score: float?             // Computed weighted average of judge scores
  peer_vote_count: int?           // People's Choice vote tally
  rank: int?                      // Position in track leaderboard
  
  // Prize Relations
  prizes: Prize[]                 // Prizes awarded to this project
  
  created_at: datetime
  updated_at: datetime
}

enum ProjectStatus {
  DRAFT           // Work in progress. Only team members can see.
  PUBLISHED       // Submitted for judging. Locked for edits (or limited edits).
  UNDER_REVIEW    // Currently being evaluated by judges (during DEMOS/DELIBERATION).
  SCORED          // All assigned judges have submitted scores.
}
```

**Business rules:**
- One project per team per competition.
- Project is auto-created in `DRAFT` when team enters `HACKING` stage (or team can create manually).
- `DRAFT` → `PUBLISHED`: team submits before deadline. All required fields must be filled. `uses_preexisting_code` must be answered. If true, `preexisting_code_description` is required.
- `PUBLISHED` → `UNDER_REVIEW`: automatic when `DEMOS` stage begins.
- Once `PUBLISHED`, the project content is locked (no edits). Admin can grant edit exceptions.
- `SCORED` is set when all judges in the assigned panel have submitted their scores.
- Projects flagged for undisclosed reuse (`flagged_for_reuse: true`) display a warning badge visible to judges and admin. Admin can disqualify the team based on this.
- Note: `WINNER` status removed — winning is now represented by the Prize relation (a project can win multiple prizes).

---

### 3.7 JudgePanel

A group of judges assigned to evaluate projects in specific track(s).

```
JudgePanel {
  id: UUID
  competition_id: UUID            // FK → Competition
  name: string                    // e.g. "Agentic Flow Judges"
  round: PRELIMINARY | FINAL      // Which judging round this panel serves
  
  // Relations
  judges: User[]                  // Users with role JUDGE
  tracks: Track[]                 // Tracks this panel evaluates
  
  created_at: datetime
}
```

**Business rules:**
- A judge can belong to multiple panels (cross-track evaluation, or serve in both rounds).
- Each track must have at least one panel assigned before `DEMOS` stage.
- For two-round judging: `PRELIMINARY` panels score all projects; `FINAL` panels score only finalists.
- Admin configures whether all judges see all projects in the track, or if projects are distributed evenly among judges.

---

### 3.8 JudgingCriterion

Defines what judges evaluate projects on.

```
JudgingCriterion {
  id: UUID
  track_id: UUID?                 // FK → Track (null = applies to all tracks)
  competition_id: UUID            // FK → Competition
  round: PRELIMINARY | FINAL | BOTH  // Which round(s) this criterion is used in
  
  name: string                    // e.g. "Innovation", "Technical Execution", "Presentation"
  description: text               // What this criterion means
  max_score: int                  // e.g. 10
  weight: float                   // Relative weight for final score calculation (e.g. 0.3 = 30%)
  order: int                      // Display order
  
  created_at: datetime
}
```

**Default criteria set (suggested):**
1. **Innovation & Creativity** (weight: 0.25, round: BOTH) — How original and creative is the solution?
2. **Technical Execution** (weight: 0.25, round: BOTH) — Code quality, architecture, completeness.
3. **Business Value / Impact** (weight: 0.20, round: BOTH) — Real-world applicability, market potential.
4. **Presentation & Demo** (weight: 0.15, round: BOTH) — Clarity of pitch, quality of demo.
5. **Use of Track Theme** (weight: 0.15, round: BOTH) — How well does the project align with the chosen track?

---

### 3.9 ProjectScore

An individual judge's evaluation of a project.

```
ProjectScore {
  id: UUID
  project_id: UUID                // FK → Project
  judge_id: UUID                  // FK → User (role: JUDGE)
  judge_panel_id: UUID            // FK → JudgePanel
  round: PRELIMINARY | FINAL      // Which judging round this score belongs to
  
  // Scores per criterion
  criterion_scores: CriterionScore[]
  
  total_score: float              // Computed: sum of weighted criterion scores
  comment: text?                  // Optional written feedback (visible to team after results)
  private_notes: text?            // Notes visible only to admin and the judge
  
  submitted_at: datetime
  updated_at: datetime?           // Judges can update until deliberation stage ends
}

CriterionScore {
  criterion_id: UUID              // FK → JudgingCriterion
  score: int                      // 0 to criterion.max_score
  note: string?                   // Optional per-criterion comment
}
```

**Business rules:**
- Each judge scores each assigned project exactly once per round (can update until deliberation closes).
- **Preliminary round:** Final project score = average of all judges' total_scores. Top N per track advance to finals.
- **Final round:** Final project score = weighted combination of preliminary score + final round score (weights configurable by admin).
- Admin can see all individual scores. Teams only see aggregated results after `FINISHED` stage.
- Optional: judges can flag a project for "conflict of interest" and recuse themselves.

---

### 3.10 DemoSession

Manages the stage presentation queue and timing during the DEMOS stage.

```
DemoSession {
  id: UUID
  competition_id: UUID            // FK → Competition
  team_id: UUID                   // FK → Team
  track_id: UUID                  // FK → Track
  
  // Scheduling
  presentation_order: int         // Global order in the presentation queue
  scheduled_start: datetime       // Computed from order, duration, and buffer
  
  // Timing
  presentation_duration_minutes: int   // From competition.demo_config (default: 3)
  qa_duration_minutes: int             // From competition.demo_config (default: 2)
  
  // Status
  status: DemoStatus              // QUEUED | ON_DECK | PRESENTING | QA | COMPLETED | SKIPPED
  actual_start: datetime?         // When presentation actually started
  actual_end: datetime?           // When presentation actually ended
  
  // Round context
  round: PRELIMINARY | FINAL      // Which judging round this demo belongs to
  
  created_at: datetime
}

enum DemoStatus {
  QUEUED        // Waiting in line
  ON_DECK       // Next up (preparing to take the stage)
  PRESENTING    // Currently presenting (timer running)
  QA            // Q&A period with judges (timer running)
  COMPLETED     // Finished presenting
  SKIPPED       // Team did not present (no-show, disqualified, etc.)
}
```

**Business rules:**
- Admin sets the presentation order (can be randomized, sorted by track, or manually arranged).
- The app displays a **live presentation timer** visible to the presenting team, judges, and audience on a shared screen/projector.
- When the timer expires, a visual/audio cue signals the team to wrap up.
- `ON_DECK` status auto-sets for the next team when the current team enters `QA` status.
- If two-round judging is configured, a second set of DemoSessions is created for finalists only.
- Total event time calculation: `(presentation_duration + qa_duration + setup_buffer) × number_of_teams`.

---

### 3.11 PeerVote

People's Choice voting by participants.

```
PeerVote {
  id: UUID
  competition_id: UUID            // FK → Competition
  voter_id: UUID                  // FK → User (must be a checked-in Participant)
  project_id: UUID                // FK → Project
  created_at: datetime
}
```

**Business rules:**
- Each participant gets `competition.peer_voting_config.votes_per_person` votes (default: 3).
- A participant **cannot vote for their own team's project**.
- Voting is open during the window defined by `peer_voting_config.voting_starts_at` and `voting_ends_at` (typically during or right after DEMOS stage).
- Votes cannot be changed once cast (or configurable: allow changing until window closes).
- People's Choice results can feed into a dedicated Prize (category: `PEOPLES_CHOICE`) or serve as an independent award.
- Mentors and Judges do not participate in People's Choice voting.

---

### 3.12 Prize

Structured awards and prizes for the competition.

```
Prize {
  id: UUID
  competition_id: UUID            // FK → Competition
  
  name: string                    // "1st Place - Agentic Flow", "Best Technical Solution"
  description: text?              // What this prize recognizes
  category: PrizeCategory
  
  track_id: UUID?                 // FK → Track (null for cross-track prizes)
  sponsor_id: UUID?               // FK → Sponsor (if sponsor-backed)
  
  value: string?                  // "5000 PLN", "Claude API Credits", "Mentorship package"
  rank: int?                      // 1st, 2nd, 3rd for placement prizes (null for special awards)
  icon_url: string?               // Trophy/medal icon
  
  // Awarded to (set by admin after judging)
  winning_project_id: UUID?       // FK → Project
  winning_team_id: UUID?          // FK → Team
  awarded_at: datetime?
  awarded_by: UUID?               // FK → User (admin)
  
  created_at: datetime
}

enum PrizeCategory {
  TRACK_PLACEMENT     // 1st, 2nd, 3rd within a track
  SPECIAL_AWARD       // "Best Technical", "Best Design", "Most Innovative"
  SPONSOR_PRIZE       // Sponsored by a partner ("Best use of Autopay API")
  PEOPLES_CHOICE      // Winner of peer voting
}
```

**Business rules:**
- A project can win multiple prizes (e.g., 1st in track + Best Technical + People's Choice).
- `TRACK_PLACEMENT` prizes require a `track_id` and `rank`.
- `SPONSOR_PRIZE` requires a `sponsor_id`.
- `PEOPLES_CHOICE` is auto-assigned to the project with the most peer votes (admin confirms).
- Admin assigns all prizes during `DELIBERATION` or `FINISHED` stage. Assignment is logged in the ActivityLog.

---

### 3.13 Sponsor

Partners and sponsors of the competition.

```
Sponsor {
  id: UUID
  competition_id: UUID            // FK → Competition
  
  name: string                    // "Autopay S.A."
  tier: SponsorTier               // TITLE | GOLD | SILVER | PARTNER | IN_KIND
  logo_url: string
  website_url: string?
  description: text?              // What they do, why they're involved
  
  // Sponsor challenge (optional)
  challenge_title: string?        // "Best use of Autopay API"
  challenge_description: text?    // Detailed challenge brief
  challenge_resources_url: string? // Link to API docs, datasets, etc.
  
  // Contact
  contact_name: string?
  contact_email: string?
  
  // Display
  order: int                      // Sort order within tier
  is_visible: boolean             // Show on public-facing pages
  
  // Relations
  prizes: Prize[]                 // Sponsor-backed prizes
  
  created_at: datetime
}

enum SponsorTier {
  TITLE       // Headline sponsor (e.g. "HackOn by Autopay")
  GOLD        // Major sponsor
  SILVER      // Supporting sponsor  
  PARTNER     // Technology/community partner
  IN_KIND     // Provides non-cash support (venue, food, swag)
}
```

---

### 3.14 IncidentReport

Code of Conduct incident reporting.

```
IncidentReport {
  id: UUID
  competition_id: UUID            // FK → Competition
  reporter_id: UUID?              // FK → User (optional — anonymous reports allowed)
  reported_user_id: UUID?         // FK → User (the person reported, if applicable)
  
  description: text               // What happened
  severity: IncidentSeverity      // LOW | MEDIUM | HIGH | CRITICAL
  status: IncidentStatus          // REPORTED | UNDER_REVIEW | RESOLVED | DISMISSED
  
  // Admin handling
  admin_notes: text?              // Internal notes on investigation/resolution
  resolved_by: UUID?              // FK → User (admin who resolved)
  resolution_description: text?   // How it was resolved
  
  created_at: datetime
  resolved_at: datetime?
}

enum IncidentSeverity {
  LOW         // Minor issue, verbal warning
  MEDIUM      // Requires attention, formal warning
  HIGH        // Serious violation, potential removal
  CRITICAL    // Immediate safety concern, requires instant action
}
```

**Business rules:**
- Any user can file an incident report from any screen via a persistent "Report Incident" button.
- Anonymous reports are allowed (reporter_id is null).
- Admin receives an immediate in-app notification for HIGH and CRITICAL severity reports.
- Resolution can trigger team disqualification (links to Team.status = DISQUALIFIED).

---

### 3.15 AgendaItem

Scheduled events within a competition.

```
AgendaItem {
  id: UUID
  competition_id: UUID            // FK → Competition
  
  title: string                   // e.g. "Opening Ceremony", "Lunch Break", "Demo Presentations"
  description: text?
  type: AgendaItemType            // CEREMONY, TALK, WORKSHOP, BREAK, MEAL, DEADLINE, DEMO_SESSION, CUSTOM
  
  starts_at: datetime
  ends_at: datetime
  location: string?               // Room/area within venue
  
  // Optional relations
  speaker_name: string?           // For talks/workshops
  speaker_bio: string?
  track_id: UUID?                 // If track-specific (e.g. track-specific workshop)
  
  is_mandatory: boolean           // Highlight as required attendance
  
  order: int                      // Sort order within same time slot
  created_at: datetime
}
```

---

### 3.16 Announcement

Real-time communications from admins/organizers.

```
Announcement {
  id: UUID
  competition_id: UUID            // FK → Competition
  author_id: UUID                 // FK → User (admin)
  
  title: string
  content: text                   // Markdown supported
  priority: AnnouncementPriority  // INFO | WARNING | URGENT
  
  // Targeting
  target_roles: UserRole[]        // Which roles see this (empty = all)
  target_track_ids: UUID[]        // Which tracks (empty = all)
  
  pinned: boolean                 // Stays at top of announcements feed
  
  published_at: datetime
  created_at: datetime
}
```

---

### 3.17 User

```
User {
  id: UUID
  email: string                   // Unique
  password_hash: string
  
  // Profile
  first_name: string
  last_name: string
  display_name: string            // How they appear in the app
  avatar_url: string?
  bio: text?                      // Short bio
  organization: string?           // Company/university
  skills: string[]                // Tags: ["TypeScript", "AI/ML", "Design"]
  social_links: {                 // Optional
    github?: string
    linkedin?: string
    twitter?: string
    website?: string
  }
  
  // System
  role: UserRole                  // ADMIN | PARTICIPANT | MENTOR | JUDGE
  status: UserStatus              // INVITED | ACTIVE | CHECKED_IN | DEACTIVATED
  
  // Competition context
  competition_participations: CompetitionParticipation[]
  
  created_at: datetime
  updated_at: datetime
  last_login_at: datetime?
}

CompetitionParticipation {
  user_id: UUID
  competition_id: UUID
  role: UserRole                  // Role in this specific competition
  checked_in: boolean
  checked_in_at: datetime?
  badge_printed: boolean          // For on-site badge printing flow
  
  // Code of Conduct
  coc_accepted: boolean           // MUST be true before accessing competition features
  coc_accepted_at: datetime?
}
```

---

### 3.18 MentorSession (Optional but Recommended)

```
MentorSession {
  id: UUID
  competition_id: UUID
  mentor_id: UUID                 // FK → User (role: MENTOR)
  team_id: UUID                   // FK → Team
  
  topic: string                   // What the team needs help with
  status: SessionStatus           // REQUESTED | ACCEPTED | COMPLETED | CANCELLED
  
  requested_at: datetime
  scheduled_at: datetime?
  completed_at: datetime?
  
  mentor_notes: text?             // Mentor's notes (private)
  team_rating: int?               // 1-5 how helpful was the session
}
```

---

### 3.19 ActivityLog

Audit trail for all significant actions in the competition.

```
ActivityLog {
  id: UUID
  competition_id: UUID            // FK → Competition
  actor_id: UUID                  // FK → User (who performed the action)
  
  action: string                  // Dot-notation action identifier (see list below)
  target_type: string             // Entity type: "Team", "Project", "Competition", etc.
  target_id: UUID                 // FK → the affected entity
  
  metadata: JSON                  // Action-specific data (old/new values, context)
  
  created_at: datetime
}
```

**Key events to log:**

| Action | Target | Description |
|--------|--------|-------------|
| `competition.stage_advanced` | Competition | Stage changed from X to Y |
| `team.created` | Team | New team created |
| `team.member_joined` | Team | Member accepted invitation or join request |
| `team.member_left` | Team | Member left or was removed |
| `team.disqualified` | Team | Admin disqualified a team |
| `team.track_selected` | Team | Team chose a track |
| `project.submitted` | Project | Project status changed to PUBLISHED |
| `project.flagged_reuse` | Project | Admin flagged undisclosed code reuse |
| `score.submitted` | ProjectScore | Judge submitted a score |
| `score.updated` | ProjectScore | Judge updated an existing score |
| `score.deleted` | ProjectScore | Admin removed an outlier score |
| `prize.awarded` | Prize | Admin assigned a prize to a project |
| `demo.status_changed` | DemoSession | Presentation status changed (started, completed, skipped) |
| `incident.reported` | IncidentReport | New incident report filed |
| `incident.resolved` | IncidentReport | Incident report resolved |
| `admin.deadline_extended` | Competition | Submission deadline changed |
| `admin.override` | * | Any admin override action (with details in metadata) |

**Business rules:**
- ActivityLog is append-only. Entries cannot be edited or deleted.
- Admin can view the full log filtered by action type, target, actor, or time range.
- Metadata stores before/after values for change tracking (e.g., `{ "old_stage": "HACKING", "new_stage": "DEMOS" }`).
- Critical for dispute resolution: "I submitted before the deadline!" can be verified via `project.submitted` timestamp.

---

## 4. Entity Relationship Summary

```
Competition (1) ──── (N) Track
Competition (1) ──── (N) Team
Competition (1) ──── (N) AgendaItem
Competition (1) ──── (N) Announcement
Competition (1) ──── (N) JudgePanel
Competition (1) ──── (N) JudgingCriterion
Competition (1) ──── (N) Sponsor
Competition (1) ──── (N) Prize
Competition (1) ──── (N) DemoSession
Competition (1) ──── (N) PeerVote
Competition (1) ──── (N) IncidentReport
Competition (1) ──── (N) ActivityLog

Track (1) ──── (N) Team
Track (1) ──── (N) JudgingCriterion     // Track-specific criteria
Track (N) ──── (N) JudgePanel           // Many-to-many
Track (N) ──── (N) User[Mentor]         // Mentors assigned to tracks
Track (1) ──── (N) Prize               // Track-specific prizes

Team (1) ──── (N) TeamMember
Team (1) ──── (1) Project               // Exactly one project per team
Team (1) ──── (N) TeamInvitation
Team (1) ──── (N) MentorSession
Team (1) ──── (N) DemoSession           // One per judging round

TeamMember (N) ──── (1) User
TeamInvitation (N) ──── (1) User[invitee]

Project (1) ──── (N) ProjectScore
Project (1) ──── (N) ProjectImage
Project (1) ──── (N) ProjectAttachment
Project (1) ──── (N) PeerVote           // Votes received
Project (N) ──── (N) Prize              // Prizes won

ProjectScore (N) ──── (1) User[Judge]
ProjectScore (1) ──── (N) CriterionScore
CriterionScore (N) ──── (1) JudgingCriterion

JudgePanel (N) ──── (N) User[Judge]
JudgePanel (N) ──── (N) Track

Sponsor (1) ──── (N) Prize              // Sponsor-backed prizes

User (1) ──── (N) CompetitionParticipation
User (1) ──── (N) PeerVote[voter]
```

---

## 5. User Flows & User Stories

### 5.1 Admin: Competition Setup

**As an Admin, I want to create and configure a competition so that all aspects of the hackathon are prepared before participants arrive.**

#### Flow:
1. **Create Competition** → Set name, dates, location, description, cover image.
2. **Upload Code of Conduct** → Set `code_of_conduct_url` (required before publishing).
3. **Define Tracks** → Add 1–N tracks with names, descriptions, colors, optional team caps.
4. **Set Judging Criteria** → Define global criteria and/or per-track criteria with weights. Configure one-round or two-round judging.
5. **Build Agenda** → Add scheduled items (talks, workshops, meals, deadlines, demo sessions) with times and locations.
6. **Register Users** → Bulk import or individual creation of Participants, Mentors, Judges.
7. **Create Judge Panels** → Assign judges to panels (preliminary and/or final), assign panels to tracks.
8. **Assign Mentors to Tracks** → Each mentor gets 1+ track assignments.
9. **Add Sponsors** → Create sponsor entries with logos, tiers, optional challenges.
10. **Define Prizes** → Create prize entries per track (1st/2nd/3rd), special awards, sponsor prizes, People's Choice.
11. **Configure Rules** → Set min/max team sizes, submission deadline, track-change policy, stage overlap config, demo presentation config, peer voting window.
12. **Preview & Publish** → Move competition from `DRAFT` → `OPEN`.

#### Sub-stories:
- As an Admin, I want to **bulk import users via CSV** (columns: name, email, role, organization) so that I can onboard 100+ participants efficiently.
- As an Admin, I want to **re-send invitation emails** to users who haven't activated.
- As an Admin, I want to **clone a previous competition** as a template for a new event.
- As an Admin, I want a **real-time dashboard** showing: checked-in count, teams formed, teams without tracks, projects submitted, demo progress, judging progress, People's Choice votes cast.

---

### 5.2 Participant: Pre-Event Onboarding

**As a Participant, I want to set up my profile before the event so that teammates can find me.**

#### Flow:
1. Receive invitation email from Admin.
2. Click activation link → set password.
3. Complete profile: avatar, bio, skills/interests, organization, social links.
4. **Read and accept Code of Conduct** (checkbox + timestamp recorded). Cannot proceed without acceptance.
5. Browse competition details: agenda, tracks, rules, sponsors, prizes.
6. (Optional) Browse other participants' profiles to identify potential teammates.

#### Stories:
- As a Participant, I want to see **other participants' skills and interests** so I can find complementary teammates.
- As a Participant, I want to **mark myself as "looking for team"** with a short description of what I bring and what I'm looking for.
- As a Participant, I want to **view the agenda** so I know what to expect on event day.
- As a Participant, I want to **see available prizes and sponsor challenges** so I can plan my approach.

---

### 5.3 Participant: Event Day Check-In

**As a Participant, I want to check in at the venue so that organizers know I've arrived and I can access event features.**

#### Flow:
1. Arrive at venue.
2. Approach registration desk.
3. Admin scans QR code from participant's app (or participant shows the code).
4. System verifies **CoC has been accepted**. If not, prompts acceptance before completing check-in.
5. System updates status: `ACTIVE` → `CHECKED_IN`.
6. Participant receives welcome notification with day-of info, Wi-Fi credentials, table assignments (if applicable), etc.
7. (Optional) Badge is generated/printed with participant's name, role, and QR code.

#### Stories:
- As a Participant, I want to **see my personal QR code** in the app for quick check-in.
- As an Admin, I want to **scan QR codes** to check participants in and see who's arrived in real-time.
- As an Admin, I want to **view a check-in list** showing who has/hasn't arrived, with ability to manually check in.

---

### 5.4 Participant: Team Formation

**As a Participant, I want to form or join a team so that I can compete in the hackathon.**

#### Flow (Team Creator):
1. Competition enters `TEAM_FORMATION` stage.
2. Participant clicks "Create Team" → enters team name, optional description.
3. Becomes OWNER of the new team.
4. Browses participant directory (filtered by "looking for team", skills, etc.).
5. Sends team invitations to desired members.
6. Waits for invitations to be accepted/declined.
7. Team roster fills up (within min/max constraints).

#### Flow (Team Joiner):
1. Browses existing teams (sees: name, description, current members, skills represented).
2. Option A: Receives invitation notification → accepts or declines.
3. Option B: Sends "Join Request" to a team they're interested in → OWNER approves/rejects.
4. Once accepted, joins team roster.

#### Stories:
- As a Team Owner, I want to **invite specific participants** to my team by browsing their profiles.
- As a Participant, I want to **see all open teams** with their current composition and remaining spots.
- As a Participant, I want to **send a join request** to a team I'm interested in, with a short message about why.
- As a Team Owner, I want to **manage pending invitations and join requests** from a single screen.
- As a Team Owner, I want to **remove a member** before the hacking stage begins (with confirmation).
- As a Participant, I want to **leave my team** if I change my mind (before hacking starts).
- As an Admin, I want to see **unmatched participants** (those without a team) and manually assign them or create teams.
- As an Admin, I want to **dissolve or disqualify a team** if needed (e.g., conflicts, rule violations).

---

### 5.5 Team: Track Selection

**As a Team Owner, I want to select a track for my team so we know what theme to build around.**

#### Flow:
1. Competition enters `TRACK_SELECTION` stage (or concurrent with team formation if `stage_config.allow_simultaneous_formation_and_track` is true).
2. Team Owner views available tracks with descriptions, current team counts, and associated sponsor challenges.
3. Team Owner selects a track → confirmation prompt.
4. Track is assigned to the team. All members receive notification.
5. If `allow_track_change` is enabled, owner can switch before `HACKING` stage.

#### Stories:
- As a Team Owner, I want to **see track details, how many teams** have chosen each one, and what **prizes and sponsor challenges** are available per track.
- As a Team Member, I want to **see which track my team selected** and understand what it means.
- As an Admin, I want to **see track distribution** (how many teams per track) to ensure balanced participation.
- As an Admin, I want to **close a track** when it reaches its team cap.

---

### 5.6 Team: Hacking Phase & Project Submission

**As a Team Member, I want to build and document my project during the hackathon.**

#### Flow:
1. Competition enters `HACKING` stage. Team memberships are locked (unless grace period is configured).
2. A blank `DRAFT` project is auto-created for each team (or team can create it).
3. Team members collaboratively fill in project details:
   - Title, tagline, problem statement, solution description.
   - Tech stack tags.
   - Demo URL, repo URL, video URL, slides link.
   - Upload screenshots and attachments.
   - **Answer originality disclosure:** "Does this project use pre-existing code?" If yes, describe what was reused and what is new.
4. Team Owner reviews the project and clicks "Submit" before the deadline.
5. Project status changes: `DRAFT` → `PUBLISHED`.
6. Confirmation notification sent to all team members.

#### Stories:
- As a Team Member, I want to **edit the project description** collaboratively (all members can edit, last-write-wins or real-time collab).
- As a Team Member, I want to **upload screenshots** of our project to showcase it visually.
- As a Team Member, I want to **disclose any pre-existing code** we used, describing what's new and what's reused.
- As a Team Owner, I want to **preview how our project will look** to judges before submitting.
- As a Team Member, I want to **see a countdown timer** to the submission deadline.
- As a Team Owner, I want to **submit our project** and receive confirmation that it was submitted on time.
- As an Admin, I want to **see submission progress** (how many teams have submitted vs. total).
- As an Admin, I want to **extend the deadline** for all teams if needed.
- As an Admin, I want to **grant a specific team** a late submission exception.
- As an Admin, I want to **flag a project for undisclosed code reuse** if I suspect originality issues.

---

### 5.7 Mentor: Providing Guidance

**As a Mentor, I want to support teams in my assigned track(s) during the hacking phase.**

#### Flow:
1. Mentor logs in, sees assigned track(s) and teams within them.
2. Can browse all teams' project drafts in their track.
3. Team requests mentoring session (via in-app request with topic description).
4. Mentor sees request, accepts, and connects with the team (in-person or via chat).
5. After session, mentor can log notes and mark session as completed.

#### Stories:
- As a Mentor, I want to **see all teams in my track** with their project status and tech stack.
- As a Mentor, I want to **receive notifications** when a team requests help.
- As a Mentor, I want to **log session notes** for my own records.
- As a Team, I want to **request a mentor session** describing what we need help with.
- As a Team, I want to **rate the mentoring session** afterwards (feedback for organizers).

---

### 5.8 Demo Presentations (Stage Format)

**As a team, I want to present my project on stage so that judges and the audience can see what we built.**

#### Flow:
1. Competition enters `DEMOS` stage. All published projects are visible. Submissions are locked.
2. Admin has configured the presentation queue (order of teams presenting). Teams can see their position.
3. The app displays a **live presentation board** showing: current team on stage, next team on deck, and the full queue.
4. When it's a team's turn:
   a. Status changes to `ON_DECK` → team prepares to take the stage.
   b. Status changes to `PRESENTING` → **countdown timer starts** (e.g., 3 minutes). Timer is visible to the team, judges, and audience on a shared screen/projector.
   c. Timer expires → visual/audio cue. Status changes to `QA` → **Q&A timer starts** (e.g., 2 minutes). Judges ask questions.
   d. Q&A timer expires → status changes to `COMPLETED`. Next team is called.
5. If a team is absent or skips, admin marks them as `SKIPPED`.
6. After all presentations, People's Choice voting opens (if enabled).
7. Admin advances to `DELIBERATION` stage.

#### Stories:
- As a Participant, I want to **see the presentation queue** and know when my team presents so I can prepare.
- As a Participant, I want to **see a live timer** during my presentation so I manage my time.
- As a Judge, I want to **see which team is presenting** and have their project details pulled up automatically.
- As a Judge, I want to **take notes during the presentation** that feed into my score card.
- As an Audience Member, I want to **see the timer and current presenter** on a projected display or my phone.
- As an Admin, I want to **control the presentation flow**: start/pause timer, skip a team, reorder the queue.
- As an Admin, I want to **project the presentation board** on a venue screen (full-screen kiosk mode).
- As a Participant, I want to **vote for my favorite projects** (People's Choice) during or after the demo session.

---

### 5.9 People's Choice Voting

**As a Participant, I want to vote for projects I think are the best so there's a community-driven award.**

#### Flow:
1. Voting window opens (configured in `peer_voting_config`, typically during/after DEMOS).
2. Participant opens the voting screen → sees all published projects (excluding their own team's).
3. Participant selects up to N projects (default: 3) and confirms votes.
4. Vote tally is tracked in real-time (visible only to admin until results are published).
5. Voting window closes (automatically at `voting_ends_at` or manually by admin).
6. The project with the most votes receives the People's Choice prize.

#### Stories:
- As a Participant, I want to **browse all projects and vote** for my favorites (max 3 votes).
- As a Participant, I want to **see which projects I've already voted for** and how many votes I have left.
- As an Admin, I want to **see the live vote tally** during the voting window.
- As an Admin, I want to **close voting** and see the final results before announcing.

---

### 5.10 Judge: Evaluating Projects

**As a Judge, I want to fairly evaluate submitted projects against defined criteria.**

#### Flow (Two-Round):

**Preliminary Round (during/after DEMOS):**
1. Judge opens their judging dashboard → sees list of all projects assigned to them for the preliminary round.
2. Judge watches stage presentations and reviews project submissions (description, demo, video, screenshots, repo).
3. Judge notes the originality disclosure — projects with `flagged_for_reuse` display a warning badge.
4. Judge scores each criterion (0 to max_score) and adds optional comments.
5. Judge submits the score card. Can update until deliberation ends.
6. Judging dashboard shows progress: scored vs. remaining.

**Final Round (for finalists only):**
7. After all preliminary scores are in, admin reviews and selects the top N finalists per track (informed by preliminary scores).
8. Finalists present again in a final stage presentation round (shorter queue, potentially longer time slots).
9. Final-round judges (same panel or a different one) score the finalists with the same or different criteria.
10. Final score = weighted combination of preliminary + final round scores.

#### Stories:
- As a Judge, I want to **see all projects assigned to me** with clear progress tracking (scored/unscored).
- As a Judge, I want to **view the full project submission** including demo, video, and screenshots on one page.
- As a Judge, I want to **see the originality disclosure** and any reuse flags before scoring.
- As a Judge, I want to **score each criterion independently** with a slider or number input.
- As a Judge, I want to **leave written feedback** for the team that will be visible after results.
- As a Judge, I want to **add private notes** visible only to me and admins.
- As a Judge, I want to **flag a conflict of interest** and recuse myself from a project.
- As a Judge, I want to **save a partial score** and come back to finish later.
- As an Admin, I want to **see judging progress** per judge and per project (who hasn't submitted yet).
- As an Admin, I want to **nudge judges** who haven't completed their scoring via notification.
- As an Admin, I want to **select finalists** for the final round based on preliminary scores.

---

### 5.11 Admin: Results, Prizes & Closing

**As an Admin, I want to finalize results, assign prizes, and announce winners.**

#### Flow:
1. All judges complete scoring (or admin forces close with partial scores).
2. Admin reviews the **score summary dashboard**:
   - Per-track leaderboard with final weighted scores.
   - People's Choice vote tally.
   - Score distribution / anomaly detection (one judge scoring dramatically different).
   - Individual judge score breakdowns.
3. Admin can adjust: remove an outlier score, change a criterion weight, override a ranking.
4. Admin **assigns prizes**: selects winning project/team for each Prize in the system.
   - Track placements (1st/2nd/3rd) are auto-suggested based on scores.
   - Special awards and sponsor prizes are assigned manually.
   - People's Choice is auto-suggested based on vote count.
5. Admin reviews all prize assignments and confirms.
6. Admin advances to `FINISHED` stage.
7. Leaderboard, prizes, and results become visible to all participants simultaneously.
8. Teams can view their aggregated scores, judge feedback, and any prizes won.

#### Stories:
- As an Admin, I want to **see a leaderboard per track** with automatic ranking based on weighted scores.
- As an Admin, I want to **see People's Choice results** alongside judge scores.
- As an Admin, I want to **detect scoring anomalies** (e.g., a judge giving all 10s or all 1s).
- As an Admin, I want to **assign prizes** to winning projects from a unified prize management screen.
- As an Admin, I want to **publish results** and have all participants notified simultaneously.
- As an Admin, I want to **view the full audit log** of all scoring and prize assignment actions.
- As a Participant, I want to **see my team's final ranking**, how we scored on each criterion, and any prizes won.
- As a Participant, I want to **read judge feedback** on our project.
- As a Participant, I want to **see all winning projects** and prizes across all tracks.

---

### 5.12 Cross-Cutting: Real-Time Event Experience

**Stories that span the entire event:**

- As any User, I want to **receive real-time announcements** from organizers (push notifications + in-app feed).
- As any User, I want to **see the current competition stage** and what's expected of me right now.
- As any User, I want to **view the live agenda** with "happening now" indicator and next-up preview.
- As any User, I want to **see a countdown** to the next major deadline.
- As any User, I want to **report a Code of Conduct incident** at any time via a persistent button.
- As a Participant, I want a **personal dashboard** showing: my team, our project status, upcoming agenda items, pending invitations, presentation slot, voting status.
- As an Admin, I want an **event command center** with real-time metrics: check-ins, teams formed, projects submitted, demo progress, judging progress, votes cast, incidents reported.
- As an Admin, I want to **browse the full activity log** to audit any action in the competition.

---

## 6. Screens & Navigation Structure

### 6.1 Shared (All Roles)

| Screen | Description |
|--------|-------------|
| **Login** | Email + password authentication |
| **Dashboard** | Role-specific home screen |
| **Profile** | View/edit own profile |
| **Competition Overview** | Current stage, description, agenda, tracks, sponsors, prizes, announcements |
| **Agenda** | Timeline view of all scheduled items with "now" indicator |
| **Announcements Feed** | Chronological list filtered by role/track relevance |
| **Participants Directory** | Searchable/filterable list of all participants |
| **Sponsors & Prizes** | Sponsor logos/tiers, prize categories, sponsor challenges |
| **Report Incident** | Code of Conduct incident report form (accessible from any screen) |

### 6.2 Participant-Specific

| Screen | Description |
|--------|-------------|
| **My Team** | Team roster, invitations, track selection, table assignment |
| **Team Browser** | List of open teams with join request option |
| **My Project** | Edit/preview project submission, originality disclosure |
| **QR Code** | Personal check-in QR |
| **Presentation Queue** | Live view of demo order, my team's slot, timer |
| **People's Choice Voting** | Browse projects, cast votes |
| **Results** | Final scores, prizes, and leaderboard (when available) |

### 6.3 Mentor-Specific

| Screen | Description |
|--------|-------------|
| **My Tracks** | Overview of assigned tracks and their teams |
| **Session Requests** | Incoming mentoring requests |
| **Session Log** | History of completed sessions with notes |

### 6.4 Judge-Specific

| Screen | Description |
|--------|-------------|
| **Judging Dashboard** | List of assigned projects with scoring progress, round indicator |
| **Score Card** | Per-project scoring form with criteria, originality disclosure visible |
| **Presentation View** | Live view of current presenter with project details auto-loaded |
| **Leaderboard Preview** | Provisional ranking (admin-controlled visibility) |

### 6.5 Admin-Specific

| Screen | Description |
|--------|-------------|
| **Event Command Center** | Real-time metrics dashboard |
| **Competition Management** | Stage control, configuration, rules, stage overlap settings |
| **User Management** | CRUD users, role assignment, bulk import |
| **Track Management** | CRUD tracks, assign mentors |
| **Team Management** | View all teams, table assignments, manual assignments, disqualify/dissolve |
| **Sponsor Management** | CRUD sponsors, tiers, challenges |
| **Prize Management** | CRUD prizes, assign winners |
| **Demo Control** | Presentation queue management, timer control, skip/reorder, kiosk/projector mode |
| **Judging Management** | Panels (preliminary + final), criteria, progress monitoring, finalist selection |
| **Results Management** | Score review, anomaly detection, People's Choice tally, prize assignment |
| **Incident Reports** | View/manage Code of Conduct reports |
| **Activity Log** | Full audit trail browser with filters |
| **Check-In Scanner** | QR scanner for venue check-in |

---

## 7. Notification System

| Trigger | Recipients | Channel |
|---------|-----------|---------|
| Account invitation | New user | Email |
| Competition stage change | All checked-in users | In-app push + feed |
| Team invitation received | Invitee | In-app push |
| Team join request received | Team owner | In-app push |
| Invitation accepted/declined | Inviter | In-app push |
| Track selected for team | All team members | In-app push |
| Mentor session requested | Assigned mentors | In-app push |
| Submission deadline approaching (1h, 15min) | Teams with DRAFT projects | In-app push |
| Project submitted | All team members | In-app push |
| Team is ON_DECK for presentation | All team members | In-app push (urgent) |
| Demo stage begins | All users | In-app push + feed |
| People's Choice voting opens | All participants | In-app push |
| People's Choice voting closing soon (15min) | Participants who haven't voted | In-app push |
| Judging/deliberation stage begins | All judges | In-app push + email |
| Judge scoring reminder | Judges with incomplete scores | In-app push |
| Incident report filed (HIGH/CRITICAL) | All admins | In-app push (urgent) |
| Results published | All users | In-app push + email |
| Prize awarded to your team | Winning team members | In-app push + email |
| New announcement | Targeted roles/tracks | In-app push |

---

## 8. Non-Functional Considerations

### 8.1 Performance
- Support 200+ concurrent users for HackOn-scale events.
- Real-time updates via WebSocket or SSE for stage changes, announcements, presentation timer, and scoring progress.
- Presentation timer must be sub-second accurate with sync across all connected clients.

### 8.2 Security
- All user management behind admin authentication.
- Role-based access control on every endpoint.
- Project submissions are immutable after `PUBLISHED` (audit trail for any admin overrides via ActivityLog).
- Judge scores are hidden from participants until `FINISHED` stage.
- People's Choice votes are anonymous to other participants (only admin sees per-voter breakdown).
- Incident reports support anonymous filing.

### 8.3 Data Privacy
- Compliant with RODO/GDPR (Polish context).
- Code of Conduct acceptance required before accessing competition features.
- Privacy policy acceptance during onboarding.
- Data retention policy: competition data archived after configurable period.
- Right to deletion: admin can anonymize a user's data upon request.

### 8.4 Offline Resilience
- Core event info (agenda, team roster, project draft) cached locally.
- Graceful degradation if venue Wi-Fi is spotty — queue actions and sync when reconnected.
- Presentation timer should work locally even if connection drops temporarily.

### 8.5 Accessibility
- WCAG 2.1 AA minimum.
- Mobile-first responsive design (most participants will use phones during the event).
- Kiosk/projector mode for demo presentations designed for large screen readability.

---

## 9. Suggested MVP Scope (Phase 1)

For a first version targeting HackOn April 2026:

**Must have:**
- Admin: competition CRUD, stage management (including DEMOS and DELIBERATION stages), user management (individual + CSV import)
- Admin: track, agenda, sponsor, and prize management
- Admin: demo presentation queue management with live timer and kiosk/projector mode
- Admin: activity log viewer
- Participant: onboarding with CoC acceptance, profile, check-in QR
- Team: creation, invitations, join requests, track selection, table assignment, disqualification flow
- Project: CRUD with draft/published statuses, media uploads, originality disclosure
- Demo: stage presentation queue with live timer, on-deck indicator, projector view
- Judging: two-round config, criteria configuration, scoring form, finalist selection, leaderboard
- People's Choice: voting during/after demos
- Prizes: full prize entity with track placements, special awards, sponsor prizes, People's Choice
- Code of Conduct: acceptance gate, incident reporting
- Announcements: admin push to all users
- Real-time stage indicator

**Nice to have (Phase 2):**
- Mentor sessions with request/scheduling flow
- Certificate generation (PDF with participant name, team, placement)
- Public project gallery (no-auth page for social sharing)
- Post-event feedback survey
- Event analytics export (CSV/PDF of all scores, participation data)
- Slack/Discord integration for announcements
- Historical competition archive with cloning

---

## 10. Technical Stack Recommendation

Given the Open Mercato ecosystem and Patryk's stack preferences:

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 15 (App Router) + React | Aligns with OM ecosystem, SSR for fast loads |
| Styling | Tailwind CSS + shadcn/ui | Rapid UI development, consistent design system |
| Backend API | Next.js API Routes or tRPC | Type-safe, co-located with frontend |
| Database | PostgreSQL | Robust, JSONB for flexible fields (tech_stack, social_links, metadata) |
| ORM | Drizzle or Prisma | Type-safe schema, migrations |
| Auth | NextAuth.js or custom JWT | Magic link + password, role-based sessions |
| Real-time | WebSocket (Socket.io) or Supabase Realtime | Stage changes, presentation timer, announcements, scoring progress |
| File Storage | S3-compatible (MinIO for self-hosted or AWS S3) | Screenshots, avatars, attachments |
| Hosting | Vercel or self-hosted Docker | Easy deployment, edge functions for QR validation |

---

## Appendix A: Decision Log

Decisions incorporated from the Decision Buffer (research-driven):

| # | Decision | Status | Notes |
|---|----------|--------|-------|
| 1 | Demo/Presentation Session — Stage Presentation format | ✅ Added | New DEMOS stage, DemoSession object, timer, queue, kiosk mode |
| 2 | Two-Round Judging System | ✅ Added | judging_config on Competition, round field on JudgePanel/ProjectScore/JudgingCriterion |
| 3 | Prize / Award Entity | ✅ Added | Prize object with 4 categories, replaces Project.WINNER status |
| 4 | Sponsor / Partner Entity | ✅ Added | Sponsor object with tiers, challenges, logo, relations to Prize |
| 5 | People's Choice / Peer Voting | ✅ Added | PeerVote object, voting config, dedicated prize category |
| 6 | Code of Conduct as First-Class Feature | ✅ Added | CoC acceptance gate, IncidentReport object, anonymous reporting |
| 7 | Originality / Pre-Existing Code Disclosure (a+b) | ✅ Added | Disclosure fields on Project, admin flagging with reason |
| 8 | Dietary / Logistics | ❌ Deferred | Not included per user decision |
| 9 | Post-Hackathon (Survey/Certs/Gallery) | ❌ Deferred | Not included per user decision |
| 10 | Skill Matching | ❌ Deferred | Not included per user decision |
| 11 | Table/Booth Assignment | ✅ Added | table_number and table_location fields on Team |
| 12 | Disqualification Flow | ✅ Added | TeamStatus enum (ACTIVE/DISQUALIFIED/WITHDRAWN) with reason fields |
| 13 | Activity / Audit Log | ✅ Added | ActivityLog object with 17+ tracked action types |
| 14 | Demo Video Required | ❌ Deferred | Not included per user decision |
| 15 | Competition Stage Overlap Configuration | ✅ Added | stage_config on Competition with 4 flexibility flags |
