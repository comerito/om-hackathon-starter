export class AddonError extends Error {
  constructor(readonly code: string, readonly status: number, readonly details: Record<string, unknown> = {}) {
    super(code)
    this.name = 'AddonError'
  }
}
