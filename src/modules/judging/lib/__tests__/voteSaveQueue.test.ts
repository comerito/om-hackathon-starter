import {
  EMPTY_PATCH,
  INITIAL_SAVE_QUEUE,
  hasUnsavedChanges,
  leaveRequest,
  mergePatch,
  nextRequest,
  patchToRequestFields,
  saveIndicatorState,
  saveQueueReducer,
  sendAfterInFlight,
  type SaveOutcome,
  type SaveQueueAction,
  type SaveQueueState,
  type VotePatch,
} from '../voteSaveQueue'

/** SPEC-007 step 9: autosave queue of the judge voting page. */

const run = (actions: SaveQueueAction[], from: SaveQueueState = INITIAL_SAVE_QUEUE): SaveQueueState =>
  actions.reduce(saveQueueReducer, from)

const stars = (criterionId: string, value: number): SaveQueueAction => ({
  type: 'change', patch: { criteria: { [criterionId]: { stars: value } } }, immediate: true,
})
const note = (criterionId: string, value: string | null): SaveQueueAction => ({
  type: 'change', patch: { criteria: { [criterionId]: { note: value } } }, immediate: false,
})
const comment = (value: string | null): SaveQueueAction => ({
  type: 'change', patch: { criteria: {}, comment: value }, immediate: false,
})

/** Mimics the hook: start sending whatever `nextRequest` returns. */
const send = (state: SaveQueueState): { state: SaveQueueState; sent: VotePatch } => {
  const sent = nextRequest(state)
  if (sent === null) throw new Error('nothing to send')
  return { state: saveQueueReducer(state, { type: 'start', patch: sent }), sent }
}

describe('mergePatch', () => {
  it('lets later values win per criterion and field without clearing the other field', () => {
    const merged = mergePatch(
      { criteria: { a: { stars: 3, note: 'first' }, b: { stars: 5 } }, comment: 'old', conflict_of_interest: true },
      { criteria: { a: { stars: 7 }, c: { note: null } }, private_notes: 'mine', conflict_of_interest: false },
    )
    expect(merged).toEqual({
      criteria: { a: { stars: 7, note: 'first' }, b: { stars: 5 }, c: { note: null } },
      comment: 'old',
      private_notes: 'mine',
      conflict_of_interest: false,
    })
  })

  it('keeps an explicit null (cleared text) instead of treating it as omitted', () => {
    expect(mergePatch({ criteria: {}, comment: 'text' }, { criteria: {}, comment: null }).comment).toBeNull()
  })
})

describe('saveQueueReducer', () => {
  it('sends star clicks immediately', () => {
    const state = run([stars('a', 4)])
    expect(nextRequest(state)).toEqual({ criteria: { a: { stars: 4 } } })
    expect(saveIndicatorState(state)).toBe('saving')
  })

  it('waits for the debounce flush before sending typed text', () => {
    const typed = run([note('a', 'good'), comment('nice')])
    expect(nextRequest(typed)).toBeNull()
    expect(hasUnsavedChanges(typed)).toBe(true)
    const flushed = saveQueueReducer(typed, { type: 'flush' })
    expect(nextRequest(flushed)).toEqual({ criteria: { a: { note: 'good' } }, comment: 'nice' })
  })

  it('sends queued text together with the next star click', () => {
    const state = run([comment('nice'), stars('a', 9)])
    expect(nextRequest(state)).toEqual({ criteria: { a: { stars: 9 } }, comment: 'nice' })
  })

  it('keeps one request in flight and merges changes made meanwhile into the next request', () => {
    const first = send(run([stars('a', 4)]))
    expect(first.sent).toEqual({ criteria: { a: { stars: 4 } } })
    expect(nextRequest(first.state)).toBeNull()

    const during = run([stars('a', 6), stars('b', 2), note('a', 'why')], first.state)
    expect(nextRequest(during)).toBeNull()
    expect(saveIndicatorState(during)).toBe('saving')

    const afterSuccess = saveQueueReducer(during, { type: 'success' })
    expect(nextRequest(afterSuccess)).toEqual({ criteria: { a: { stars: 6, note: 'why' }, b: { stars: 2 } } })

    const second = send(afterSuccess)
    const done = saveQueueReducer(second.state, { type: 'success' })
    expect(done.pending).toEqual(EMPTY_PATCH)
    expect(hasUnsavedChanges(done)).toBe(false)
    expect(saveIndicatorState(done)).toBe('saved')
  })

  it('does not send typed-only changes made during a request until they are flushed', () => {
    const first = send(run([stars('a', 4)]))
    const during = run([comment('later')], first.state)
    const afterSuccess = saveQueueReducer(during, { type: 'success' })
    expect(nextRequest(afterSuccess)).toBeNull()
    expect(nextRequest(saveQueueReducer(afterSuccess, { type: 'flush' }))).toEqual({ criteria: {}, comment: 'later' })
  })

  it('resends everything when changes arrive between computing the request and starting it', () => {
    const queued = run([stars('a', 4)])
    const computed = nextRequest(queued)
    if (computed === null) throw new Error('expected a request')
    const changed = run([stars('b', 8)], queued)
    const started = saveQueueReducer(changed, { type: 'start', patch: computed })
    expect(started.inFlight).toEqual({ criteria: { a: { stars: 4 } } })
    const afterSuccess = saveQueueReducer(started, { type: 'success' })
    expect(nextRequest(afterSuccess)).toEqual({ criteria: { a: { stars: 4 }, b: { stars: 8 } } })
  })

  it('keeps the failed patch pending (newer edits win) and waits for a retry', () => {
    const first = send(run([stars('a', 4), comment('one')]))
    const during = run([stars('a', 5)], first.state)
    const failed = saveQueueReducer(during, { type: 'failure', closed: false })

    expect(failed.inFlight).toBeNull()
    expect(failed.pending).toEqual({ criteria: { a: { stars: 5 } }, comment: 'one' })
    expect(saveIndicatorState(failed)).toBe('error')
    expect(nextRequest(failed)).toBeNull()
    expect(hasUnsavedChanges(failed)).toBe(true)

    const retried = saveQueueReducer(failed, { type: 'retry' })
    expect(nextRequest(retried)).toEqual({ criteria: { a: { stars: 5 } }, comment: 'one' })
    const resent = send(retried)
    expect(saveIndicatorState(resent.state)).toBe('saving')
    expect(saveIndicatorState(saveQueueReducer(resent.state, { type: 'success' }))).toBe('saved')
  })

  it('retries everything pending on the next star click after a failure', () => {
    const sent = send(run([comment('one'), { type: 'flush' }]))
    const failed = saveQueueReducer(sent.state, { type: 'failure', closed: false })
    const clicked = saveQueueReducer(failed, stars('b', 3))
    expect(nextRequest(clicked)).toEqual({ criteria: { b: { stars: 3 } }, comment: 'one' })
  })

  it('closes on 409 and never sends again', () => {
    const first = send(run([stars('a', 4)]))
    const closed = saveQueueReducer(first.state, { type: 'failure', closed: true })
    expect(closed.closed).toBe(true)
    expect(nextRequest(saveQueueReducer(closed, { type: 'retry' }))).toBeNull()
    expect(nextRequest(saveQueueReducer(closed, stars('a', 9)))).toBeNull()
    expect(hasUnsavedChanges(closed)).toBe(false)
    expect(saveIndicatorState(closed)).toBe('idle')
  })

  it('ignores changes once voting was reported closed up front', () => {
    const closed = run([{ type: 'close' }, stars('a', 3), { type: 'flush' }])
    expect(closed.pending).toEqual(EMPTY_PATCH)
    expect(nextRequest(closed)).toBeNull()
  })

  it('does nothing on flush or retry with nothing pending', () => {
    expect(run([{ type: 'flush' }, { type: 'retry' }])).toEqual(INITIAL_SAVE_QUEUE)
  })
})

describe('leaveRequest', () => {
  it('sends nothing when nothing is queued or voting is closed', () => {
    expect(leaveRequest(INITIAL_SAVE_QUEUE)).toBeNull()
    expect(leaveRequest(send(run([stars('a', 4)])).state)).toBeNull()
    expect(leaveRequest(run([note('a', 'x'), { type: 'close' }]))).toBeNull()
  })

  it('sends the in-flight values with the queued ones on top', () => {
    const inFlight = send(run([stars('a', 4), note('b', 'first')])).state
    const leaving = run([stars('a', 9), comment('bye')], inFlight)
    expect(leaveRequest(leaving)).toEqual({ criteria: { a: { stars: 9 }, b: { note: 'first' } }, comment: 'bye' })
  })
})

describe('sendAfterInFlight', () => {
  const deferred = () => {
    let resolve: (outcome: SaveOutcome) => void = () => undefined
    let reject: (error: Error) => void = () => undefined
    const promise = new Promise<SaveOutcome>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
  const flushMicrotasks = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

  it('sends right away, synchronously, when nothing is in flight', async () => {
    const sendLeave = jest.fn(async () => undefined)
    const done = sendAfterInFlight(null, sendLeave)
    expect(sendLeave).toHaveBeenCalledTimes(1)
    await done
  })

  it('waits for the in-flight request before sending, so the newer values land last', async () => {
    const events: string[] = []
    const inFlight = deferred()
    const sendLeave = jest.fn(async () => { events.push('leave sent') })
    const done = sendAfterInFlight(inFlight.promise, sendLeave)
    await flushMicrotasks()
    expect(sendLeave).not.toHaveBeenCalled()
    events.push('in-flight settled')
    inFlight.resolve('saved')
    await done
    expect(events).toEqual(['in-flight settled', 'leave sent'])
  })

  it('still sends after the in-flight request failed or threw', async () => {
    for (const settle of ['failed', 'threw'] as const) {
      const inFlight = deferred()
      const sendLeave = jest.fn(async () => undefined)
      const done = sendAfterInFlight(inFlight.promise, sendLeave)
      if (settle === 'failed') inFlight.resolve('failed')
      else inFlight.reject(new Error('network'))
      await done
      expect(sendLeave).toHaveBeenCalledTimes(1)
    }
  })

  it('skips the send when the in-flight request reported voting closed', async () => {
    const inFlight = deferred()
    const sendLeave = jest.fn(async () => undefined)
    const done = sendAfterInFlight(inFlight.promise, sendLeave)
    inFlight.resolve('closed')
    await done
    expect(sendLeave).not.toHaveBeenCalled()
  })

  it('swallows a failing send', async () => {
    await expect(sendAfterInFlight(null, async () => { throw new Error('offline') })).resolves.toBeUndefined()
  })
})

describe('patchToRequestFields', () => {
  it('omits unchanged fields and keeps notes and stars independent', () => {
    expect(patchToRequestFields({ criteria: { a: { stars: 7 }, b: { note: null } }, conflict_of_interest: true })).toEqual({
      criterion_scores: [{ criterion_id: 'a', stars: 7 }, { criterion_id: 'b', note: null }],
      conflict_of_interest: true,
    })
    expect(patchToRequestFields({ criteria: {}, comment: null, private_notes: 'p' })).toEqual({ comment: null, private_notes: 'p' })
  })
})
