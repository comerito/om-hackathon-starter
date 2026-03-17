'use client'

import { useT } from '@open-mercato/shared/lib/i18n/context'

export default function CompetitionsPage() {
  const t = useT()
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Competitions</h1>
      <p className="text-muted-foreground mt-2">Competition management — coming in Step 1</p>
    </div>
  )
}
