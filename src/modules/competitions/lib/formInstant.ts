/**
 * Normaliser for stored instants loaded into a CrudForm `datetime` field.
 *
 * The `datetime` field takes an absolute instant in, renders it in the browser's local
 * timezone, and emits a full ISO-8601 UTC string (`date.toISOString()`) on change. A loader
 * must therefore hand it a *zoned* value and `onSubmit` must forward the picker's output
 * untouched.
 *
 * Narrowing the stored instant to a zone-less `YYYY-MM-DDTHH:mm` string via
 * `toISOString().slice(0, 16)` — as the competition edit form did in issue #81 and the
 * milestone edit form did in issue #122 — makes the picker re-read a UTC instant as *local*
 * wall-clock time, and `new Date(...)` on submit then subtracts the offset a second time. Every
 * no-op save shifted the stored value by the browser's UTC offset, cumulatively.
 *
 * Returns `''` for an absent value (CrudForm's empty-field shape) and passes an unparseable
 * value through verbatim rather than inventing an instant for it.
 */
export function toFormInstant(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString()
  }
  const raw = String(value)
  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? raw : parsed.toISOString()
}
