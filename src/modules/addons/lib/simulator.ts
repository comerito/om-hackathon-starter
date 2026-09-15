import { z } from 'zod'
import { uuidSchema } from '../data/validators'

const simulationSchema = z.object({ customerUserId: uuidSchema, attemptNumber: z.number().int().positive() }).strict()

/** Pure mock outcome; no provider, invitation, notification or account mutation. */
export function simulateSandbox(input: z.infer<typeof simulationSchema>) {
  const { customerUserId, attemptNumber } = simulationSchema.parse(input)
  const fails = attemptNumber === 1 && Number.parseInt(customerUserId.replaceAll('-', '').slice(-2), 16) % 5 === 0
  return fails
    ? { status: 'failed' as const, reasonCode: 'mock_failure' as const }
    : { status: 'succeeded' as const, reasonCode: null }
}
