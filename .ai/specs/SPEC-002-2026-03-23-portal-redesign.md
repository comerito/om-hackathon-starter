# SPEC-002: Hackathon Portal Redesign

**Date**: 2026-03-23
**Status**: Draft
**Branch**: feat/redesign
**Designs received**: All 13 screens (5 initial + 8 additional)

---

## Missing Design Screens

~~All screens have been provided.~~ Only **Voting** page design is still missing. All other pages are covered:

- ~~Profile page~~ Received
- ~~Results / Leaderboard page~~ Received
- ~~Participants / People directory page~~ Received
- ~~Sponsors page~~ Received
- ~~Project Submission page~~ Received
- **Voting page** — still missing
- ~~Incident Report page~~ Received
- ~~Presentations / Kiosk view~~ Received (both)

---

## 1) Functional Changes Audit

### Currently Supported (no backend changes needed)

| Feature in Design | Current Backend Support |
|---|---|
| Team name, description, member list | Teams entity + members |
| OWNER/MEMBER badges | TeamMember.role (OWNER, MEMBER) |
| Invite Member | TeamInvitation API |
| Track cards with icon, name, description, color | Track entity |
| Track team count + max capacity | Track.max_teams + count query |
| Agenda day tabs, events, time ranges | AgendaItem entity with day grouping |
| Event types (Ceremony, Workshop, Talk) | AgendaItem.type enum |
| Event location display | AgendaItem.location field |
| "HAPPENING NOW" badge | Client-side computation from start/end times |
| Announcements with priority color-coding | Announcement with INFO/WARNING/URGENT |
| Pinned announcements | Announcement.is_pinned |
| Hackathon stage display | Competition.stage |
| Hours left countdown | Competition.end_date - now() |
| Team's selected track display | Team.track_id |
| Prize pool display | Can SUM(prize.value) from existing prizes |
| Sponsor cards with logo, tier, description, challenge | Sponsor entity fields |
| Prize list with name, description, value, rank | Prize entity fields |
| Incident report form (description, severity, reported person, anonymous) | IncidentReport entity + API |
| Project submission (title, tagline, description, problem, solution, tech stack, URLs, screenshots) | Project entity + API |
| Project auto-save, deadline countdown | Existing frontend logic |
| Presentation queue with timer, status, on-deck | DemoSession entity + API |
| Kiosk full-screen display | Existing kiosk page logic |
| Results leaderboard (rank, score, peer votes, finalist, disqualified) | Leaderboard API |
| Participant directory with search, skills, roles | Participation + ParticipantProfile |
| User profile (name, email, verified, roles, permissions) | Core portal profile |

### Backend Gaps — New Features Required

#### GAP 1: Milestones / Phases Entity

**Seen in**: Dashboard (12 MILESTONES, Phase 2: MVP Development 66%), Team page (Milestones timeline)

No milestones entity exists. Need a new `Milestone` entity:

- `competition_id`, `name`, `description`, `due_date`, `status` (upcoming/active/completed), `sort_order`
- API: CRUD + portal read endpoint
- Used for: phase progress bar, next deadline widget, team milestones timeline

#### GAP 2: Announcement Categories

**Seen in**: Dashboard (LOGISTICS, TECHNICAL badges)

Currently only `priority` (info/warning/urgent). Need a `category` field:

- Add `category` enum: `general`, `logistics`, `technical`, `schedule`, `judging`
- Migration: add column to announcements table

#### GAP 3: Team Resources / File Sharing

**Seen in**: Team page (Project Proposal.pdf, Design System Figma, Asset Repository)

No team resource/file management exists. Need a `TeamResource` entity:

- `team_id`, `name`, `type` (file/link/repository), `url`, `file_id`, `metadata` (JSONB)
- API: CRUD for team members, read for team viewers
- File upload integration

#### GAP 4: Member Role Titles

**Seen in**: Team page (Lead Architect, UI/UX Strategist, Full Stack Developer)

TeamMember only has OWNER/MEMBER role. Need a custom title field:

- Add `title` (varchar, nullable) to TeamMember entity
- Or use ParticipantProfile.bio/organization for this

#### GAP 5: Participant Count / Stats Endpoint

**Seen in**: Dashboard (1,248 PARTICIPANTS, 08 ACTIVE TRACKS), Results page (Total Submissions, Avg Score, Community Engagement, Judging Panel Status)

Need a stats aggregation endpoint:

- `GET /portal/competition-stats` returning: participant_count, active_tracks, total_teams, total_submissions, avg_score, total_peer_votes
- Can be computed from existing data, just needs a new endpoint

#### GAP 6: Track Categories / Tags

**Seen in**: Competition page (filter tabs: UI/UX Design, Open Source, Editorial), Participants page (filter tabs: Designers, Developers, Strategists)

Tracks have no category field. Options:

- Add `category` field to Track entity
- Or use tags/JSONB array for flexible filtering

#### GAP 7: Track Badges (NEW, HOT, STABILITY)

**Seen in**: Competition page (badges on track cards)

No badge system on tracks. Options:

- Add `badge` field (nullable enum or string) to Track entity
- Or derive from data (NEW = created recently, HOT = many teams)

#### GAP 8: Track Suggestions (Wild-Card)

**Seen in**: Competition page ("Suggest a wild-card track to the admins")

No track suggestion mechanism exists. Options:

- Simple: use existing announcement/contact mechanism
- Full: new `TrackSuggestion` entity with title, description, submitter

#### GAP 9: Competition Info Fields (WiFi, Help Channel)

**Seen in**: Agenda page (Wi-Fi SSID/password, Slack help channel)

Competition entity doesn't have these info fields. Options:

- Add `info_cards` JSONB field to Competition entity
- Or create a `CompetitionInfo` entity for key-value pairs

#### GAP 10: Session Completion Tracking

**Seen in**: Agenda page (Friday Completion: 1 of 4 main sessions completed)

No attendance/completion tracking for agenda items. Options:

- Add `AgendaCompletion` entity (user + agenda_item)
- Or track at client level (localStorage)

#### GAP 11: Featured Speaker/Curator

**Seen in**: Agenda page (Featured Curator card with photo)

No featured person concept. Options:

- Add `featured_speaker_id` to Competition or AgendaItem
- Or use ParticipantProfile with a `featured` flag

#### GAP 12: Rich Announcement Content

**Seen in**: Dashboard (code blocks, action links in announcements)

Currently plain text. Need:

- Change `content` to support markdown rendering
- Add optional `action_url` and `action_label` fields

#### GAP 13: User Online Presence

**Seen in**: Dashboard (green dots on team members)

No presence tracking exists. This is complex (websockets/SSE heartbeat). Consider:

- Skip for MVP, show "last active" instead
- Or implement simple heartbeat endpoint

#### GAP 14: Notification Preferences / Engagement Controls

**Seen in**: Profile page (Email Updates toggle, Slack Notifications toggle, SMS Urgent Alerts toggle)

No notification preference system exists. Need:

- `NotificationPreference` entity or JSONB field on user/participation: `{ email_digest: boolean, slack_alerts: boolean, sms_urgent: boolean }`
- API: `GET/PUT /portal/notification-preferences`
- Integration with notification dispatch system

#### GAP 15: Avatar / Profile Photo Upload

**Seen in**: Profile page (large avatar with edit overlay), Participants page (real photos), Team page (member photos), Results page (project thumbnails)

ParticipantProfile has no avatar field. Need:

- Add `avatar_id` or `avatar_url` to ParticipantProfile entity
- File upload endpoint for avatar
- Used across: profile, participants directory, team members, presentation queue

#### GAP 16: Portfolio URL / Office Hours Booking

**Seen in**: Participants page — "VIEW PORTFOLIO" link on participants, "BOOK OFFICE HOURS" link on mentors

No portfolio or office hours fields exist. Need:

- Add `portfolio_url` to ParticipantProfile (may already have social links — verify)
- Add mentor office hours concept: either a URL field (`office_hours_url`) or a scheduling entity

#### GAP 17: Participant Category / Type Filtering

**Seen in**: Participants page (filter tabs: Designers, Developers, Strategists), "Advanced Filters" button

No participant category field exists. Options:

- Derive from skills tags (map skills to categories)
- Add `category` or `specialty` field to ParticipantProfile
- Advanced filters: filter by role, skills, looking-for-team, organization

#### GAP 18: Direct Messaging

**Seen in**: Participants page (chat/message icon on each card)

No messaging system exists. Options:

- Simple: link to external tool (Slack DM deeplink)
- Full: in-app messaging entity (high effort, probably out of scope)

#### GAP 19: Results Export

**Seen in**: Results page (EXPORT button)

No export functionality exists. Need:

- `GET /portal/leaderboard?format=csv` or similar endpoint
- Client-side CSV generation from existing data

#### GAP 20: Results Track Filtering

**Seen in**: Results page (SELECT TRACK dropdown: "Global Architecture Final")

Leaderboard API may not support track-based filtering. Need:

- Add `track_id` filter parameter to leaderboard endpoint
- Return track-specific rankings

#### GAP 21: Presentation Logistics Announcements

**Seen in**: Presentations page (dark "LOGISTICS UPDATE" banner: "Teams 14-18 please report to Stage B holding area")

Current announcements are competition-wide. Need:

- Either: filter announcements by category `logistics` for presentations page
- Or: add a dedicated `logistics_message` field on DemoSession/Competition for real-time updates

#### GAP 22: Profile Edit Endpoint

**Seen in**: Profile page ("Edit Profile" button)

No portal-facing profile edit endpoint exists (profile is display-only currently). Need:

- `PUT /portal/update-profile` for: display name, bio, organization, skills, social links, avatar
- Form validation with Zod

### Priority Plan (Updated)

| Priority | Gap | Effort | Impact |
|---|---|---|---|
| P0 | GAP 5: Stats endpoint | Small | Dashboard + Results |
| P0 | GAP 2: Announcement categories | Small | Dashboard redesign |
| P0 | GAP 12: Rich announcements | Small | Dashboard redesign |
| P0 | GAP 15: Avatar upload | Medium | Profile + Participants + Team + Presentations |
| P0 | GAP 22: Profile edit endpoint | Small | Profile page |
| P1 | GAP 1: Milestones entity | Medium | Dashboard + Team page |
| P1 | GAP 4: Member role titles | Small | Team page |
| P1 | GAP 9: Competition info fields | Small | Agenda page |
| P1 | GAP 14: Notification preferences | Medium | Profile page |
| P1 | GAP 17: Participant filtering | Small | Participants page |
| P1 | GAP 20: Results track filtering | Small | Results page |
| P2 | GAP 3: Team Resources | Medium | Team page |
| P2 | GAP 6: Track categories | Small | Competition page |
| P2 | GAP 7: Track badges | Small | Competition page |
| P2 | GAP 16: Portfolio/Office hours | Small | Participants page |
| P2 | GAP 19: Results export | Small | Results page |
| P2 | GAP 21: Logistics announcements | Small | Presentations page |
| P3 | GAP 8: Track suggestions | Small | Competition page |
| P3 | GAP 10: Session completion | Medium | Agenda page |
| P3 | GAP 11: Featured speaker | Small | Agenda page |
| P3 | GAP 18: Direct messaging | Large | Participants page |
| P4 | GAP 13: Online presence | Large | Dashboard sidebar |

---

## 2) Required UI Components

### Layout Components

1. **PortalSidebar** — Left navigation with icon+label items, active state (indigo left border + fill), "Join Hackathon" CTA at bottom. Variant: simplified sidebar for incident pages (fewer items + "Support" link)
2. **PortalTopBar** — Competition name + subtitle, global search input, notification bell (with dot badge), settings gear, user avatar with name/role. Variant: top-nav-only mode for project submission (Dashboard, Agenda, Tracks links inline)
3. **PortalPageHeader** — Section label (uppercase, primary color) + large title + optional right-side element (countdown, button, dropdown)
4. **TwoColumnLayout** — Main content (left, ~65%) + sidebar widgets (right, ~35%)
5. **PortalFooter** — "HACKATHON SUPPORT SYSTEM" + links (Code of Conduct, Privacy Policy, Safety Hotline) + copyright line. Used on incident + results pages

### Card Components

6. **StatCard** — Icon + large number + label (e.g., "1,248 PARTICIPANTS"). Variant: dark background (Judging Panel Status)
7. **GradientCard** — Purple/primary gradient background card (used for prize pool, hackathon progress, resources guide, sponsors hero)
8. **CountdownWidget** — Large number display with "HOURS LEFT" / "HRS" / "TIME REMAINING" label
9. **ProgressCard** — Title + progress bar + label (e.g., "Phase 2: MVP Development 66%")
10. **DeadlineCard** — "NEXT DEADLINE" label, deadline name, date/time display

### Team Components

11. **MemberCard** — Avatar photo + name + role title + OWNER/MEMBER badge
12. **MemberList** — "Active Collaborators" header with count badge, list of MemberCards
13. **InviteMemberButton** — Primary button with person-add icon
14. **TeamResourceItem** — File icon (by type) + name + metadata (timestamp or description)
15. **TeamResourcesList** — "Team Resources" section with items + "View all assets" link

### Track Components

16. **TrackCard** — Track number label, icon, title, description, colored accent bar, team count, avatar stack
17. **TrackCardFeatured** — Larger active track card with "ACTIVE TRACK" badge, description, stats, "View Dashboard" button
18. **TrackFilter** — Pill/tab filter bar (All Tracks, UI/UX Design, etc.)
19. **TrackBadge** — Small badges (NEW in green, HOT in orange, STABILITY in gray)
20. **TrackSuggestionCard** — Dashed border card with "+" icon and CTA text

### Agenda Components

21. **DayTabs** — Tab bar for Friday/Saturday/Sunday with underline active state
22. **TimelineView** — Vertical timeline with dots (colored for active/past/future)
23. **TimelineEventCard** — Time range, title, description, location tag, type badge, "HAPPENING NOW" badge
24. **SessionProgress** — "Friday Completion" with progress bar and "X of Y" label
25. **InfoCard** — Small helper cards (Need help?, Wi-Fi Network) with icon and text
26. **FeaturedPersonCard** — Large photo card with name and role overlay

### Announcement Components

27. **AnnouncementCard** — Icon, category badge, timestamp, title, description, optional action link, optional code block, colored left border
28. **AnnouncementList** — List with "Load Older Announcements" pagination

### Dashboard Components

29. **QuickActionsList** — List of action items with icon + label + arrow chevron
30. **TeamSummaryWidget** — Team name, mini member list (avatar + name + role + online dot), capacity progress bar

### Milestone Components

31. **MilestoneTimeline** — Vertical dot timeline with status colors (completed/active/upcoming), name, date

### Participant Components

32. **ParticipantCard** — Photo avatar + "LOOKING FOR TEAM" badge + name + email + role badge (colored: participant blue, mentor purple, judge amber) + organization + skills tags + role-specific action link (VIEW PORTFOLIO / BOOK OFFICE HOURS / VIEW PROFILE) + message icon
33. **ParticipantFilter** — Tab bar with count (All 1,248 / Designers / Developers / Strategists) + "Advanced Filters" button with filter icon
34. **LoadMoreButton** — Centered outlined button "Load More Participants" + count text "Showing X of Y"

### Profile Components

35. **ProfileHero** — Large avatar with edit overlay button + name + PRO badge + email with "Verified" badge + bio text + social link icons (link, portfolio, email)
36. **RolesList** — "Assigned Roles" header with count badge + list of roles with dot indicator + chevron (clickable rows)
37. **PermissionsBadgeGrid** — "Access Permissions" header + "SYSTEM AUTH V2.1" label + wrapped monospace permission badges
38. **EngagementControls** — "Engagement Controls" header + list of notification toggles (Email Updates / Slack Notifications / SMS Urgent Alerts) with type labels and toggle switches
39. **ProfileSubNav** — Top tab navigation (Profile | Explore | Mentors) with underline active state

### Results / Leaderboard Components

40. **PodiumDisplay** — Top 3 visualization with medal images (gold center tall, silver left, bronze right), project name, team name, score badge. Gold: "GRAND WINNER" + "CHAMPION" label. Silver: "SILVER FINALIST". Bronze: "BRONZE FINALIST"
41. **RankingsTable** — Full-width data table with columns: Rank, Project & Team (with thumbnail), Avg Score (monospace), Peer Votes (with thumbs-up icon), Status badge (FINALIST / PARTICIPANT / DISQUALIFIED). Includes pagination (numbered pages), FILTER button, EXPORT button
42. **ResultsStatBar** — Row of stat cards at page bottom: Total Submissions (with % vs last year), Avg Competition Score (with progress bar), Community Engagement (peer vote count with heart), Judging Panel Status (dark card, "Verified" with audit date)
43. **TrackSelector** — "SELECT TRACK" label + dropdown select (e.g., "Global Architecture Final")

### Sponsors Components

44. **SponsorsHero** — Gradient/light background card with "EVENT REWARDS" label, large headline ("Empowering Innovation."), description text, "TOTAL POOL $25,000" badge with icon
45. **SponsorCard** — Logo icon + name + tier badge (TITLE SPONSOR / GOLD TIER / SILVER TIER) + description + optional sponsor challenge block (indigo left border, "SPONSOR CHALLENGE" label, title, description)
46. **PrizeRow** — Large trophy/medal icon (ranked: gold/silver/bronze/star) + prize name + description + "VALUE" label + large dollar amount. Community Choice variant with star icon

### Project Submission Components

47. **DeadlineBanner** — Full-width alert bar: clock icon + "Approaching Deadline:" message + time remaining + "DRAFT MODE" badge (right-aligned). Color variants: yellow (warning), red (urgent)
48. **SubmissionProgress** — Sticky sidebar widget: percentage bar ("60% COMPLETE" + "3/5 REQUIRED"), checklist items with check/circle icons, "Submit Final Project" button (disabled state with error message), "Preview Page" button, "YOUR TEAM" avatar stack
49. **MediaGallery** — Horizontal row: upload slot (dashed border + upload icon) + image thumbnails (with real previews) + placeholder slots
50. **SubmissionAssets** — Grouped URL inputs with left icons per type: link icon (Demo URL), code icon (GitHub/Repository), video icon (Video Pitch). Each with uppercase label above
51. **OriginalityCheckbox** — Single checkbox with bold label + long description text (simplified from toggle + textareas)
52. **AutosaveIndicator** — Cloud icon + "Autosaved 2m ago" text (top-right of form section)

### Presentations Components

53. **NowPresentingHero** — Large card with dashed indigo border: "NOW PRESENTING" red badge, project name (large), team name, track tag pills. Adjacent: countdown timer box with MM:SS display + progress bar below
54. **OnDeckCard** — Right-side card: "NEXT UP (ON DECK)" label, project icon/image, team name, avatar stack with "+N", "Starts in MM:SS"
55. **LogisticsUpdateBanner** — Dark indigo/purple card: rocket icon, "LOGISTICS UPDATE" label, message text
56. **PresentationScheduleTable** — Data table with columns: Rank (colored number), Team Name, Project Concept (in quotes, italic), Status badge (PRESENTING red / ON DECK blue / WAITING gray / COMPLETED faded), Time Slot. Status legend in header. Completed rows faded
57. **HelpFAB** — Fixed position bottom-right floating action button with "?" icon (purple)

### Kiosk Components

58. **KioskLayout** — Full-screen dark background with no chrome. Top bar: "LIVE SUBMISSIONS PHASE" label + green dot (left), LOCAL TIME + STATUS indicator (right)
59. **KioskTeamDisplay** — "CURRENT TEAM" label + giant uppercase team name + project tagline (lighter weight)
60. **KioskTimer** — Massive MM:SS:ss display with color segmentation (white minutes, indigo seconds, fading fractional). Progress bar below (indigo fill). "PHASE STARTED" left label + "HARD DEADLINE: 00:00:00" right label (copper/red)
61. **KioskUpNextBar** — Bottom bar: "UP NEXT" pill (peach/salmon background), queue position number, team name (uppercase bold), track name, avatar stack with "+N"

### Incident Report Components

62. **SafetyBanner** — Full-width info bar: shield icon (indigo) + "Safe & Confidential" title + description text. Blue/indigo background
63. **SeveritySelector** — Horizontal 4-column button group: Low (gray dot), Medium (yellow dot), High (orange dot), Critical (red dot). Each with label + short description. Selected state: filled background
64. **IncidentForm** — Two-column row: "REPORTED PERSON (OPTIONAL)" input (left) + "PRIVACY PREFERENCE" toggle with label (right). Full-width "Submit Confidential Report" button with lock icon (disabled state with helper text below)
65. **ConfirmationModal** — "Final Confirmation" title + "Step 2 of 2: Submission Intent" subtitle + info box with bold warning text + "Submit Confidential Report" primary button + "Return to Edit" text link

### Design System Primitives

66. **ButtonPrimary** — Filled indigo button (matches #4F46E5). Full-width variant for forms
67. **ButtonSecondary** — Outlined button
68. **ButtonInverted** — Dark filled button
69. **SearchInput** — Search icon + input with rounded border
70. **Badge** — Colored pill badges (for categories, roles, statuses, tiers)
71. **AvatarStack** — Overlapping circular avatars with "+N" overflow count
72. **SectionLabel** — Uppercase small text in primary color (e.g., "WORKSPACE", "COMPETITION HUB", "NETWORK HUB")
73. **Pagination** — Numbered page buttons with prev/next arrows
74. **ToggleSwitch** — iOS-style toggle with on/off states (indigo when on)
75. **ActionLink** — Uppercase text link with arrow or icon (e.g., "VIEW PORTFOLIO →", "BOOK OFFICE HOURS")

---

## 3) Layout & Style Redesign Plan

### Color System Migration

| Token | Current (OKLCH) | New (from designs) |
|---|---|---|
| Primary | oklch(0.585 0.22 264) | **#4F46E5** (Indigo 600) |
| Secondary | — | **#64748B** (Slate 500) |
| Tertiary/Accent | — | **#A54100** (Copper/Brown) |
| Neutral BG | oklch(1 0 0) | **#F8FAFC** (Slate 50) |
| Gradient Primary | — | Linear gradient from #4F46E5 to #6366F1 |
| Dark Surface | — | **#0F172A** (Slate 900, kiosk + dark cards) |
| Success | — | Green for verified badges, completed states |
| Warning | — | Yellow/amber for deadlines, on-deck states |
| Danger | — | Red for critical severity, time's up, presenting |

The current OKLCH primary maps roughly to indigo already, but needs exact calibration to #4F46E5. The **tertiary copper/brown** (#A54100) is entirely new — used for accent bars, timer colons, deadline labels, and secondary highlights.

### Typography Changes

Current: Geist Sans/Mono. Design shows:

- **Headlines**: Large serif-like display font (seen in "The Agenda", "Leaderboard", "Participants Directory", "My Identity") — needs font selection (candidates: Playfair Display, Fraunces, or similar)
- **Body**: Clean sans-serif (could keep Geist Sans)
- **Labels**: Uppercase tracking-wide small text in primary color ("WORKSPACE", "NETWORK HUB", etc.)
- **Monospace**: Used for timers, scores, permission badges, countdown displays
- **Kiosk**: Extra bold condensed for team names (uppercase), large weight contrast

### Layout Architecture Change — Major

**Current**: `PortalLayoutShell` from @open-mercato/ui — header-based navigation with competition selector dropdown.

**New Design**: Three layout variants:

#### Variant A: Full Sidebar Layout (most pages)
- **Left sidebar** (fixed, ~220px): Logo/competition name + subtitle, icon navigation, "Join Hackathon" CTA at bottom
- **Top bar** (sticky): Competition name, search (contextual placeholder), notifications, settings, user avatar
- **Content area**: Two-column grid (main content ~65% + right sidebar ~35%)
- **Used on**: Dashboard, Agenda, Tracks, Competition, Team, Results, Participants, Sponsors, Profile

#### Variant B: Minimal Sidebar (incident/support pages)
- **Left sidebar** (narrower): Logo, minimal nav (Dashboard, Teams, Incidents, Schedule), "Support" item at bottom
- **Top bar**: Back arrow + page title, notifications, settings, avatar
- **Content area**: Single centered column
- **Footer**: "HACKATHON SUPPORT SYSTEM" + policy links
- **Used on**: Incident Report

#### Variant C: Top-Nav Only (project submission)
- **No sidebar**
- **Top bar**: Competition name + inline page links (Dashboard, Agenda, Tracks), notifications, settings, avatar
- **Content area**: Two-column (form ~60% + sticky progress sidebar ~40%)
- **Used on**: Project Submission

#### Variant D: No Chrome (kiosk)
- Full-screen, no navigation, no header
- Dark background
- **Used on**: Kiosk display

Implementation approach:

1. Create a custom `HackathonPortalLayout` component with variant prop
2. Replace `PortalLayoutShell` usage in the frontend catch-all layout
3. Build responsive: sidebar collapses to bottom nav on mobile

### Page-by-Page Redesign

#### Dashboard Page (Layout Variant A)

- **Current**: Stage task card + 3-column mini cards + announcements list
- **New**: Hero status section (title + countdown + milestones + progress bar) + stat cards row (participants, active tracks) + next deadline card + two-column below (announcements with categories + code blocks | quick actions + team summary with online dots + capacity bar + submission guide gradient card)
- **Key changes**: stat cards, milestone progress, announcement categories, quick actions panel, team summary widget with online presence, resource gradient card

#### Agenda Page (Layout Variant A)

- **Current**: Day tabs + simple list with time/title/description
- **New**: Day tabs (pill style) + vertical timeline with colored dot indicators + event cards with "HAPPENING NOW" badge + right sidebar (session completion progress, featured curator photo card, help info card, wifi info card) + FAB "+" button
- **Key changes**: vertical timeline design, happening-now highlight, completion tracker, featured curator, info sidebar, FAB

#### Competition/Tracks Page (Layout Variant A)

- **Current**: Simple grid of track cards
- **New**: Countdown timer (top right) + featured active track hero card + prize pool gradient card + filter tabs (All Tracks, by category) + track card grid with badges (NEW/HOT/STABILITY) + avatar stacks + suggestion card (dashed border)
- **Key changes**: featured track hero, prize pool, category filters, badges, stacked avatars, suggestion CTA

#### Team Page (Layout Variant A)

- **Current**: Team info + member list + invitations + create team form
- **New**: "WORKSPACE" header + team name/description + "Invite Member" button + Active Collaborators list with photos/titles/badges + track cards at bottom + right sidebar (hackathon progress countdown gradient card, team resources list, milestones timeline)
- **Key changes**: member role titles, photo avatars, resources section, milestone timeline, progress widget

#### Participants Page (Layout Variant A)

- **Current**: Search + simple card grid with initial avatars
- **New**: "NETWORK HUB" header + "Participants Directory" title + filter tabs with count (All 1,248 / Designers / Developers / Strategists) + "Advanced Filters" button + richer participant cards (real photos, organization dot-separated, role-specific action links, message icon) + "Load More Participants" pagination with count
- **Key changes**: real photos, category filters, advanced filters, action links (VIEW PORTFOLIO for participants, BOOK OFFICE HOURS for mentors), message icon, load-more pagination, bio/quote display for judges

#### Profile Page (Layout Variant A)

- **Current**: Display-only with name, email, roles list, permissions list
- **New**: "PARTICIPANT PORTAL" header + "My Identity" title + "Edit Profile" button + sub-nav (Profile | Explore | Mentors) + large avatar with edit overlay + PRO badge + verified email badge + bio text + social link icons + Assigned Roles as list rows (dot indicator + name + chevron) with count badge + Access Permissions with "SYSTEM AUTH V2.1" label + monospace badge grid + Engagement Controls (Email/Slack/SMS toggles with type labels)
- **Key changes**: avatar upload, edit capability, PRO badge, bio display, social links, notification preference toggles, sub-navigation, role list style

#### Results Page (Layout Variant A)

- **Current**: Simple leaderboard list with medal emojis
- **New**: "HACKATHON RESULTS 2024" header + track dropdown selector + podium visualization (gold center tall with "GRAND WINNER"/"CHAMPION", silver left "SILVER FINALIST", bronze right "BRONZE FINALIST" — each with medal image, project name, team name, score) + "Full Rankings" table (Rank, Project & Team with thumbnail, Avg Score, Peer Votes with icon, Status badge) + FILTER + EXPORT buttons + pagination + stat cards row (Total Submissions with % change, Avg Competition Score with bar, Community Engagement with heart, Judging Panel Status dark card) + footer
- **Key changes**: podium visualization, track filtering, data table with thumbnails, export, pagination, stat cards, footer

#### Sponsors Page (Layout Variant A, narrower sidebar)

- **Current**: Simple grid of sponsor cards + prize grid
- **New**: Hero gradient card ("EVENT REWARDS" + "Empowering Innovation." headline + "TOTAL POOL $25,000" badge) + "Our Sponsors" section ("INDUSTRY PARTNERS" label) with 2-column sponsor cards grouped by tier (Title/Gold first, Silver below) + sponsor challenge blocks with indigo left border + "Prizes" section ("VICTORY REWARDS" label) with prize rows (large trophy/medal/star icons, name, description, dollar value right-aligned)
- **Key changes**: hero section, tier grouping, challenge block styling, prize rows with large icons and values, footer-less single column

#### Project Submission Page (Layout Variant C)

- **Current**: Single column stacked cards with deadline banner + completeness checklist
- **New**: Top-nav only (no sidebar) + deadline banner (full-width, clock icon, time remaining, "DRAFT MODE" badge) + two-column layout: left form (Project Details with fields, two-column Problem/Solution, Tech Stack tags, Media Gallery with horizontal thumbnails, Submission Assets with typed icons, Originality Disclosure checkbox) + right sticky sidebar (Submission Progress % bar + checklist + Submit button + error message + Preview Page button + team avatar stack) + autosave indicator ("Autosaved 2m ago")
- **Key changes**: layout variant C (no sidebar), horizontal media gallery with real thumbnails, submission assets with icons, simplified originality checkbox, sticky progress sidebar, preview button, team widget

#### Presentations Page (Layout Variant A)

- **Current**: Now Presenting card + On Deck yellow banner + queue list with status badges
- **New**: "LIVE PRESENTATION QUEUE" header + "Showcase Finale" title + NOW PRESENTING hero card (dashed indigo border, red badge, project name large, team name, track tag pills, countdown timer box with progress bar) + "NEXT UP (ON DECK)" card (project icon, team name, avatar stack, "Starts in MM:SS") + dark "LOGISTICS UPDATE" banner (rocket icon) + "Presentation Schedule" data table (Rank with colored numbers, Team Name, Project Concept in quotes, Status badges with legend, Time Slot) + completed rows faded + help FAB
- **Key changes**: hero presentation card, on-deck with avatars and countdown, logistics banner, proper data table, status legend, help FAB

#### Kiosk Page (Layout Variant D)

- **Current**: Black background, phase label, team name, project title, large timer, on-deck preview
- **New**: Dark background with subtle texture + "LIVE SUBMISSIONS PHASE" + green dot (top-left) + LOCAL TIME + "STATUS: Active" (top-right) + "CURRENT TEAM" label + giant uppercase team name (bolder, wider) + project tagline + segmented color timer MM:SS:ss (white minutes, indigo seconds, fading fractional digits) + progress bar below timer + "PHASE STARTED" / "HARD DEADLINE" labels + "UP NEXT" bottom bar (peach pill, queue position, team name, track, avatar stack)
- **Key changes**: status indicators, segmented color timer, progress bar, phase/deadline labels, richer up-next bar with avatars and track

#### Incident Report Page (Layout Variant B)

- **Current**: Safety banner + description textarea + severity buttons + reported person + anonymous toggle + 2-step submit
- **New**: Minimal sidebar (Dashboard, Teams, Incidents, Schedule + Support) + back arrow in top bar + "Safe & Confidential" banner (shield icon, indigo bg) + single form card ("Incident Report" title + description) + horizontal severity selector (4 equal columns: Low/Medium/High/Critical with colored dots and descriptions) + two-column row (Reported Person input | Privacy Preference toggle) + full-width "Submit Confidential Report" button with lock icon + disabled state helper text + 2-step confirmation modal ("Final Confirmation — Step 2 of 2" + info box + submit button + "Return to Edit") + footer (HACKATHON SUPPORT SYSTEM + Code of Conduct, Privacy Policy, Safety Hotline)
- **Key changes**: variant B layout, back navigation, horizontal severity layout, two-column reported/privacy row, styled confirmation modal, footer with policy links

### Implementation Order (Updated)

#### Phase 1 — Foundation

1. Update color tokens in `globals.css` (primary → #4F46E5, add secondary/tertiary/dark)
2. Add typography tokens (headline display font, section label styles, monospace timer)
3. Build `HackathonPortalLayout` with all 4 variants (A/B/C/D)
4. Build design system primitives (buttons, badges, search input, section labels, toggle switch, avatar stack, pagination, action links)

#### Phase 2 — Dashboard

5. Build stat cards, countdown widget, progress card, deadline card
6. Build announcement card with categories + code blocks + load more
7. Build quick actions panel + team summary widget
8. Assemble new dashboard page

#### Phase 3 — Team Page

9. Build member cards with photos and titles
10. Build milestones timeline
11. Build resources list
12. Assemble new team page

#### Phase 4 — Agenda Page

13. Build vertical timeline component
14. Build "happening now" event card variant
15. Build session progress + info cards + featured curator
16. Assemble new agenda page

#### Phase 5 — Competition/Tracks Page

17. Build featured track card + prize pool gradient
18. Build track filter tabs + badges
19. Build avatar stack + suggestion card
20. Assemble new competition page

#### Phase 6 — Participants Page

21. Build participant cards with photos + action links
22. Build participant filter tabs + advanced filters
23. Build load-more pagination
24. Assemble new participants page

#### Phase 7 — Profile Page

25. Build profile hero with avatar upload + edit
26. Build roles list + permissions grid + engagement controls
27. Build profile sub-nav
28. Assemble new profile page

#### Phase 8 — Results Page

29. Build podium visualization
30. Build rankings table with track filter + export + pagination
31. Build results stat bar
32. Assemble new results page

#### Phase 9 — Sponsors Page

33. Build sponsors hero gradient card
34. Build sponsor cards with tier grouping + challenge blocks
35. Build prize rows with icons and values
36. Assemble new sponsors page

#### Phase 10 — Project Submission Page

37. Build deadline banner + autosave indicator
38. Build submission progress sidebar (sticky)
39. Build media gallery + submission assets
40. Assemble new project page with variant C layout

#### Phase 11 — Presentations Page

41. Build now-presenting hero + on-deck card
42. Build logistics banner + presentation schedule table
43. Assemble new presentations page

#### Phase 12 — Kiosk Page

44. Build kiosk layout with status indicators
45. Build segmented color timer + progress bar
46. Build up-next bottom bar
47. Assemble new kiosk page

#### Phase 13 — Incident Report Page

48. Build variant B layout with footer
49. Build horizontal severity selector + styled form
50. Build confirmation modal
51. Assemble new incident page
