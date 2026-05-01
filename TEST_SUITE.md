# Test Suite Guide — infraportal

## Overview

This project uses **Vitest** for fast unit testing of utilities, hooks, and configuration. The test suite is designed to ensure reliability and maintainability of the portal application.

## Running Tests

```bash
# Run all tests once
npm run test

# Watch mode (re-run on file changes)
npm run test:watch

# Run specific test file
npm run test -- src/utils/time.test.ts

# Run with coverage
npm run test -- --coverage
```

## Test Structure

```
src/
├── utils/
│   ├── time.test.ts                    # Time formatting and relative dates
│   ├── auditUi.test.ts                 # Audit page UI state helpers
│   ├── searchUi.test.ts                # Search page UI state helpers
│   └── config.test.ts                  # Environment configuration (NEW)
├── features/
│   └── layout/
│       └── navItems.test.ts            # Navigation items filtering (NEW)
└── pages/
    └── [integration tests to be added]
```

## What's Tested

### ✅ Existing Tests

**Utils:**
- `time.test.ts` — Relative time formatting (formatRelativeTime)
  - Empty/invalid input handling
  - Future timestamp handling
  - Relative duration calculation (seconds, minutes, hours, days)

- `auditUi.test.ts` — Audit UI state management
  - Active filter counting
  - Empty state generation (filtered vs. unfiltered)
  - User-friendly messaging

- `searchUi.test.ts` — Search UI state management
  - Similar patterns to auditUi

### ✅ New Tests (This Session)

**Config:**
- `config.test.ts` — Environment variables
  - BASE_URL availability
  - API endpoint configuration
  - Environment-specific setup

**Navigation:**
- `navItems.test.ts` — Navigation structure
  - Primary items filtering (Home, About, Services, Case Studies, Pricing, Patch Notes, Contact)
  - Workspace items (now empty, verified removed)
  - Admin items (Observaboard only)
  - No overlap between sections
  - Complete coverage of all items

## Testing Patterns

### Unit Test Template

```typescript
import { describe, expect, it, beforeEach, afterEach } from 'vitest'

describe('MyFeature', () => {
  beforeEach(() => {
    // Setup before each test
  })

  afterEach(() => {
    // Cleanup after each test
  })

  it('should do something', () => {
    // Arrange
    const input = 'test'
    
    // Act
    const result = myFunction(input)
    
    // Assert
    expect(result).toBe('expected')
  })
})
```

## Coverage Goals

- **Utilities:** 100% (critical for data formatting/validation)
- **Config:** 100% (environment setup)
- **Navigation:** 100% (user-facing, important for routing)
- **Overall:** >80% (acceptable for UI components)

## To Be Tested

### High Priority
1. **Auth flow** — Login, logout, token handling, claims parsing
2. **Build status** — GitHub API fetching, error handling
3. **Content loading** — Data fetching for services, pricing, case studies
4. **Navigation routing** — Hash-based routing, active state detection

### Medium Priority
5. **Theme switching** — localStorage persistence, theme application
6. **Page rendering** — Hero section, about page, case studies display
7. **Form handling** — Contact form, CRM forms (if applicable)

### Nice to Have
8. **Component snapshots** — Stable components (cards, sections, badges)
9. **Accessibility** — ARIA labels, keyboard navigation
10. **Edge cases** — Network failures, missing data, browser limitations

## Adding New Tests

1. **Create test file** in same directory as source, named `*.test.ts` or `*.test.tsx`
2. **Follow existing patterns** from `time.test.ts` and `auditUi.test.ts`
3. **Use descriptive test names** (what should happen, not just "it works")
4. **Test behavior, not implementation** (what the user sees/needs, not internal details)
5. **Mock external dependencies** (API calls, localStorage, time)
6. **Run tests locally** before pushing

## Debugging Tests

```bash
# Run single test file
npm run test -- src/utils/time.test.ts

# Run tests matching pattern
npm run test -- --grep "formatRelativeTime"

# Watch mode with UI
npm run test:watch

# Show full error details
npm run test -- --reporter=verbose
```

## Next Steps

1. Run `npm install` to ensure all devDependencies are present
2. Run `npm run test` to verify existing tests pass
3. Add component testing library (React Testing Library) for UI tests
4. Add tests for:
   - AuthContext (provider state, login/logout, persistence)
   - BuildStatus hook (GitHub API mocking)
   - Navigation active state detection
   - Page rendering and routing
5. Set up coverage reporting and CI checks

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [React Testing Patterns](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
