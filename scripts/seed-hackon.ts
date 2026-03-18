/**
 * Seed demo data for HackOn hackathon platform.
 *
 * Usage: npx tsx scripts/seed-hackon.ts
 */
import 'dotenv/config'
import pg from 'pg'

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5433/open-mercato'
const client = new pg.Client(DATABASE_URL)

// IDs from the database
const TENANT_ID = '6c2580d4-eea8-43c8-86b4-969047ac671f'
const ORG_ID = '7c2febc4-a1fc-41fc-8f29-2ad127560dbd'
const ADMIN_USER_ID = 'd03e2f18-7772-41bf-a3d2-2678734d0c1f'

// Customer users
const ALICE_ID = '60515046-7d84-457d-8702-cf4a99bdba22'
const BOB_ID = 'cdd7d4f1-e02b-4e91-9a06-47a3c9891ce9'
const CAROL_ID = '5beb88d0-c80c-478f-ad01-72e3839859b7'
const PATRYK_ID = 'a372a133-135f-4f72-8dd3-d5f505bfdd76'

function daysFromNow(days: number, hour = 12, minute = 0): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  d.setUTCHours(hour, minute, 0, 0)
  return d.toISOString()
}

const now = new Date().toISOString()

async function seed() {
  await client.connect()
  console.log('Connected to database')

  // Clean existing HackOn data (in reverse dependency order)
  console.log('Cleaning existing HackOn data...')
  await client.query(`DELETE FROM incidents_report WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM sponsors_peer_vote WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM sponsors_prize WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM sponsors_sponsor WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM judging_criterion_score WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM judging_project_score WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM judging_demo_session WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM judging_panel_track WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM judging_panel_judge WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM judging_criterion WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM judging_panel WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM projects_project WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM teams_invitation WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM teams_team_member WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM teams_team WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM tracks_track WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM competitions_announcement WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM competitions_agenda_item WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM competitions_participant_profile WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM competitions_participation WHERE tenant_id = $1`, [TENANT_ID])
  await client.query(`DELETE FROM competitions_competition WHERE tenant_id = $1`, [TENANT_ID])
  console.log('Cleaned')

  // ===== COMPETITION =====
  const compRes = await client.query(`
    INSERT INTO competitions_competition (
      name, slug, description, location, starts_at, ends_at, timezone, stage,
      min_team_size, max_team_size, code_of_conduct_url,
      stage_config, demo_config, judging_config, peer_voting_config,
      tenant_id, organization_id, is_active, created_at, updated_at
    ) VALUES (
      'HackOn Sopot 2026', 'hackon-sopot-2026',
      'Pierwszy hackathon Open Mercato - 100% nastawiony na Agentic Software Engineering. 48 godzin kodowania, mentoring, nagrody i dużo zabawy!',
      'Sopot, Polska',
      $1, $2, 'Europe/Warsaw', 'HACKING',
      2, 5, 'https://hackon.openmercato.com/code-of-conduct',
      '{}', '{"presentationDurationMinutes": 5, "qaDurationMinutes": 3}',
      '{"rounds": 1, "preliminaryJudgesPerProject": 3}',
      '{"enabled": true, "votesPerPerson": 3}',
      $3, $4, true, $5, $5
    ) RETURNING id
  `, [daysFromNow(0, 18), daysFromNow(2, 12), TENANT_ID, ORG_ID, now])
  const compId = compRes.rows[0].id
  console.log(`Competition: ${compId}`)

  // ===== TRACKS =====
  const trackColors = ['#6366f1', '#ec4899', '#10b981', '#f59e0b']
  const tracks = [
    { name: 'AI & Agents', description: 'Build intelligent agents, LLM-powered tools, or AI-first applications', color: trackColors[0], order: 1 },
    { name: 'Developer Tools', description: 'Create tools that make developers more productive — CLIs, extensions, analyzers', color: trackColors[1], order: 2 },
    { name: 'Open Source', description: 'Contribute to or build new open source projects with real-world impact', color: trackColors[2], order: 3 },
    { name: 'Wild Card', description: 'Anything goes! Surprise the judges with your creativity', color: trackColors[3], order: 4 },
  ]
  const trackIds: string[] = []
  for (const t of tracks) {
    const res = await client.query(`
      INSERT INTO tracks_track (
        competition_id, name, description, color, "order", mentor_ids,
        tenant_id, organization_id, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, '[]', $6, $7, true, $8, $8) RETURNING id
    `, [compId, t.name, t.description, t.color, t.order, TENANT_ID, ORG_ID, now])
    trackIds.push(res.rows[0].id)
  }
  console.log(`Tracks: ${trackIds.length}`)

  // ===== PARTICIPATIONS =====
  const participants = [
    { userId: ALICE_ID, role: 'participant' },
    { userId: BOB_ID, role: 'participant' },
    { userId: CAROL_ID, role: 'judge' },
    { userId: PATRYK_ID, role: 'participant' },
  ]
  for (const p of participants) {
    await client.query(`
      INSERT INTO competitions_participation (
        competition_id, customer_user_id, role, checked_in, coc_accepted, coc_accepted_at,
        privacy_policy_accepted, profile_complete, looking_for_team,
        tenant_id, organization_id, created_at, updated_at
      ) VALUES ($1, $2, $3, true, true, $4, true, true, false, $5, $6, $4, $4)
    `, [compId, p.userId, p.role, now, TENANT_ID, ORG_ID])
  }
  console.log(`Participations: ${participants.length}`)

  // ===== TEAMS =====
  const teamData = [
    { name: 'Agent Smiths', description: 'Building the future of autonomous coding agents', trackIdx: 0, members: [PATRYK_ID, ALICE_ID], finalist: true, table: 1 },
    { name: 'DevToolz', description: 'Making developer experience 10x better', trackIdx: 1, members: [BOB_ID], finalist: false, table: 2 },
  ]
  const teamIds: string[] = []
  for (const t of teamData) {
    const res = await client.query(`
      INSERT INTO teams_team (
        competition_id, track_id, name, description, status, is_finalist,
        table_number, table_location, presentation_order,
        tenant_id, organization_id, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, 'ACTIVE', $5, $6, 'Main Hall', $6,
        $7, $8, true, $9, $9) RETURNING id
    `, [compId, trackIds[t.trackIdx], t.name, t.description, t.finalist, t.table, TENANT_ID, ORG_ID, now])
    teamIds.push(res.rows[0].id)

    // Add team members
    for (let i = 0; i < t.members.length; i++) {
      await client.query(`
        INSERT INTO teams_team_member (
          team_id, customer_user_id, competition_id, role, joined_at,
          tenant_id, organization_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [res.rows[0].id, t.members[i], compId, i === 0 ? 'OWNER' : 'MEMBER', now, TENANT_ID, ORG_ID])
    }
  }
  console.log(`Teams: ${teamIds.length}`)

  // ===== PROJECTS =====
  const projects = [
    {
      teamId: teamIds[0], trackId: trackIds[0],
      title: 'CodePilot Agent',
      tagline: 'Your autonomous pair programmer that actually understands context',
      description: 'An AI agent that integrates with your IDE, understands your entire codebase, and can autonomously implement features, fix bugs, and write tests.',
      problemStatement: 'Developers spend 60% of their time understanding existing code before making changes.',
      solution: 'A context-aware AI agent that maintains a semantic understanding of your codebase and can navigate, modify, and test code autonomously.',
      techStack: ['TypeScript', 'Claude API', 'Tree-sitter', 'VS Code Extension API'],
      status: 'PUBLISHED',
    },
    {
      teamId: teamIds[1], trackId: trackIds[1],
      title: 'Schema Drift Detector',
      tagline: 'Never break your API consumers again',
      description: 'A CI/CD tool that detects breaking changes in API schemas, database migrations, and event contracts before they reach production.',
      problemStatement: 'Breaking changes in APIs and schemas cause cascading failures across microservices.',
      solution: 'Automated schema diff analysis in CI pipelines with impact analysis and consumer notification.',
      techStack: ['Go', 'OpenAPI', 'Protocol Buffers', 'GitHub Actions'],
      status: 'DRAFT',
    },
  ]
  const projectIds: string[] = []
  for (const p of projects) {
    const res = await client.query(`
      INSERT INTO projects_project (
        team_id, competition_id, track_id, title, tagline, description,
        problem_statement, solution, tech_stack, status,
        submitted_at, uses_preexisting_code, flagged_for_reuse,
        tenant_id, organization_id, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        ${p.status === 'PUBLISHED' ? `'${now}'` : 'NULL'},
        false, false, $11, $12, true, $13, $13) RETURNING id
    `, [p.teamId, compId, p.trackId, p.title, p.tagline, p.description,
        p.problemStatement, p.solution, JSON.stringify(p.techStack), p.status,
        TENANT_ID, ORG_ID, now])
    projectIds.push(res.rows[0].id)
  }
  console.log(`Projects: ${projectIds.length}`)

  // ===== JUDGING CRITERIA =====
  const criteria = [
    { name: 'Innovation', description: 'How novel and creative is the solution?', maxScore: 10, weight: 0.3, order: 1 },
    { name: 'Technical Execution', description: 'Code quality, architecture, and technical complexity', maxScore: 10, weight: 0.25, order: 2 },
    { name: 'Impact', description: 'Real-world usefulness and potential impact', maxScore: 10, weight: 0.25, order: 3 },
    { name: 'Presentation', description: 'Clarity of demo and communication', maxScore: 10, weight: 0.2, order: 4 },
  ]
  const criterionIds: string[] = []
  for (const c of criteria) {
    const res = await client.query(`
      INSERT INTO judging_criterion (
        competition_id, round, name, description, max_score, weight, "order",
        tenant_id, organization_id, created_at
      ) VALUES ($1, 'BOTH', $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id
    `, [compId, c.name, c.description, c.maxScore, c.weight, c.order, TENANT_ID, ORG_ID, now])
    criterionIds.push(res.rows[0].id)
  }
  console.log(`Judging criteria: ${criterionIds.length}`)

  // ===== JUDGE PANEL =====
  const panelRes = await client.query(`
    INSERT INTO judging_panel (
      competition_id, name, round, tenant_id, organization_id, created_at
    ) VALUES ($1, 'Main Panel', 'PRELIMINARY', $2, $3, $4) RETURNING id
  `, [compId, TENANT_ID, ORG_ID, now])
  const panelId = panelRes.rows[0].id

  // Add Carol as judge on the panel
  await client.query(`
    INSERT INTO judging_panel_judge (
      panel_id, judge_id, tenant_id, organization_id
    ) VALUES ($1, $2, $3, $4)
  `, [panelId, CAROL_ID, TENANT_ID, ORG_ID])

  // Assign all tracks to panel
  for (const tId of trackIds) {
    await client.query(`
      INSERT INTO judging_panel_track (
        panel_id, track_id, tenant_id, organization_id
      ) VALUES ($1, $2, $3, $4)
    `, [panelId, tId, TENANT_ID, ORG_ID])
  }
  console.log(`Judge panel: ${panelId}`)

  // ===== SPONSORS =====
  const sponsors = [
    { name: 'Anthropic', tier: 'TITLE', logo: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Anthropic_logo.svg', website: 'https://anthropic.com', challenge: 'Best Agentic Application', order: 1 },
    { name: 'Vercel', tier: 'GOLD', logo: 'https://assets.vercel.com/image/upload/v1588805858/repositories/vercel/logo.png', website: 'https://vercel.com', challenge: 'Best Developer Experience', order: 2 },
    { name: 'Supabase', tier: 'SILVER', logo: 'https://supabase.com/brand-assets/supabase-logo-icon.svg', website: 'https://supabase.com', challenge: null, order: 3 },
    { name: 'JetBrains', tier: 'PARTNER', logo: 'https://resources.jetbrains.com/storage/products/company/brand/logos/jetbrains.svg', website: 'https://jetbrains.com', challenge: null, order: 4 },
  ]
  const sponsorIds: string[] = []
  for (const s of sponsors) {
    const res = await client.query(`
      INSERT INTO sponsors_sponsor (
        competition_id, name, tier, logo_url, website_url, challenge_title, "order",
        is_visible, tenant_id, organization_id, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, true, $8, $9, true, $10, $10) RETURNING id
    `, [compId, s.name, s.tier, s.logo, s.website, s.challenge, s.order, TENANT_ID, ORG_ID, now])
    sponsorIds.push(res.rows[0].id)
  }
  console.log(`Sponsors: ${sponsorIds.length}`)

  // ===== PRIZES =====
  const prizes = [
    { name: 'Grand Prize', category: 'SPECIAL_AWARD', value: '€5,000 + Anthropic API credits', rank: 1, order: 1 },
    { name: '1st Place AI & Agents', category: 'TRACK_PLACEMENT', trackId: trackIds[0], value: '€2,000', rank: 1, order: 2 },
    { name: '1st Place Developer Tools', category: 'TRACK_PLACEMENT', trackId: trackIds[1], value: '€2,000', rank: 1, order: 3 },
    { name: 'Best Agentic Application', category: 'SPONSOR_PRIZE', sponsorId: sponsorIds[0], value: '€1,000 + 1 year Claude Team', order: 4 },
    { name: "People's Choice", category: 'PEOPLES_CHOICE', value: '€500 + swag bundle', order: 5 },
  ]
  for (const p of prizes) {
    await client.query(`
      INSERT INTO sponsors_prize (
        competition_id, name, category, value, rank, "order",
        ${p.trackId ? 'track_id,' : ''} ${p.sponsorId ? 'sponsor_id,' : ''}
        tenant_id, organization_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6,
        ${p.trackId ? `'${p.trackId}',` : ''} ${p.sponsorId ? `'${p.sponsorId}',` : ''}
        $7, $8, $9, $9)
    `, [compId, p.name, p.category, p.value, p.rank ?? null, p.order, TENANT_ID, ORG_ID, now])
  }
  console.log(`Prizes: ${prizes.length}`)

  // ===== AGENDA =====
  const agenda = [
    { title: 'Registration & Check-in', type: 'ceremony', startsAt: daysFromNow(0, 17), endsAt: daysFromNow(0, 18), mandatory: true, order: 1 },
    { title: 'Opening Ceremony & Keynote', type: 'ceremony', startsAt: daysFromNow(0, 18), endsAt: daysFromNow(0, 19), mandatory: true, order: 2 },
    { title: 'Team Formation Mixer', type: 'workshop', startsAt: daysFromNow(0, 19), endsAt: daysFromNow(0, 20), mandatory: false, order: 3 },
    { title: 'Hacking Begins!', type: 'deadline', startsAt: daysFromNow(0, 20), endsAt: daysFromNow(0, 20, 15), mandatory: true, order: 4 },
    { title: 'Midnight Snacks', type: 'meal', startsAt: daysFromNow(1, 0), endsAt: daysFromNow(1, 1), mandatory: false, order: 5 },
    { title: 'Workshop: Building with Claude API', type: 'talk', startsAt: daysFromNow(1, 10), endsAt: daysFromNow(1, 11), speaker: 'Alex Chen', mandatory: false, order: 6 },
    { title: 'Lunch', type: 'meal', startsAt: daysFromNow(1, 12), endsAt: daysFromNow(1, 13), mandatory: false, order: 7 },
    { title: 'Mentor Office Hours', type: 'workshop', startsAt: daysFromNow(1, 14), endsAt: daysFromNow(1, 16), mandatory: false, order: 8 },
    { title: 'Project Submission Deadline', type: 'deadline', startsAt: daysFromNow(2, 9), endsAt: daysFromNow(2, 9, 15), mandatory: true, order: 9 },
    { title: 'Demo Presentations', type: 'demo_session', startsAt: daysFromNow(2, 10), endsAt: daysFromNow(2, 12), mandatory: true, order: 10 },
    { title: 'Judging & Deliberation', type: 'custom', startsAt: daysFromNow(2, 12), endsAt: daysFromNow(2, 14), mandatory: false, order: 11 },
    { title: 'Awards Ceremony & Closing', type: 'ceremony', startsAt: daysFromNow(2, 14), endsAt: daysFromNow(2, 15), mandatory: true, order: 12 },
  ]
  for (const a of agenda) {
    await client.query(`
      INSERT INTO competitions_agenda_item (
        competition_id, title, type, starts_at, ends_at, is_mandatory, "order",
        ${a.speaker ? 'speaker_name,' : ''}
        tenant_id, organization_id, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7,
        ${a.speaker ? `'${a.speaker}',` : ''}
        $8, $9, $10, $10)
    `, [compId, a.title, a.type, a.startsAt, a.endsAt, a.mandatory, a.order, TENANT_ID, ORG_ID, now])
  }
  console.log(`Agenda items: ${agenda.length}`)

  // ===== ANNOUNCEMENTS =====
  const announcements = [
    { title: 'Welcome to HackOn Sopot 2026!', content: 'We are thrilled to have you here! Check the agenda for the full schedule. WiFi password: hack0n2026. Remember to check in at the registration desk.', priority: 'info', pinned: true },
    { title: 'API Credits Available', content: 'All participants have been granted $100 in Anthropic API credits. Check your email for the activation link. Credits expire 7 days after the event.', priority: 'info', pinned: false },
    { title: 'Submission Deadline Reminder', content: 'Projects must be submitted by tomorrow at 9:00 AM CET. Make sure your repo is public and the demo link works!', priority: 'warning', pinned: true },
  ]
  for (const a of announcements) {
    await client.query(`
      INSERT INTO competitions_announcement (
        competition_id, author_id, title, content, priority, target_roles, target_track_ids,
        pinned, published_at, tenant_id, organization_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, '[]', '[]', $6, $7, $8, $9, $7)
    `, [compId, ADMIN_USER_ID, a.title, a.content, a.priority, a.pinned, now, TENANT_ID, ORG_ID])
  }
  console.log(`Announcements: ${announcements.length}`)

  // ===== INCIDENT =====
  await client.query(`
    INSERT INTO incidents_report (
      competition_id, reporter_id, description, severity, status,
      tenant_id, organization_id, created_at, updated_at
    ) VALUES ($1, $2, 'Loud music from the break area is making it hard to concentrate in the coding zone. Could we lower the volume or set quiet hours?',
      'LOW', 'REPORTED', $3, $4, $5, $5)
  `, [compId, ALICE_ID, TENANT_ID, ORG_ID, now])
  console.log('Incident: 1')

  console.log('\n✅ HackOn demo data seeded successfully!')
  console.log(`   Competition: HackOn Sopot 2026 (${compId})`)
  console.log(`   Tracks: ${trackIds.length}`)
  console.log(`   Teams: ${teamIds.length}`)
  console.log(`   Projects: ${projectIds.length}`)
  console.log(`   Sponsors: ${sponsorIds.length}`)
  console.log(`   Prizes: ${prizes.length}`)
  console.log(`   Agenda: ${agenda.length}`)
  console.log(`   Announcements: ${announcements.length}`)

  await client.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  client.end()
  process.exit(1)
})
