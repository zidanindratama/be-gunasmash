# GunaSmash Backend Unit Test Report

## Executive Summary

- Backend modules inventoried: common/config, auth, users, announcements, blogs, attendance, stats, uploads, Prisma seed tooling, and app/router/server bootstrap.
- Test framework: Node.js `node:test` through the existing `tsx --test`; no new testing dependency.
- Test files: 22.
- Test cases: 128 passed, 0 failed, 0 skipped.
- Bugs discovered and fixed: 4.
- Remaining known bugs: none found by this suite.
- Database and Cloudinary calls: mocked. The seed script is exercised only through injected fake dependencies.

## Test Results by Module

| Module | Test Files | Tests | Passed | Failed | Bugs | Status |
|---|---:|---:|---:|---:|---:|---|
| Common, config, validation and guards | 6 | 30 | 30 | 0 | 4 fixed | PASS |
| Auth | 3 | 22 | 22 | 0 | 0 | PASS |
| Users and CSV | 2 | 21 | 21 | 0 | 0 | PASS |
| Announcements | 2 | 10 | 10 | 0 | 0 | PASS |
| Blogs | 2 | 10 | 10 | 0 | 0 | PASS |
| Attendance and sessions | 2 | 19 | 19 | 0 | 0 | PASS |
| Stats, uploads and seed tooling | 3 | 16 | 16 | 0 | 0 | PASS |
| **Total** | **22** | **128** | **128** | **0** | **4 fixed** | **PASS** |

## Bugs Fixed

### GS-UNIT-001 — Impossible calendar dates were normalized instead of rejected

- Module: common time utilities.
- Unit: `parseYMD` in `src/modules/common/time/announcement-window.ts`.
- Severity: Medium.
- Scenario: parsing invalid month/day combinations such as February 30.
- Expected: invalid calendar dates return `null`.
- Actual: JavaScript date normalization accepted the impossible date.
- Root cause: parsed components were clamped and not checked against the constructed date.
- Fix: validate component ranges and round-trip the date components.
- Exact retest: `tests/unit/common/announcement-window.test.ts` PASS.
- Regression: full backend unit suite PASS.
- Status: CLOSED.

### GS-UNIT-002 — Whitespace around email caused valid input to fail validation

- Module: validation schemas.
- Unit: sign-up, sign-in and user-update email schemas in `src/modules/common/validators/schemas.ts`.
- Severity: Low.
- Scenario: an otherwise valid email contains surrounding whitespace.
- Expected: trim before email validation.
- Actual: email validation ran before the trim transform.
- Fix: apply `.trim()` before `.email()`.
- Exact retest: `tests/unit/common/schemas.test.ts` PASS.
- Regression: full backend unit suite PASS.
- Status: CLOSED.

### GS-UNIT-003 — CORS matching accepted lookalike host suffixes

- Module: config/CORS.
- Unit: origin callback in `src/modules/config/cors.ts`.
- Severity: High.
- Scenario: a lookalike hostname such as `evilvercel.app` matched a `vercel.app` entry; configured full origins were not normalized.
- Expected: match exact host or a dot-delimited subdomain, respecting configured scheme and port.
- Actual: raw suffix matching accepted ambiguous hostnames.
- Fix: normalize URL/hostname entries and enforce host-boundary, scheme and port comparisons.
- Exact retest: `tests/unit/common/security-middleware.test.ts` PASS.
- Regression: full backend unit suite PASS.
- Status: CLOSED.

### GS-UNIT-004 — JSON array was accepted as a Prisma filter object

- Module: common query utilities.
- Unit: `parseListQuery` in `src/modules/common/utils/query.ts`.
- Severity: Low.
- Scenario: `filter=[]` is valid JSON but not a filter object.
- Expected: ignore it and use an empty filter.
- Actual: JavaScript's `typeof [] === 'object'` check allowed the array through.
- Fix: reject arrays when parsing the filter.
- Exact retest: `tests/unit/common/query.test.ts` PASS.
- Regression: full backend unit suite PASS.
- Status: CLOSED.

## Coverage

The Node test runner reports line, branch and function coverage for loaded source files. It does not report statements as a separate metric.

| Metric | Result |
|---|---:|
| Statements | Not reported by `node:test` |
| Branches | 84.57% |
| Functions | 93.15% |
| Lines | 93.55% |

No project threshold was configured; these figures are descriptive, not a newly imposed target.

## Important Business Rules Verified

- Passwords are hashed before persistence; auth responses omit password fields.
- Refresh uses a signed refresh token and returns current user role data.
- User removal checks related data and exercises force cleanup, content reassignment and transaction ordering.
- User CSV import normalizes names/emails, skips invalid or duplicate rows, hashes passwords and uses the implemented default password. Export excludes sensitive fields and escapes CSV values.
- Announcement types/defaults and optional URL/null fields map into Prisma payloads.
- Public blog listing forces published-only results; unpublished detail access requires a valid ADMIN token.
- Member attendance is limited to the schedule date/window and OPEN sessions; admin ABSENT cancels the attendance record.
- Attendance summary counts unique attendees, maps statuses and derives absences; CSV escaping covers commas, quotes and newlines.
- Session removal deletes attendance, session and linked announcement in sequence inside a transaction.
- Upload validation checks PNG/JPEG/GIF/WebP signatures against MIME type. Multer accepts exactly 5 MiB and rejects one byte over.
- Seed generation uses deterministic injected time/random/Faker/hash dependencies in tests and does not execute destructive operations on import.

## Error Paths Verified

- Prisma lookup/write failures in auth, users, announcements, blogs, attendance and stats services.
- Password hash/compare failures and invalid credentials.
- Validation, missing-resource, duplicate/conflict and unauthorized responses.
- CSV import and Cloudinary provider failures.
- Middleware mapping for Zod errors, Prisma unique conflicts, explicit status errors and unknown errors.
- Seed cleanup failure propagation.

## Remaining Untested Logic

- Coverage leaves 6.45% of loaded lines, 15.43% of branches and 6.85% of functions unexecuted. The remaining gaps are mostly thin controller branches and server bootstrap/listener behavior; the suite tests the high-value service contracts and representative route mapping but does not invoke every Express handler independently.
- `src/index.ts` listener startup and live server binding are intentionally not started by unit tests.
- Build verifies production TypeScript compilation; `npx tsc --noEmit -p tsconfig.test.json` separately typechecks source, Prisma seed and tests.

## Commands Executed

| Command | Result |
|---|---|
| `npm run test:unit` | PASS — 128/128 |
| `npm run test:coverage` | PASS — 128/128; lines 93.55%, branches 84.57%, functions 93.15% |
| `npm run lint` | PASS |
| `npx tsc --noEmit -p tsconfig.test.json` | PASS |
| `npm run build` | PASS — Prisma client generated and production TypeScript build completed |

The test suite was run repeatedly during the work and in the final gate. No `.only` or `.skip` markers were found. No database, browser, frontend, E2E artifact or live Cloudinary call was used.

## Final Verdict

`BACKEND UNIT TESTS PASSED`
