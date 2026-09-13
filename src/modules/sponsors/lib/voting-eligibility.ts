/**
 * Peer ("People's Choice") voting eligibility.
 *
 * The single place that answers *"is peer voting open for this competition
 * right now?"*. Pure logic — no ORM, no request context — so both the write
 * route (`api/portal/cast-vote`) and any read route that has to tell the portal
 * whether to offer a vote button derive their answer from the same rule.
 *
 * The window has two independent gates, checked in this order:
 *
 * 1. `peerVotingConfig.enabled` — the organiser switch.
 * 2. The **competition stage** — voting is open from {@link VOTING_OPENS_AT_STAGE}
 *    (inclusive) until {@link VOTING_CLOSES_AT_STAGE} (exclusive). This is the
 *    gate that actually closes voting in practice; see the note below.
 * 3. The optional explicit `votingStartsAt` / `votingEndsAt` instants, which can
 *    only narrow the stage window further, never widen it.
 *
 * Why the stage is the authoritative gate: `peerVotingConfig.votingEndsAt` is
 * `null` on every competition created by the back office (there is no field to
 * set it), so a date-only check never fires and voting stays open through
 * `deliberation`, `finished` and `archived` — votes landing after the results
 * are computed. The stage transition is the thing an organiser actually
 * performs, and the advance-to-deliberation dialog already promises
 * "Judges deliberate. Voting closes."
 */
import { CompetitionStage, STAGE_ORDER } from '../../competitions/data/entities'

export type PeerVotingConfig = {
  enabled?: boolean
  votesPerPerson?: number
  votingStartsAt?: string | null
  votingEndsAt?: string | null
  allowVoteChange?: boolean
}

/** Fallback used when `peerVotingConfig.votesPerPerson` is absent. */
export const DEFAULT_VOTES_PER_PERSON = 3

/**
 * First stage in which peer voting is open. Projects only exist from `hacking`
 * onwards (drafts are auto-created on entering it), so nothing is votable
 * before that.
 */
export const VOTING_OPENS_AT_STAGE: CompetitionStage = CompetitionStage.HACKING

/**
 * First stage in which peer voting is closed again — voting is open for every
 * stage strictly before this one and at or after {@link VOTING_OPENS_AT_STAGE},
 * i.e. `hacking` and `demos`.
 */
export const VOTING_CLOSES_AT_STAGE: CompetitionStage = CompetitionStage.DELIBERATION

export type VotingWindowReason =
  | 'voting_disabled'
  | 'voting_not_open_yet'
  | 'voting_closed'
  | 'voting_window_not_started'
  | 'voting_window_ended'

export type VotingWindowState =
  | { open: true }
  | { open: false; reason: VotingWindowReason; message: string }

/**
 * Default English copy for each reason. The portal translates by `reason`; these
 * strings are what an API client (and the fallback UI path) sees.
 */
export const VOTING_WINDOW_MESSAGES: Record<VotingWindowReason, string> = {
  voting_disabled: 'Peer voting is not enabled for this competition',
  voting_not_open_yet: 'Voting has not opened yet',
  voting_closed: 'Voting has closed for this competition',
  voting_window_not_started: 'Voting has not opened yet',
  voting_window_ended: 'The voting window has closed',
}

function closed(reason: VotingWindowReason): VotingWindowState {
  return { open: false, reason, message: VOTING_WINDOW_MESSAGES[reason] }
}

function stageIndex(stage: string | null | undefined): number {
  if (typeof stage !== 'string') return -1
  return STAGE_ORDER.indexOf(stage as CompetitionStage)
}

/**
 * Parse a configured instant. Anything missing, blank or unparseable is treated
 * as "not configured" rather than as an error: a malformed bound must not close
 * voting that the stage says is open, nor open voting the stage says is closed.
 */
function parseInstant(value: string | null | undefined): number | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  const ts = Date.parse(trimmed)
  return Number.isNaN(ts) ? null : ts
}

/**
 * Is the competition in a stage where peer voting is open?
 *
 * An unknown stage string fails **closed** — a competition whose stage we cannot
 * place in `STAGE_ORDER` is corrupt data, and accepting votes into it is the
 * outcome that cannot be undone.
 */
export function isVotingStage(stage: string | null | undefined): boolean {
  const idx = stageIndex(stage)
  if (idx < 0) return false
  return idx >= stageIndex(VOTING_OPENS_AT_STAGE) && idx < stageIndex(VOTING_CLOSES_AT_STAGE)
}

/**
 * Evaluate whether peer voting is open for a competition at a point in time.
 *
 * Returns `{ open: true }` or a closed state carrying a machine-readable
 * `reason` (so the portal can translate it) and a human-readable `message` (so
 * an API client that does not know the reason codes still gets something it can
 * show).
 */
export function evaluateVotingWindow(input: {
  stage: string | null | undefined
  config?: PeerVotingConfig | null
  now?: Date
}): VotingWindowState {
  const { stage, config } = input
  const now = (input.now ?? new Date()).getTime()

  if (config?.enabled === false) return closed('voting_disabled')

  const idx = stageIndex(stage)
  if (idx < 0) return closed('voting_closed')
  if (idx < stageIndex(VOTING_OPENS_AT_STAGE)) return closed('voting_not_open_yet')
  if (idx >= stageIndex(VOTING_CLOSES_AT_STAGE)) return closed('voting_closed')

  const startsAt = parseInstant(config?.votingStartsAt)
  if (startsAt !== null && now < startsAt) return closed('voting_window_not_started')

  const endsAt = parseInstant(config?.votingEndsAt)
  if (endsAt !== null && now > endsAt) return closed('voting_window_ended')

  return { open: true }
}
