import type { ModuleInfo } from '@open-mercato/shared/modules/registry'

export const metadata: ModuleInfo = {
  name: 'bounties',
  title: 'Bounties',
  version: '0.1.0',
  description: 'Bounty hunting track — GitHub PR detection, LLM classification, judging, and leaderboard.',
}

export { features } from './acl'
