import { describe, expect, it } from 'vitest'
import { formatRowError, parseCsv, validateCsv } from './bulkImportCsv'

describe('parseCsv', () => {
  it('parses headers and rows with quoted fields, escaped quotes, and CRLF', () => {
    const text = 'name,notes\r\n"Acme, Inc.","said ""hi""\nsecond line"\r\nGlobex,plain\r\n'
    const parsed = parseCsv(text)
    expect(parsed.headers).toEqual(['name', 'notes'])
    expect(parsed.rows).toHaveLength(2)
    expect(parsed.rows[0].cells).toEqual(['Acme, Inc.', 'said "hi"\nsecond line'])
    expect(parsed.rows[1].cells).toEqual(['Globex', 'plain'])
  })

  it('skips blank lines but keeps spreadsheet row numbers', () => {
    const text = 'name\n\nAcme\n\nGlobex\n'
    const parsed = parseCsv(text)
    expect(parsed.rows.map(r => r.row)).toEqual([3, 5])
    expect(parsed.rows.map(r => r.cells[0])).toEqual(['Acme', 'Globex'])
  })

  it('returns no headers for empty input', () => {
    expect(parseCsv('').headers).toEqual([])
    expect(parseCsv('  \n \n').headers).toEqual([])
  })
})

describe('validateCsv: contacts', () => {
  it('accepts a good file and maps alias headers onto canonical fields', () => {
    const csv = [
      'First Name,Last Name,Email Address,Stage',
      'Ada,Lovelace,ada@example.com,customer',
      'Grace,Hopper,grace@example.com,',
    ].join('\n')
    const result = validateCsv('contacts', csv)
    expect(result.headerErrors).toEqual([])
    expect(result.rowErrors).toEqual([])
    expect(result.records).toHaveLength(2)
    expect(result.records[0].values).toMatchObject({
      first_name: 'Ada',
      last_name: 'Lovelace',
      email: 'ada@example.com',
      lifecycle_stage: 'customer',
    })
    // empty stage falls back to the default
    expect(result.records[1].values.lifecycle_stage).toBe('lead')
  })

  it('reports missing required headers and imports nothing', () => {
    const csv = 'first_name,email\nAda,ada@example.com'
    const result = validateCsv('contacts', csv)
    expect(result.headerErrors).toHaveLength(1)
    expect(result.headerErrors[0]).toContain('last_name')
    expect(result.records).toEqual([])
  })

  it('flags an invalid email with an actionable spreadsheet row number', () => {
    const csv = [
      'first_name,last_name,email',
      'Ada,Lovelace,ada@example.com',
      'Grace,Hopper,grace@example.com',
      'Alan,Turing,alan@example.com',
      'Katherine,Johnson,not-an-email',
    ].join('\n')
    const result = validateCsv('contacts', csv)
    expect(result.rowErrors).toHaveLength(1)
    expect(result.rowErrors[0].row).toBe(5)
    expect(formatRowError(result.rowErrors[0])).toContain('Row 5: invalid email format')
    expect(result.records).toHaveLength(3)
  })

  it('flags missing required values and an unknown lifecycle stage', () => {
    const csv = [
      'first_name,last_name,lifecycle_stage',
      ',Lovelace,lead',
      'Grace,Hopper,wizard',
    ].join('\n')
    const result = validateCsv('contacts', csv)
    expect(result.records).toEqual([])
    const messages = result.rowErrors.map(formatRowError)
    expect(messages[0]).toContain('Row 2: missing required value for "first_name"')
    expect(messages[1]).toContain('Row 3: invalid lifecycle_stage "wizard"')
  })

  it('reports an empty file', () => {
    const result = validateCsv('contacts', '   \n ')
    expect(result.headerErrors).toHaveLength(1)
    expect(result.headerErrors[0]).toContain('empty')
    expect(result.records).toEqual([])
  })

  it('reports a header-only file with no data rows', () => {
    const result = validateCsv('contacts', 'first_name,last_name\n')
    expect(result.headerErrors).toHaveLength(1)
    expect(result.headerErrors[0]).toContain('No data rows')
  })

  it('ignores unknown columns without failing rows', () => {
    const csv = 'first_name,last_name,nickname\nAda,Lovelace,The Countess'
    const result = validateCsv('contacts', csv)
    expect(result.ignoredColumns).toEqual(['nickname'])
    expect(result.rowErrors).toEqual([])
    expect(result.records).toHaveLength(1)
    expect(result.records[0].values.nickname).toBeUndefined()
  })
})

describe('validateCsv: accounts', () => {
  it('requires name and validates status, applying the default when empty', () => {
    const csv = [
      'name,domain,status',
      'Acme,acme.example,',
      'Globex,globex.example,frozen',
      ',missing.example,active',
    ].join('\n')
    const result = validateCsv('accounts', csv)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].values.status).toBe('active')
    const messages = result.rowErrors.map(formatRowError)
    expect(messages).toHaveLength(2)
    expect(messages[0]).toContain('Row 3: invalid status "frozen"')
    expect(messages[1]).toContain('Row 4: missing required value for "name"')
  })
})

describe('validateCsv: opportunities', () => {
  it('validates numeric amounts and normalizes currency formatting', () => {
    const csv = [
      'name,account_id,amount',
      'Deal A,acc-1,"$1,200.50"',
      'Deal B,acc-2,abc',
      'Deal C,acc-3,-50',
      'Deal D,acc-4,',
    ].join('\n')
    const result = validateCsv('opportunities', csv)
    expect(result.records.map(r => r.row)).toEqual([2, 5])
    expect(result.records[0].values.amount).toBe('1200.5')
    const messages = result.rowErrors.map(formatRowError)
    expect(messages[0]).toContain('Row 3: invalid amount "abc" (must be a number)')
    expect(messages[1]).toContain('Row 4: invalid amount "-50" (must not be negative)')
  })

  it('requires account_id and validates the stage', () => {
    const csv = [
      'name,account_id,stage',
      'Deal A,,proposal',
      'Deal B,acc-2,dreaming',
      'Deal C,acc-3,',
    ].join('\n')
    const result = validateCsv('opportunities', csv)
    expect(result.records).toHaveLength(1)
    expect(result.records[0].values.stage).toBe('qualification')
    const messages = result.rowErrors.map(formatRowError)
    expect(messages[0]).toContain('Row 2: missing required value for "account_id"')
    expect(messages[1]).toContain('Row 3: invalid stage "dreaming"')
  })
})
