# SPEC-002 Appendix: Current Pages Without Designs

**Purpose**: Reference for the design team — describes what each page currently does, what data it shows, and what interactions it supports. Use this to create matching redesign screens.

---

## 1. Profile Page

**Route**: `/{org}/portal/profile`
**Purpose**: Displays the authenticated user's account information, roles, and permissions.

### What it shows

- **User info card**:
  - Display name (as page title)
  - Email address with verification badge (green if verified, outline if not)
  - Last login date/time (or "Never" if first visit)
  - Member since date/time
  - "Portal Admin" badge (yellow, shown conditionally)

- **Roles card**:
  - Count of assigned roles (e.g., "3 assigned")
  - List of role name badges (pill-shaped)
  - Empty state: "No roles assigned"

- **Permissions card** (full-width):
  - Count of features (e.g., "12 features")
  - List of permission IDs in monospace badges (e.g., `teams.view`, `projects.create`)
  - Empty state: "No permissions"

### Layout
Two-column grid (profile card | roles card), permissions card spans full width below.

### Interactions
Display-only page, no user actions. Has injection slots for extensibility (other modules can inject widgets before/after content).

### Design notes
- This is currently a very basic page — consider enriching with: editable profile fields (bio, organization, skills, social links, avatar), notification preferences, theme toggle
- The ParticipantProfile entity already stores bio, organization, skills, and social links — these are editable elsewhere but not shown here
- Consider whether this page should also show the user's competition participation history

---

## 2. Results / Leaderboard Page

**Route**: `/{org}/portal/results`
**Purpose**: Displays final competition rankings after judging is complete.

### What it shows

- **Stage gate**: Only visible when competition stage is `FINISHED` or `ARCHIVED`. Otherwise shows empty state: "Results Not Available Yet"

- **Leaderboard list** (vertical, divided rows):
  - Rank column:
    - #1: gold medal emoji
    - #2: silver medal emoji
    - #3: bronze medal emoji
    - #4+: plain number in monospace
  - Project title (bold, truncated)
  - Team name (smaller, muted text)
  - Average score (right-aligned, bold, monospace, 1 decimal place)
  - Peer vote count (if peer voting was enabled, smaller text below score)
  - "Finalist" badge (yellow, shown if project was selected as finalist)
  - Disqualified entries: shown with 40% opacity and line-through text

### Layout
Single card with divide-y borders separating each entry. Each row is a horizontal flex with rank | content | score.

### Interactions
Display-only. Competition selector to switch between competitions.

### Design notes
- Currently very simple list — consider: podium visualization for top 3, track-based filtering/grouping, score breakdown expansion, category awards section
- Peer votes and judge scores are separate data points that could be visualized differently
- Prize winners could be highlighted or linked to the Sponsors/Prizes section

---

## 3. Participants / People Directory Page

**Route**: `/{org}/portal/participants`
**Purpose**: Searchable directory of all competition participants, mentors, and judges.

### What it shows

- **Search input** (top, debounced 300ms, minimum 2 characters)

- **Participant cards** in responsive grid (2 cols on md, 3 cols on lg):
  - Avatar circle (initial letter of name, primary/10 background color)
  - Display name (truncated)
  - Email (truncated, smaller text)
  - Role badge (color-coded):
    - Participant: blue
    - Mentor: purple
    - Judge: amber
  - "Looking for team" badge (green, conditional)
  - Organization name (small, muted)
  - Skills tags: up to 5 shown as small pills, "+X more" overflow indicator

### Layout
Search bar at top, then responsive card grid below.

### Interactions
- Text search (debounced, filters cards)
- Cards are display-only (no click action)

### Design notes
- No click-through to individual profiles — consider adding profile detail view or modal
- No filtering by role, skills, or "looking for team" status — consider filter chips
- No way to contact or connect with participants from this page
- Avatar is just an initial letter — consider supporting real photos
- Could add team affiliation display

---

## 4. Sponsors & Prizes Page

**Route**: `/{org}/portal/sponsors`
**Purpose**: Directory of competition sponsors and available prizes.

### What it shows

- **Sponsors section** ("Our Sponsors"):
  - Grid of sponsor cards (2 cols on sm, 3 cols on lg)
  - Each sponsor card:
    - Logo image (48x48, contained fit, hidden on load error)
    - Sponsor name (bold)
    - Tier badge label: Title / Gold / Silver / Partner / In-Kind
    - Description text (small, muted)
    - **Sponsor Challenge** (conditional, highlighted box):
      - Challenge title (uppercase, primary color, extra-small)
      - Challenge description (extra-small, muted)
    - Website link (small, primary color, underline, opens new tab)

- **Prizes section** ("Prizes"):
  - Grid of prize cards (2 cols on sm)
  - Each prize card:
    - Rank indicator: trophy emoji for #1, or rank number in yellow circle
    - Prize name (medium weight)
    - Description (extra-small, truncated, muted)
    - Value amount (small, bold, primary color — e.g., "$5,000")

### Layout
Two stacked sections, each with a title and card grid.

### Interactions
- External website links (new tab)
- Competition selector
- Otherwise display-only

### Design notes
- Sponsors are sorted by tier (Title first, then Gold, Silver, etc.)
- Logo handling includes error fallback (hides broken images)
- Consider: larger sponsor logos for higher tiers, clickable cards with expanded detail view, prize eligibility info (which tracks can win which prizes)

---

## 5. Project Submission Page

**Route**: `/{org}/portal/project`
**Purpose**: Rich form editor for teams to build and submit their hackathon project.

### What it shows

**When team has no project yet**: Empty state with prompt to start

**When project is submitted (published)**: Read-only view with:
- Green success banner with submission timestamp
- All project details displayed (not editable)
- Reuse flag warning if project was flagged

**When project is in draft (active editing)**:

- **Deadline warning banner**:
  - Yellow when deadline approaching
  - Red + urgent styling when <= 15 minutes remain
  - Shows: deadline timestamp + time remaining (e.g., "2h 30m" or "5m 12s")
  - Red banner when deadline has passed (submit disabled)

- **Completeness checklist card**:
  - Progress bar (animated fill)
  - Required fields with checkmark/circle indicators
  - Counter: "X / 3 required fields"

- **Save status indicator**:
  - "Saving..." during auto-save
  - "Last saved: [time]" on success
  - Red warning if auto-save failed + localStorage backup notice
  - Manual "Save Draft" button

- **Project Details card**:
  - Title input (required, max 255 chars)
  - Tagline input (max 140 chars, live character counter)
  - Description textarea (required, tall)
  - Problem Statement textarea
  - Solution textarea
  - Tech Stack: tag input (Enter to add, click x to remove, shown as colored pills)

- **Links card**:
  - Demo URL input
  - Repository URL input
  - Video URL input
  - Presentation URL input

- **Screenshots & Media card**:
  - Upload button (accepts PNG, JPG, GIF, WebP)
  - Grid of uploaded screenshots (2 cols, 3 cols on sm)
  - Remove button (x) on each screenshot
  - File count display

- **Originality Disclosure card**:
  - Blue info banner explaining transparency policy
  - Toggle: "This project uses pre-existing code"
  - Conditional textarea: "Describe the pre-existing code used" (only visible if toggle ON)
  - Textarea: "What was built during the hackathon"

- **Reuse flag warning** (conditional):
  - Orange banner if project has been flagged for code reuse by admin
  - Shows flag reason

- **Submit section**:
  - "Ready to Submit?" heading with warning text
  - Submit button (disabled if: incomplete, not team owner, deadline passed)
  - 2-step confirmation modal with yellow warning
  - Loading state during submission

### Layout
Single column, stacked cards with consistent spacing.

### Interactions
- All form inputs (text, textarea, URL, toggle, file upload)
- Tech stack tag management (add/remove)
- Screenshot upload and removal
- Manual save button
- 2-step project submission

### Special features
- **Auto-save every 30 seconds** (background)
- **Live deadline countdown** (updates every second)
- **localStorage backup** if auto-save fails
- **Character counter** on tagline
- **Completeness tracking** with progress bar
- **Owner-only submission** (other team members can edit but not submit)

### Design notes
- This is the most complex page in the portal — ~500 lines of code
- Consider: draft preview mode, markdown support for descriptions, collaborative editing indicators, submission checklist as a sidebar widget
- The auto-save + localStorage backup pattern is critical and should be preserved

---

## 6. Voting (People's Choice) Page

**Route**: `/{org}/portal/voting`
**Purpose**: Peer voting for favorite projects (People's Choice award).

### What it shows

- **Voting closed banner** (conditional):
  - Blue info box when competition has moved past voting stage (deliberation/finished/archived)
  - Shows message and reminds user of their vote count

- **Vote counter**:
  - Shows "X / 3 votes used" (3 is default max)
  - Muted background card

- **Project cards grid** (2 cols on sm):
  - Project title (bold, truncated)
  - Team name (small, muted — if available via enricher)
  - Tagline (extra-small, muted, truncated)
  - Vote button:
    - Not voted: outline button with heart outline icon + "Vote"
    - Voted: green border button with filled heart icon + "Voted"
    - Saving: disabled, shows "Saving..."
    - Disabled: when voting closed or vote limit reached

### Layout
Vote counter at top, then card grid below.

### Interactions
- Vote button (toggles between vote/unvote)
- Competition selector
- Flash messages on vote/unvote actions

### Special features
- **3-vote limit** per person (configurable)
- **Toggle voting** (click voted project to unvote)
- **Real-time vote tracking** (local state)
- **Stage-based disabling** (voting closes when competition advances)

### Design notes
- Currently no way to view project details before voting — consider expandable cards or click-through
- No sorting or filtering of projects
- Vote count per project is not shown to voters (only their own votes)
- Consider: project thumbnails/screenshots, voting categories, ranking instead of binary votes

---

## 7. Incident Report Page

**Route**: `/{org}/portal/incident`
**Purpose**: Confidential form for reporting Code of Conduct violations.

### What it shows

- **Safety info banner** (blue):
  - Shield icon
  - "Safe & Confidential" title
  - Explanation of confidentiality and follow-up process

- **Report form card**:
  - **Description** textarea (required, tall — min 120px height)
  - **Severity selector** (4-button group, mutually exclusive):
    - Low (gray) — minor issue
    - Medium (yellow) — moderate concern
    - High (orange) — serious violation
    - Critical (red) — immediate danger
    - Each button shows label + short description text
  - **Reported person** text input (optional, helper text explains purpose)
  - **Anonymous toggle** (switch with label):
    - "Report anonymously"
    - Helper text: "Your identity will not be linked to this report"

- **Submit section**:
  - Submit button (disabled until description is filled)
  - 2-step confirmation modal:
    - Yellow warning box
    - Additional note if anonymous is selected
    - Confirm / Cancel buttons
  - Loading state: "Submitting..."

- **Success state** (replaces form after submission):
  - Large green checkmark icon (circle background)
  - "Report Submitted" heading
  - Confirmation message
  - "Submit Another Report" button (resets form)

### Layout
Single column, stacked sections.

### Interactions
- Description textarea
- Severity button group (4 options)
- Reported person input
- Anonymous toggle switch
- 2-step submission with confirmation modal
- Reset to submit another report

### Design notes
- This is intentionally simple and reassuring — the safety banner is important
- Consider: file/screenshot attachment for evidence, incident tracking number after submission, follow-up status page for non-anonymous reporters
- The anonymous mode changes the confirmation dialog text

---

## 8. Presentations / Kiosk View

These are actually **two separate pages** serving different purposes:

### 8a. Presentations Queue Page

**Route**: `/{org}/portal/presentations`
**Purpose**: Live view of the demo presentation queue for participants and judges.

#### What it shows

- **"Now Presenting" card** (large, centered):
  - Phase label: "PRESENTATION" or "Q&A" (uppercase)
  - Team name (text-2xl, bold)
  - Project title (muted)
  - Countdown timer (text-5xl, monospace, bold):
    - Green: normal time
    - Yellow: under 60 seconds
    - Red: under 30 seconds
    - Red + pulsing animation: "TIME'S UP"

- **"On Deck" banner** (yellow background):
  - Next team name and project title

- **Queue list** (divided rows):
  - Presentation order number (monospace)
  - Team name (truncated)
  - Project title (smaller text)
  - Status badge (color-coded):
    - Presenting/Q&A: green
    - On deck: yellow
    - Completed: gray
    - Skipped: red
    - Pending: muted
  - Active/on-deck rows have tinted backgrounds

- **Kiosk link** at bottom (opens full-screen display)

#### Interactions
- Competition selector
- Link to kiosk view
- Otherwise display-only (auto-updates)

#### Special features
- **Timer updates every 1 second**
- **Query refetches every 15 seconds**
- **Server time sync** (clock delta calculation)
- **Color-coded urgency** on countdown

---

### 8b. Kiosk Display Page

**Route**: `/{org}/portal/kiosk`
**Purpose**: Full-screen, large-format display for projecting in the presentation room.

#### What it shows

- **Black background**, no UI chrome (no nav, no header)
- Viewport-height-scaled typography for maximum visibility from distance:
  - Phase text: uppercase, tracking-wide, color-coded (green/yellow/red)
  - Team name: minimum 8vh font (48px floor)
  - Project title: 3vh, 60% opacity white
  - Countdown timer: minimum 20vh font (120px floor)
  - "Up Next" section: team name at 2vh, yellow-tinted

- **When no presentation is active**:
  - "Waiting for next presentation..." message (white, 40% opacity)
  - Optional "Up Next" team preview

#### Interactions
None — purely a display surface.

#### Special features
- **Timer updates every 100ms** (smooth display)
- **Query refetches every 10 seconds**
- **Viewport-height sizing** (scales to any screen/projector)
- **No distractions** (black background, no navigation)

### Design notes for Presentations/Kiosk
- The kiosk page is designed for TV/projector use — maintain large, clean typography
- Consider: speaker notes view, team photo/logo display, track-specific branding
- The presentations queue page could benefit from: estimated wait times, team prep checklist, "your turn is coming" notification integration

---

## Summary: What Each Page Needs from the Design Team

| Page | Complexity | Key Design Decisions |
|---|---|---|
| **Profile** | Low | Should we add profile editing? What fields to show? Avatar upload? |
| **Results** | Medium | Podium treatment for top 3? Track grouping? Score breakdown? Prize display? |
| **Participants** | Medium | Filtering/sorting? Profile click-through? Connection/contact actions? |
| **Sponsors** | Medium | Tier-based sizing? Challenge cards treatment? Prize visualization? |
| **Project** | High | Most complex page — auto-save UX, deadline urgency, completeness tracking, media uploads |
| **Voting** | Low-Medium | Project previews? Vote visualization? Sorting? |
| **Incident** | Low | Sensitive UX — keep simple and reassuring. Evidence upload? Tracking? |
| **Presentations** | Medium | Timer prominence? Queue visualization? Speaker prep? |
| **Kiosk** | Low | Full-screen display — branding? Animations? Transitions between presenters? |

All pages should follow the new design system (sidebar nav, top bar, two-column layout, color palette) established in the 5 screens already designed.
