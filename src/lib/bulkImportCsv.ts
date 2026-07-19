// ---------------------------------------------------------------------------
// Bulk import CSV parsing and validation (pure, framework-free).
//
// Row numbering is spreadsheet-style: the header row is row 1 and the first
// data row is row 2, so "Row 5" in an error matches what the user sees when
// they open the file in a spreadsheet.
// ---------------------------------------------------------------------------

export type ImportEntity = 'contacts' | 'accounts' | 'opportunities'

export interface ColumnSpec {
  /** Canonical field name used in the import payload. */
  field: string
  required: boolean
  /** Alternative header spellings accepted for this field. */
  aliases: string[]
}

export const CONTACT_STAGES = ['lead', 'prospect', 'customer', 'churned', 'evangelist']
export const ACCOUNT_STATUSES = ['active', 'inactive', 'churned']
export const OPPORTUNITY_STAGES = ['qualification', 'proposal', 'negotiation', 'closed-won', 'closed-lost']

export const ENTITY_COLUMNS: Record<ImportEntity, ColumnSpec[]> = {
  contacts: [
    { field: 'first_name', required: true, aliases: ['first name', 'firstname', 'given name'] },
    { field: 'last_name', required: true, aliases: ['last name', 'lastname', 'surname', 'family name'] },
    { field: 'email', required: false, aliases: ['email address', 'e-mail'] },
    { field: 'phone', required: false, aliases: ['phone number', 'telephone'] },
    { field: 'lifecycle_stage', required: false, aliases: ['stage', 'lifecycle'] },
    { field: 'account_id', required: false, aliases: ['account id', 'account'] },
  ],
  accounts: [
    { field: 'name', required: true, aliases: ['account name', 'company', 'company name'] },
    { field: 'domain', required: false, aliases: ['website', 'domain name'] },
    { field: 'status', required: false, aliases: ['account status'] },
  ],
  opportunities: [
    { field: 'name', required: true, aliases: ['opportunity name', 'deal', 'deal name'] },
    { field: 'account_id', required: true, aliases: ['account id', 'account'] },
    { field: 'stage', required: false, aliases: ['deal stage'] },
    { field: 'amount', required: false, aliases: ['value', 'deal amount', 'amount usd'] },
    { field: 'close_date', required: false, aliases: ['close date', 'expected close'] },
  ],
}

// ---------------------------------------------------------------------------
// CSV parsing (RFC 4180 style: quoted fields, escaped quotes, CRLF)
// ---------------------------------------------------------------------------

export interface CsvRow {
  /** Spreadsheet-style row number (header is row 1). */
  row: number
  cells: string[]
}

export interface CsvParseResult {
  headers: string[]
  rows: CsvRow[]
}

export function parseCsv(text: string): CsvParseResult {
  const records: string[][] = []
  let record: string[] = []
  let field = ''
  let inQuotes = false

  const pushField = () => { record.push(field); field = '' }
  const pushRecord = () => { pushField(); records.push(record); record = [] }

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else {
        field += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      pushField()
    } else if (ch === '\n') {
      pushRecord()
    } else if (ch === '\r') {
      pushRecord()
      if (text[i + 1] === '\n') i++
    } else {
      field += ch
    }
  }
  if (field.length > 0 || record.length > 0) pushRecord()

  const isEmptyRecord = (cells: string[]) => cells.every(c => c.trim() === '')

  let headers: string[] = []
  let headerFound = false
  const rows: CsvRow[] = []
  records.forEach((cells, index) => {
    if (isEmptyRecord(cells)) return
    if (!headerFound) {
      headers = cells.map(c => c.trim())
      headerFound = true
    } else {
      rows.push({ row: index + 1, cells })
    }
  })

  return { headers, rows }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface RowError {
  /** Spreadsheet-style row number (header is row 1). */
  row: number
  message: string
}

export interface ImportRecord {
  /** Spreadsheet-style row number, kept so results can point back at the file. */
  row: number
  /** Canonical field name to trimmed value. */
  values: Record<string, string>
}

export interface CsvValidationResult {
  /** File-level problems (empty file, missing required columns, no data rows). */
  headerErrors: string[]
  /** Per-row problems; rows listed here are excluded from `records`. */
  rowErrors: RowError[]
  /** Rows that passed validation, with canonical field keys and defaults applied. */
  records: ImportRecord[]
  /** Headers present in the file that did not map to any known field. */
  ignoredColumns: string[]
  totalDataRows: number
}

export function formatRowError(error: RowError): string {
  return `Row ${error.row}: ${error.message}`
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, ' ')
}

function matchHeader(header: string, specs: ColumnSpec[]): ColumnSpec | null {
  const normalized = normalizeHeader(header)
  for (const spec of specs) {
    if (normalized === normalizeHeader(spec.field)) return spec
    if (spec.aliases.some(alias => normalized === normalizeHeader(alias))) return spec
  }
  return null
}

function enumError(field: string, value: string, allowed: string[]): string {
  return `invalid ${field} "${value}" (expected one of: ${allowed.join(', ')})`
}

export function validateCsv(entity: ImportEntity, text: string): CsvValidationResult {
  const result: CsvValidationResult = {
    headerErrors: [],
    rowErrors: [],
    records: [],
    ignoredColumns: [],
    totalDataRows: 0,
  }

  const { headers, rows } = parseCsv(text)
  if (headers.length === 0) {
    result.headerErrors.push('The CSV is empty. Provide a header row and at least one data row.')
    return result
  }

  const specs = ENTITY_COLUMNS[entity]
  const columnMap = new Map<number, ColumnSpec>()
  const mappedFields = new Set<string>()
  headers.forEach((header, index) => {
    const spec = matchHeader(header, specs)
    if (spec && !mappedFields.has(spec.field)) {
      columnMap.set(index, spec)
      mappedFields.add(spec.field)
    } else if (header !== '') {
      result.ignoredColumns.push(header)
    }
  })

  for (const spec of specs) {
    if (spec.required && !mappedFields.has(spec.field)) {
      result.headerErrors.push(
        `Missing required column "${spec.field}". Accepted headers: ${[spec.field, ...spec.aliases].join(', ')}.`,
      )
    }
  }
  if (result.headerErrors.length > 0) return result

  result.totalDataRows = rows.length
  if (rows.length === 0) {
    result.headerErrors.push('No data rows found below the header row.')
    return result
  }

  for (const { row, cells } of rows) {
    const values: Record<string, string> = {}
    columnMap.forEach((spec, index) => {
      values[spec.field] = (cells[index] ?? '').trim()
    })

    const errors: string[] = []
    for (const spec of specs) {
      if (spec.required && !(values[spec.field] ?? '').trim()) {
        errors.push(`missing required value for "${spec.field}"`)
      }
    }

    if (entity === 'contacts') {
      const email = values.email ?? ''
      if (email && !EMAIL_RE.test(email)) errors.push(`invalid email format ("${email}")`)
      const stage = values.lifecycle_stage ?? ''
      if (stage && !CONTACT_STAGES.includes(stage)) errors.push(enumError('lifecycle_stage', stage, CONTACT_STAGES))
      if (!stage) values.lifecycle_stage = 'lead'
    } else if (entity === 'accounts') {
      const status = values.status ?? ''
      if (status && !ACCOUNT_STATUSES.includes(status)) errors.push(enumError('status', status, ACCOUNT_STATUSES))
      if (!status) values.status = 'active'
    } else {
      const stage = values.stage ?? ''
      if (stage && !OPPORTUNITY_STAGES.includes(stage)) errors.push(enumError('stage', stage, OPPORTUNITY_STAGES))
      if (!stage) values.stage = 'qualification'
      const rawAmount = values.amount ?? ''
      if (rawAmount) {
        const cleaned = rawAmount.replace(/^\$/, '').replace(/,/g, '')
        const parsed = Number(cleaned)
        if (cleaned === '' || !Number.isFinite(parsed)) {
          errors.push(`invalid amount "${rawAmount}" (must be a number)`)
        } else if (parsed < 0) {
          errors.push(`invalid amount "${rawAmount}" (must not be negative)`)
        } else {
          values.amount = String(parsed)
        }
      }
    }

    if (errors.length > 0) {
      for (const message of errors) result.rowErrors.push({ row, message })
    } else {
      result.records.push({ row, values })
    }
  }

  return result
}
