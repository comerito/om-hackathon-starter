import {
  ACTION_URL_MESSAGE,
  announcementFormSchema,
  createAnnouncementSchema,
  isSafeActionUrl,
  updateAnnouncementSchema,
} from '../validators'

const COMPETITION_ID = '11111111-1111-4111-8111-111111111111'
const ANNOUNCEMENT_ID = '22222222-2222-4222-8222-222222222222'

function createInput(actionUrl?: unknown) {
  const base: Record<string, unknown> = {
    competition_id: COMPETITION_ID,
    title: 'Lunch is served',
    content: 'Grab a plate in the main hall.',
    priority: 'info',
  }
  if (arguments.length > 0) base.action_url = actionUrl
  return base
}

function formInput(actionUrl?: unknown) {
  const base: Record<string, unknown> = {
    competition_id: COMPETITION_ID,
    title: 'Lunch is served',
    content: 'Grab a plate in the main hall.',
    priority: 'info',
  }
  if (arguments.length > 0) base.action_url = actionUrl
  return base
}

describe('isSafeActionUrl', () => {
  it.each([
    'https://example.com/project',
    'http://example.com/project?a=1#b',
    'HTTPS://EXAMPLE.COM/Project',
    '/acme-corp/portal/project',
    '/acme-corp/portal/project?tab=demo#top',
    '/',
  ])('accepts %s', (value) => {
    expect(isSafeActionUrl(value)).toBe(true)
  })

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)  ',
    'java\nscript:alert(1)',
    'java\tscript:alert(1)',
    'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    '//evil.example.com/steal',
    'ftp://example.com/file',
    'example.com/project',
    'not a url',
    '',
    '   ',
  ])('rejects %j', (value) => {
    expect(isSafeActionUrl(value)).toBe(false)
  })

  it('rejects values over the 1000 character limit', () => {
    expect(isSafeActionUrl(`/${'a'.repeat(1000)}`)).toBe(false)
  })
})

describe('createAnnouncementSchema action_url', () => {
  it('accepts an absolute https URL', () => {
    const parsed = createAnnouncementSchema.parse(createInput('https://example.com/project'))
    expect(parsed.action_url).toBe('https://example.com/project')
  })

  it('accepts a relative in-portal path (regression: issue #82)', () => {
    const parsed = createAnnouncementSchema.parse(createInput('/acme-corp/portal/project'))
    expect(parsed.action_url).toBe('/acme-corp/portal/project')
  })

  it('trims surrounding whitespace on an accepted value', () => {
    const parsed = createAnnouncementSchema.parse(createInput('  /acme-corp/portal/project  '))
    expect(parsed.action_url).toBe('/acme-corp/portal/project')
  })

  it('treats an empty string as "no action link"', () => {
    const parsed = createAnnouncementSchema.parse(createInput(''))
    expect(parsed.action_url).toBeNull()
  })

  it('treats a whitespace-only string as "no action link"', () => {
    const parsed = createAnnouncementSchema.parse(createInput('   '))
    expect(parsed.action_url).toBeNull()
  })

  it('accepts an omitted field', () => {
    const parsed = createAnnouncementSchema.parse(createInput())
    expect(parsed.action_url).toBeUndefined()
  })

  it('accepts an explicit null', () => {
    const parsed = createAnnouncementSchema.parse(createInput(null))
    expect(parsed.action_url).toBeNull()
  })

  it('rejects a javascript: payload with a field-scoped issue', () => {
    const result = createAnnouncementSchema.safeParse(createInput('javascript:alert(document.cookie)'))
    expect(result.success).toBe(false)
    if (result.success) return
    const issue = result.error.issues.find((i) => i.path[0] === 'action_url')
    expect(issue).toBeDefined()
    expect(issue?.message).toBe(ACTION_URL_MESSAGE)
  })

  it('rejects a protocol-relative URL', () => {
    expect(createAnnouncementSchema.safeParse(createInput('//evil.example.com')).success).toBe(false)
  })
})

describe('updateAnnouncementSchema action_url', () => {
  it('leaves an omitted field undefined so an update does not wipe the stored link', () => {
    const parsed = updateAnnouncementSchema.parse({ id: ANNOUNCEMENT_ID, title: 'New title' })
    expect(parsed.action_url).toBeUndefined()
  })

  it('accepts a relative path', () => {
    const parsed = updateAnnouncementSchema.parse({
      id: ANNOUNCEMENT_ID,
      action_url: '/acme-corp/portal/project',
    })
    expect(parsed.action_url).toBe('/acme-corp/portal/project')
  })

  it('clears the link when the field is submitted empty', () => {
    const parsed = updateAnnouncementSchema.parse({ id: ANNOUNCEMENT_ID, action_url: '' })
    expect(parsed.action_url).toBeNull()
  })

  it('rejects a javascript: payload', () => {
    expect(
      updateAnnouncementSchema.safeParse({ id: ANNOUNCEMENT_ID, action_url: 'javascript:alert(1)' }).success,
    ).toBe(false)
  })
})

/**
 * The form schema is what CrudForm parses on submit; a failure here is what renders the
 * field-level error under "Action URL" instead of the form silently doing nothing.
 */
describe('announcementFormSchema', () => {
  it('accepts a relative in-portal path', () => {
    expect(announcementFormSchema.safeParse(formInput('/acme-corp/portal/project')).success).toBe(true)
  })

  it('accepts an absolute URL', () => {
    expect(announcementFormSchema.safeParse(formInput('https://example.com/project')).success).toBe(true)
  })

  it('accepts an empty field', () => {
    expect(announcementFormSchema.safeParse(formInput('')).success).toBe(true)
  })

  it('reports a javascript: payload against the action_url field', () => {
    const result = announcementFormSchema.safeParse(formInput('javascript:alert(1)'))
    expect(result.success).toBe(false)
    if (result.success) return
    expect(result.error.issues.map((i) => i.path.join('.'))).toContain('action_url')
    expect(result.error.issues.find((i) => i.path[0] === 'action_url')?.message).toBe(ACTION_URL_MESSAGE)
  })

  it('keeps unknown keys (custom fields, ids) so parsing does not drop payload data', () => {
    const result = announcementFormSchema.safeParse({
      ...formInput('/acme-corp/portal/project'),
      id: ANNOUNCEMENT_ID,
      cf_internal_note: 'keep me',
    })
    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data).toMatchObject({ id: ANNOUNCEMENT_ID, cf_internal_note: 'keep me' })
  })
})
