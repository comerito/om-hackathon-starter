"use client"

import * as React from 'react'

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

const rankColors = ['#FFD700', '#C0C0C0', '#CD7F32']

export default function BountyKioskPage() {
  const [data, setData] = React.useState<LeaderboardData | null>(null)
  const [prevData, setPrevData] = React.useState<LeaderboardData | null>(null)

  // Poll for leaderboard data
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const params = new URLSearchParams({
          competition_id: 'current',
          organization_id: 'current',
        })
        const res = await fetch(`/api/bounties/leaderboard?${params}`)
        if (res.ok) {
          const newData = await res.json()
          setData(prev => {
            setPrevData(prev)
            return newData
          })
        }
      } catch {
        // Silently retry on next interval
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  // Track rank changes for animation
  const prevRanks = React.useMemo(() => {
    if (!prevData) return new Map<string, number>()
    return new Map(prevData.teams.map(t => [t.teamId, t.rank]))
  }, [prevData])

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-12 py-8 border-b border-gray-800">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="text-yellow-400">Bounty Hunting</span> Leaderboard
        </h1>
        <div className="text-gray-400 text-lg">
          {data?.lastUpdated && new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Leaderboard */}
      <div className="flex-1 overflow-y-auto px-12 py-8">
        <div className="space-y-4">
          {(data?.teams ?? []).map((team, index) => {
            const prevRank = prevRanks.get(team.teamId)
            const rankChanged = prevRank != null && prevRank !== team.rank

            return (
              <div
                key={team.teamId}
                className="flex items-center gap-6 rounded-xl p-6 transition-all duration-700 ease-in-out"
                style={{
                  backgroundColor: index < 3 ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.02)',
                  borderLeft: index < 3 ? `4px solid ${rankColors[index]}` : '4px solid transparent',
                  transform: rankChanged ? 'scale(1.02)' : 'scale(1)',
                }}
              >
                {/* Rank */}
                <div className="text-5xl font-black w-20 text-center" style={{ color: rankColors[index] ?? '#9CA3AF' }}>
                  {team.rank}
                </div>

                {/* Team info */}
                <div className="flex-1">
                  <div className="text-3xl font-bold">{team.teamName}</div>
                  <div className="text-gray-400 text-lg mt-1">
                    {team.members.map(m => `@${m.githubUsername}`).join('  ·  ')}
                  </div>
                </div>

                {/* Points */}
                <div className="text-right">
                  <div className="text-5xl font-black tabular-nums" style={{ color: rankColors[index] ?? '#E5E7EB' }}>
                    {team.totalPoints}
                  </div>
                  <div className="text-gray-500 text-lg">points</div>
                </div>
              </div>
            )
          })}

          {(data?.teams ?? []).length === 0 && (
            <div className="text-center py-24">
              <div className="text-6xl mb-6">🏆</div>
              <div className="text-3xl text-gray-500">Awaiting submissions...</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer branding */}
      <div className="px-12 py-4 border-t border-gray-800 text-gray-600 text-sm text-center">
        HackOn — Open Mercato Hackathon
      </div>
    </div>
  )
}
