"use client"

import * as React from 'react'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalCompetitionLayout } from '../../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../../competitions/components/CompetitionContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@open-mercato/shared/lib/utils'

type LeaderboardTeam = {
  teamId: string
  teamName: string
  totalPoints: number
  rank: number
  members: Array<{
    participantId: string
    name: string
    githubUsername: string
    points: number
    prCount: number
  }>
}

type LeaderboardData = {
  teams: LeaderboardTeam[]
  lastUpdated: string
}

function KioskContent() {
  const { selectedId: competitionId } = useCompetitionContext()
  const [clock, setClock] = React.useState(() => new Date())

  React.useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const { data, dataUpdatedAt } = useQuery<LeaderboardData>({
    queryKey: ['kiosk-bounty-leaderboard', competitionId],
    queryFn: async () => {
      const params = new URLSearchParams({
        competition_id: competitionId ?? 'current',
        organization_id: 'current',
      })
      const { ok, result } = await apiCall<LeaderboardData>(`/api/bounties/leaderboard?${params}`)
      return ok && result ? result : { teams: [], lastUpdated: new Date().toISOString() }
    },
    enabled: !!competitionId,
    refetchInterval: 5000,
  })

  const MOCK_TEAMS: LeaderboardTeam[] = [
    { teamId: '1', teamName: 'Quantum Forge', totalPoints: 47, rank: 1, members: [
      { participantId: '1a', name: 'Alice Chen', githubUsername: 'alicec', points: 22, prCount: 4 },
      { participantId: '1b', name: 'Bob Kowalski', githubUsername: 'bobkow', points: 15, prCount: 3 },
      { participantId: '1c', name: 'Carla Diaz', githubUsername: 'carladiaz', points: 10, prCount: 2 },
    ]},
    { teamId: '2', teamName: 'Neural Architects', totalPoints: 41, rank: 2, members: [
      { participantId: '2a', name: 'Dan Park', githubUsername: 'danpark', points: 21, prCount: 5 },
      { participantId: '2b', name: 'Eva Novak', githubUsername: 'evanovak', points: 20, prCount: 4 },
    ]},
    { teamId: '3', teamName: 'Byte Brigade', totalPoints: 38, rank: 3, members: [
      { participantId: '3a', name: 'Frank Muller', githubUsername: 'frankm', points: 18, prCount: 3 },
      { participantId: '3b', name: 'Grace Liu', githubUsername: 'graceliu', points: 12, prCount: 2 },
      { participantId: '3c', name: 'Hiro Tanaka', githubUsername: 'hirot', points: 8, prCount: 2 },
    ]},
    { teamId: '4', teamName: 'Rust Riders', totalPoints: 33, rank: 4, members: [
      { participantId: '4a', name: 'Ivan Petrov', githubUsername: 'ivanp', points: 18, prCount: 3 },
      { participantId: '4b', name: 'Jade Smith', githubUsername: 'jadesmith', points: 15, prCount: 3 },
    ]},
    { teamId: '5', teamName: 'Pixel Pioneers', totalPoints: 29, rank: 5, members: [
      { participantId: '5a', name: 'Kira Jensen', githubUsername: 'kiraj', points: 15, prCount: 3 },
      { participantId: '5b', name: 'Leo Garcia', githubUsername: 'leog', points: 14, prCount: 2 },
    ]},
    { teamId: '6', teamName: 'Stack Overflow', totalPoints: 27, rank: 6, members: [
      { participantId: '6a', name: 'Mia Wong', githubUsername: 'miaw', points: 15, prCount: 3 },
      { participantId: '6b', name: 'Noah Kim', githubUsername: 'noahkim', points: 12, prCount: 2 },
    ]},
    { teamId: '7', teamName: 'Code Crusaders', totalPoints: 24, rank: 7, members: [
      { participantId: '7a', name: 'Olivia Brown', githubUsername: 'oliviab', points: 14, prCount: 3 },
      { participantId: '7b', name: 'Pawel Zak', githubUsername: 'pawelz', points: 10, prCount: 2 },
    ]},
    { teamId: '8', teamName: 'Lambda Lords', totalPoints: 22, rank: 8, members: [
      { participantId: '8a', name: 'Quinn Adams', githubUsername: 'quinnad', points: 12, prCount: 2 },
      { participantId: '8b', name: 'Rosa Martinez', githubUsername: 'rosam', points: 10, prCount: 2 },
    ]},
    { teamId: '9', teamName: 'Syntax Error', totalPoints: 19, rank: 9, members: [
      { participantId: '9a', name: 'Sam Taylor', githubUsername: 'samt', points: 10, prCount: 2 },
      { participantId: '9b', name: 'Tina Nguyen', githubUsername: 'tinan', points: 9, prCount: 2 },
    ]},
    { teamId: '10', teamName: 'Binary Bandits', totalPoints: 17, rank: 10, members: [
      { participantId: '10a', name: 'Uma Patel', githubUsername: 'umap', points: 10, prCount: 2 },
      { participantId: '10b', name: 'Viktor Sokolov', githubUsername: 'viktors', points: 7, prCount: 1 },
    ]},
    { teamId: '11', teamName: 'Async Avengers', totalPoints: 15, rank: 11, members: [
      { participantId: '11a', name: 'Wendy Clark', githubUsername: 'wendyc', points: 8, prCount: 2 },
      { participantId: '11b', name: 'Xander Lee', githubUsername: 'xanderl', points: 7, prCount: 1 },
    ]},
    { teamId: '12', teamName: 'Null Pointers', totalPoints: 14, rank: 12, members: [
      { participantId: '12a', name: 'Yara Hassan', githubUsername: 'yarah', points: 8, prCount: 2 },
      { participantId: '12b', name: 'Zach Miller', githubUsername: 'zachm', points: 6, prCount: 1 },
    ]},
    { teamId: '13', teamName: 'Git Pushers', totalPoints: 12, rank: 13, members: [
      { participantId: '13a', name: 'Ania Kowal', githubUsername: 'aniak', points: 7, prCount: 2 },
      { participantId: '13b', name: 'Ben Wright', githubUsername: 'benw', points: 5, prCount: 1 },
    ]},
    { teamId: '14', teamName: 'Merge Conflict', totalPoints: 11, rank: 14, members: [
      { participantId: '14a', name: 'Celine Dubois', githubUsername: 'celined', points: 6, prCount: 1 },
      { participantId: '14b', name: 'David Okafor', githubUsername: 'davido', points: 5, prCount: 1 },
    ]},
    { teamId: '15', teamName: 'Daemon Threads', totalPoints: 10, rank: 15, members: [
      { participantId: '15a', name: 'Erik Svensson', githubUsername: 'eriks', points: 5, prCount: 1 },
      { participantId: '15b', name: 'Fatima Reza', githubUsername: 'fatimar', points: 5, prCount: 1 },
    ]},
    { teamId: '16', teamName: 'Cache Money', totalPoints: 8, rank: 16, members: [
      { participantId: '16a', name: 'George Popa', githubUsername: 'georgep', points: 5, prCount: 1 },
      { participantId: '16b', name: 'Hannah Berg', githubUsername: 'hannahb', points: 3, prCount: 1 },
    ]},
    { teamId: '17', teamName: 'Type Safety', totalPoints: 7, rank: 17, members: [
      { participantId: '17a', name: 'Igor Volkov', githubUsername: 'igorv', points: 5, prCount: 1 },
      { participantId: '17b', name: 'Julia Costa', githubUsername: 'juliac', points: 2, prCount: 1 },
    ]},
    { teamId: '18', teamName: 'Segfault Squad', totalPoints: 5, rank: 18, members: [
      { participantId: '18a', name: 'Karl Braun', githubUsername: 'karlb', points: 3, prCount: 1 },
      { participantId: '18b', name: 'Luna Torres', githubUsername: 'lunat', points: 2, prCount: 1 },
    ]},
    { teamId: '19', teamName: 'Heap Overflow', totalPoints: 3, rank: 19, members: [
      { participantId: '19a', name: 'Marco Ricci', githubUsername: 'marcor', points: 2, prCount: 1 },
      { participantId: '19b', name: 'Nadia Popov', githubUsername: 'nadiap', points: 1, prCount: 1 },
    ]},
    { teamId: '20', teamName: 'Fresh Starters', totalPoints: 1, rank: 20, members: [
      { participantId: '20a', name: 'Oscar Lund', githubUsername: 'oscarl', points: 1, prCount: 1 },
      { participantId: '20b', name: 'Priya Sharma', githubUsername: 'priyas', points: 0, prCount: 0 },
    ]},
  ]

  const teams = MOCK_TEAMS
  const totalPoints = teams.reduce((s, t) => s + t.totalPoints, 0)
  const totalPRs = teams.reduce((s, t) => s + t.members.reduce((ms, m) => ms + m.prCount, 0), 0)
  const localTime = clock.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  // Leader for the hero section
  const leader = teams[0] ?? null

  return (
    <div className="min-h-screen bg-portal-dark flex flex-col relative overflow-hidden">
      {/* Ambient glow behind the leader */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: leader
            ? 'radial-gradient(ellipse 60% 40% at 50% 20%, rgba(79,70,229,0.08) 0%, transparent 70%)'
            : 'none',
        }}
      />

      {/* ── Top status bar ── */}
      <div className="relative flex items-center justify-between px-[4vw] py-[2vh]">
        <div className="flex items-center gap-3">
          <span className="size-2.5 rounded-full bg-green-400 animate-pulse" />
          <span className="text-[1.4vh] font-medium uppercase tracking-[0.25em] text-white/50">
            Live Bounty Hunting
          </span>
        </div>
        <div className="flex items-center gap-8 text-white/40">
          {/* Stats inline */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="text-[1.2vh] uppercase tracking-widest text-white/30">Teams</span>
              <span className="text-[2vh] font-mono font-bold text-white/60 tabular-nums">{teams.length}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[1.2vh] uppercase tracking-widest text-white/30">Points</span>
              <span className="text-[2vh] font-mono font-bold text-white/60 tabular-nums">{totalPoints}</span>
            </div>
            <div className="h-4 w-px bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-[1.2vh] uppercase tracking-widest text-white/30">PRs</span>
              <span className="text-[2vh] font-mono font-bold text-white/60 tabular-nums">{totalPRs}</span>
            </div>
          </div>

          <div className="h-8 w-px bg-white/10" />

          <div className="text-right">
            <span className="text-[1.2vh] uppercase tracking-widest block">Local Time</span>
            <span className="text-[2vh] font-mono font-bold text-white/60">{localTime}</span>
          </div>
          <div className="text-right">
            <span className="text-[1.2vh] uppercase tracking-widest block">Status</span>
            <span className="text-[2vh] font-bold text-green-400">Active</span>
          </div>
        </div>
      </div>

      <div className="h-px bg-white/[0.06]" />

      {/* ── Hero: Leading team ── */}
      {leader ? (
        <div className="relative flex-shrink-0 px-[4vw] pt-[5vh] pb-[4vh]">
          <div className="flex items-center gap-4 mb-[2vh]">
            <span className="text-portal-primary text-[1.8vh] font-semibold uppercase tracking-[0.25em]">
              Leading Team
            </span>
            <div className="h-px flex-1 max-w-16 bg-portal-primary/40" />
          </div>

          <div className="flex items-end justify-between">
            <div className="flex-1 min-w-0">
              <h1
                className="text-white font-extrabold uppercase leading-[0.9] tracking-tight"
                style={{ fontSize: 'clamp(48px, 8vw, 120px)' }}
              >
                {leader.teamName}
              </h1>
              <div className="flex items-center gap-4 mt-[1.5vh]">
                {leader.members.map((m, i) => (
                  <React.Fragment key={m.participantId}>
                    {i > 0 && <span className="text-white/20">·</span>}
                    <span className="text-white/40 text-[1.8vh]">
                      @{m.githubUsername}
                      <span className="text-white/60 font-semibold ml-2">{m.points} pts</span>
                    </span>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Points display */}
            <div className="text-right flex-shrink-0 ml-8">
              <span
                className="font-extrabold tabular-nums text-white leading-none block"
                style={{ fontSize: 'clamp(60px, 10vw, 140px)' }}
              >
                {leader.totalPoints}
              </span>
              <span className="text-[1.4vh] font-semibold uppercase tracking-[0.3em] text-portal-primary">
                Points
              </span>
            </div>
          </div>

          {/* Progress accent bar */}
          <div className="mt-[3vh] h-1 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-portal-primary transition-all duration-1000"
              style={{ width: totalPoints > 0 ? '100%' : '0%' }}
            />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-white/20 text-[4vh]">Waiting for approved submissions...</p>
          </div>
        </div>
      )}

      {/* ── Rankings table ── */}
      {teams.length > 0 && (
        <div className="relative flex-1 px-[4vw] pb-[3vh] overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center gap-4 mb-[1.5vh] px-4">
            <span className="text-[1.2vh] font-medium uppercase tracking-[0.2em] text-white/25 w-12 text-center">Rank</span>
            <span className="text-[1.2vh] font-medium uppercase tracking-[0.2em] text-white/25 flex-1">Team</span>
            <span className="text-[1.2vh] font-medium uppercase tracking-[0.2em] text-white/25 w-20 text-right">PRs</span>
            <span className="text-[1.2vh] font-medium uppercase tracking-[0.2em] text-white/25 w-28 text-right">Points</span>
          </div>

          <div className="space-y-[0.6vh]">
            {teams.map((team, idx) => {
              const isLeader = idx === 0
              const isTop3 = idx < 3

              return (
                <div
                  key={team.teamId}
                  className={cn(
                    'flex items-center gap-4 rounded-lg px-4 transition-all duration-700',
                    isLeader
                      ? 'bg-portal-primary/[0.08] border border-portal-primary/20 py-[1.8vh]'
                      : isTop3
                        ? 'bg-white/[0.03] border border-white/[0.06] py-[1.5vh]'
                        : 'bg-transparent border border-transparent py-[1.2vh]',
                  )}
                >
                  {/* Rank */}
                  <div className="w-12 text-center flex-shrink-0">
                    <span
                      className={cn(
                        'font-bold tabular-nums',
                        isLeader ? 'text-portal-primary text-[3vh]'
                          : isTop3 ? 'text-white/60 text-[2.5vh]'
                          : 'text-white/25 text-[2vh]',
                      )}
                    >
                      {String(team.rank).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Team name + members */}
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        'font-bold uppercase tracking-wide block truncate',
                        isLeader ? 'text-white text-[2.5vh]'
                          : isTop3 ? 'text-white/90 text-[2.2vh]'
                          : 'text-white/50 text-[2vh]',
                      )}
                    >
                      {team.teamName}
                    </span>
                    <span className="text-[1.2vh] text-white/25 truncate block">
                      {team.members.map(m => `@${m.githubUsername}`).join('  ·  ')}
                    </span>
                  </div>

                  {/* PR count */}
                  <div className="w-20 text-right flex-shrink-0">
                    <span className={cn(
                      'font-mono tabular-nums',
                      isLeader ? 'text-white/60 text-[2vh]' : 'text-white/30 text-[1.8vh]',
                    )}>
                      {team.members.reduce((s, m) => s + m.prCount, 0)}
                    </span>
                  </div>

                  {/* Points */}
                  <div className="w-28 text-right flex-shrink-0">
                    <span
                      className={cn(
                        'font-extrabold tabular-nums',
                        isLeader ? 'text-portal-primary text-[3.5vh]'
                          : isTop3 ? 'text-white text-[3vh]'
                          : 'text-white/40 text-[2.5vh]',
                      )}
                    >
                      {team.totalPoints}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Bottom bar ── */}
      <div className="relative flex items-center justify-between px-[4vw] py-[1.5vh] bg-white/[0.02] border-t border-white/[0.06]">
        <span className="text-[1.2vh] uppercase tracking-[0.2em] text-white/20">
          Bounty Hunting Leaderboard
        </span>
        {dataUpdatedAt > 0 && (
          <span className="text-[1.2vh] uppercase tracking-[0.2em] text-white/20">
            Updated {new Date(dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        )}
      </div>
    </div>
  )
}

export default function KioskPage() {
  const { auth } = usePortalContext()
  if (auth.loading || !auth.user) return <div className="min-h-screen bg-portal-dark" />

  return (
    <PortalCompetitionLayout>
      <KioskContent />
    </PortalCompetitionLayout>
  )
}
