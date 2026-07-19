/**
 * Deep-link parse/serialize tests for the v1.17.3 sharable API docs links.
 * Pure string logic, node environment.
 */

import { describe, expect, it } from 'vitest'
import {
  API_DOCS_HASH,
  buildApiDocsHash,
  buildApiDocsLink,
  parseApiDocsHash,
  type ApiDocsTarget,
} from './deepLink'

describe('parseApiDocsHash', () => {
  it('parses the bare route as an empty target', () => {
    expect(parseApiDocsHash('#/api-docs')).toEqual({})
  })

  it('parses service-only links', () => {
    expect(parseApiDocsHash('#/api-docs?service=accounts')).toEqual({ service: 'accounts' })
  })

  it('parses service plus operation links', () => {
    expect(parseApiDocsHash('#/api-docs?service=accounts&op=listAccounts')).toEqual({
      service: 'accounts',
      op: 'listAccounts',
    })
  })

  it('treats blank parameter values as absent', () => {
    expect(parseApiDocsHash('#/api-docs?service=&op=')).toEqual({})
  })

  it('ignores unrelated parameters', () => {
    expect(parseApiDocsHash('#/api-docs?service=search&utm_source=x')).toEqual({
      service: 'search',
    })
  })

  it('returns null for anything that is not the API docs route', () => {
    expect(parseApiDocsHash('')).toBeNull()
    expect(parseApiDocsHash('#/')).toBeNull()
    expect(parseApiDocsHash('#/api-doc')).toBeNull()
    expect(parseApiDocsHash('#/api-docsx?service=accounts')).toBeNull()
    expect(parseApiDocsHash('#/patch-notes')).toBeNull()
    expect(parseApiDocsHash('/api-docs?service=accounts')).toBeNull()
  })

  it('decodes percent-encoded values', () => {
    expect(parseApiDocsHash('#/api-docs?service=accounts&op=a%26b%3Dc')).toEqual({
      service: 'accounts',
      op: 'a&b=c',
    })
  })
})

describe('buildApiDocsHash', () => {
  it('serializes an empty target to the bare route', () => {
    expect(buildApiDocsHash({})).toBe(API_DOCS_HASH)
    expect(buildApiDocsHash()).toBe(API_DOCS_HASH)
  })

  it('serializes service and operation', () => {
    expect(buildApiDocsHash({ service: 'accounts', op: 'listAccounts' })).toBe(
      '#/api-docs?service=accounts&op=listAccounts',
    )
  })

  it('omits blank fields', () => {
    expect(buildApiDocsHash({ service: '', op: '' })).toBe(API_DOCS_HASH)
    expect(buildApiDocsHash({ service: 'search' })).toBe('#/api-docs?service=search')
  })
})

describe('round trip', () => {
  const targets: ApiDocsTarget[] = [
    {},
    { service: 'accounts' },
    { service: 'accounts', op: 'listAccounts' },
    { service: 'projects', op: 'deleteMilestone' },
    // Hostile values must survive encode/decode unchanged.
    { service: 'a b', op: 'x&y=z?#' },
  ]

  it.each(targets.map((target) => [JSON.stringify(target), target] as const))(
    'parse(build(%s)) returns the same target',
    (_label, target) => {
      expect(parseApiDocsHash(buildApiDocsHash(target))).toEqual(target)
    },
  )
})

describe('buildApiDocsLink', () => {
  const target: ApiDocsTarget = { service: 'accounts', op: 'getAccount' }

  it('replaces an existing fragment', () => {
    expect(buildApiDocsLink(target, 'https://rodmen07.github.io/infraportal/#/patch-notes')).toBe(
      'https://rodmen07.github.io/infraportal/#/api-docs?service=accounts&op=getAccount',
    )
  })

  it('appends to a fragment-free base', () => {
    expect(buildApiDocsLink(target, 'https://rodmen07.github.io/infraportal/')).toBe(
      'https://rodmen07.github.io/infraportal/#/api-docs?service=accounts&op=getAccount',
    )
  })

  it('preserves an existing search string ahead of the fragment', () => {
    expect(buildApiDocsLink(target, 'http://localhost:5173/?dev=1#/api-docs?service=search')).toBe(
      'http://localhost:5173/?dev=1#/api-docs?service=accounts&op=getAccount',
    )
  })
})
