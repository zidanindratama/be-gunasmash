# GunaSmash Backend Unit Test Coverage Matrix

Coverage source: backend files and Prisma schema only. Test case selection is independent of E2E/Playwright artifacts.

Status values: `PENDING`, `IN PROGRESS`, `PASS`, `FAIL`, `BLOCKED`.

| Batch | Module | File/Unit | Function/Behavior | Scenario / Expected | Status | Test File | Bug ID |
|---|---|---|---|---|---|---|---|
| 1 | Common | `common/http/response.ts` | `ok`, `fail` | Exact success/error shape; optional metadata | PASS | `tests/unit/common/response.test.ts` | — |
| 1 | Common | `common/utils/query.ts` | `parseListQuery` | Defaults, arrays, pagination bounds, search trim, JSON and colon sorting, malformed sort/filter, invalid direction and non-object filter | PASS | `tests/unit/common/query.test.ts` | GS-UNIT-004 |
| 1 | Common | `common/utils/query.ts` | `shapeList` | Item passthrough and total/page/limit/pages calculation, including empty results | PASS | `tests/unit/common/query.test.ts` | — |
| 1 | Common | `common/time/announcement-window.ts` | `normalizeLocalDate`, `isSameLocalDate` | Same/different local dates and time-of-day normalization | PASS | `tests/unit/common/announcement-window.test.ts` | — |
| 1 | Common | `common/time/announcement-window.ts` | `parseTimeRangeToDates`, private `parseHM` | Weekday selection, same-day range, separator variants, invalid day/time, hour/minute clamping | PASS | `tests/unit/common/announcement-window.test.ts` | — |
| 1 | Common | `common/time/announcement-window.ts` | `isNowWithinAnnouncementWindow` | Inclusive start/end boundaries and outside-window values using fixed dates | PASS | `tests/unit/common/announcement-window.test.ts` | — |
| 1 | Common | `common/time/announcement-window.ts` | `parseYMD` | Year/month/day forms, whitespace, invalid format, month/day boundaries and normalization | PASS | `tests/unit/common/announcement-window.test.ts` | GS-UNIT-001 |
| 1 | Auth helpers | `common/auth/jwt.ts` | Sign/verify access and refresh tokens | Correct secret, payload, expiry options, valid/invalid/expired token handling | PASS | `tests/unit/common/jwt.test.ts` | — |
| 1 | Middleware | `common/auth/guards.ts` | `authGuard` | Missing/malformed/valid/invalid bearer token; request user and `next` behavior | PASS | `tests/unit/common/security-middleware.test.ts` | — |
| 1 | Middleware | `common/auth/guards.ts` | `rolesGuard` | Allowed roles and missing/invalid/disallowed role | PASS | `tests/unit/common/security-middleware.test.ts` | — |
| 1 | Middleware | `common/middlewares/error.ts` | `notFound`, `onError` | Zod, P2002, explicit status, unknown error, safe response | PASS | `tests/unit/common/security-middleware.test.ts` | — |
| 1 | Validation | `common/validators/schemas.ts` | Sign-up/sign-in, announcement/blog create/update, Mongo ID, promote, check-in/session/user schemas | Required, type, format, enum, min/max, optional/null/default, invalid boundary cases as defined by schemas | PASS | `tests/unit/common/schemas.test.ts` | GS-UNIT-002 |
| 1 | Config | `config/cors.ts` | CORS origin callback | No origin, URL/hostname whitelist entries, exact/subdomain matching, lookalike rejection, malformed origin, credentials behavior | PASS | `tests/unit/common/security-middleware.test.ts` | GS-UNIT-003 |
| 2 | Auth | `auth/auth.service.ts` | `signUp` | New/duplicate email, hash input/cost, created fields/default role, token payload, secret-free return, dependency errors | PASS | tests/unit/auth/auth.service.test.ts; tests/unit/auth/passport-local.test.ts; tests/unit/auth/auth.controller.test.ts | — |
| 2 | Auth | `auth/auth.service.ts` | `issueTokens` | Existing/missing user, token payload and returned user | PASS | tests/unit/auth/auth.service.test.ts; tests/unit/auth/passport-local.test.ts; tests/unit/auth/auth.controller.test.ts | — |
| 2 | Auth | `auth/auth.service.ts` | `updateMyProfile` | Name/avatar updates, empty update rejection, selected/safe fields, Prisma errors | PASS | tests/unit/auth/auth.service.test.ts; tests/unit/auth/passport-local.test.ts; tests/unit/auth/auth.controller.test.ts | — |
| 2 | Auth | `auth/passport-local.ts` | Local strategy verifier | Unknown email, wrong/correct password, sanitized identity, Prisma/bcrypt error | PASS | tests/unit/auth/auth.service.test.ts; tests/unit/auth/passport-local.test.ts; tests/unit/auth/auth.controller.test.ts | — |
| 2 | Auth controller | `auth/auth.controller.ts` | Sign-up, sign-in, refresh, logout, GET/PATCH `/me` | Validation mapping, cookie attributes, invalid credentials/token, missing user, safe response and `next` behavior | PASS | tests/unit/auth/auth.service.test.ts; tests/unit/auth/passport-local.test.ts; tests/unit/auth/auth.controller.test.ts | — |
| 3 | Users | `users/users.service.ts` | `listUsers` | Query mapping, pagination/search/filter/sort, projection, count and empty result | PASS | tests/unit/users/users.service.test.ts; tests/unit/users/users.controller.test.ts | — |
| 3 | Users | `users/users.service.ts` | `getUser`, `updateUserRole`, `updateUser` | Found/missing user, role/data mapping, duplicate email check, no password exposure | PASS | tests/unit/users/users.service.test.ts; tests/unit/users/users.controller.test.ts | — |
| 3 | Users | `users/users.service.ts` | `removeUser` | Missing/self/invalid reassignment, related-record conflict, force/reassign branches, transaction operations/errors | PASS | tests/unit/users/users.service.test.ts; tests/unit/users/users.controller.test.ts | — |
| 3 | Users | `users/users.service.ts` | `removeUserAuto` | Self-delete/actor/target validation, attendance cleanup, content reassignment, returned counts, transaction errors | PASS | tests/unit/users/users.service.test.ts; tests/unit/users/users.controller.test.ts | — |
| 3 | Users controller | `users/users.controller.ts` | CRUD/role handlers | Admin route mapping, ID/schema validation, actor ID variants, status/error mapping | PASS | tests/unit/users/users.service.test.ts; tests/unit/users/users.controller.test.ts | — |
| 3 | Users controller | `users/users.controller.ts` | CSV import | Missing file, headers/empty/malformed rows, normalization, duplicate skip, default password, hashing/create errors and created count | PASS | tests/unit/users/users.service.test.ts; tests/unit/users/users.controller.test.ts | — |
| 3 | Users controller | `users/users.controller.ts` | CSV export | Header/order/fields, empty and multiple users, escaping, no password, headers/attachment | PASS | tests/unit/users/users.service.test.ts; tests/unit/users/users.controller.test.ts | — |
| 4 | Announcements | `announcements/announcements.service.ts` | `listAnnouncements` | Search, type normalization/list/dedup/invalid placeholders, query mapping, author projection, empty/error | PASS | tests/unit/announcements/announcements.service.test.ts; tests/unit/announcements/announcements.controller.test.ts | — |
| 4 | Announcements | `announcements/announcements.service.ts` | `createAnnouncement`, `getAnnouncement`, `updateAnnouncement`, `removeAnnouncement` | Defaults/date/null mapping, missing detail, partial update semantics, delete result and dependency errors | PASS | tests/unit/announcements/announcements.service.test.ts; tests/unit/announcements/announcements.controller.test.ts | — |
| 4 | Announcements controller | `announcements/announcements.controller.ts` | List/detail/create/update/delete routes | Public/admin mapping, validation, user identity and error forwarding | PASS | tests/unit/announcements/announcements.service.test.ts; tests/unit/announcements/announcements.controller.test.ts | — |
| 5 | Blogs | `blogs/blogs.service.ts` | `listBlogs` | Public published-only vs admin visibility, search/tag/published filters, paging/projection | PASS | tests/unit/blogs/blogs.service.test.ts; tests/unit/blogs/blogs.controller.test.ts | — |
| 5 | Blogs | `blogs/blogs.service.ts` | `createBlog`, `getBlog`, `updateBlog`, `removeBlog` | Author/cover mapping, missing detail, partial updates, deletion and dependency errors | PASS | tests/unit/blogs/blogs.service.test.ts; tests/unit/blogs/blogs.controller.test.ts | — |
| 5 | Blogs controller | `blogs/blogs.controller.ts` | `canViewUnpublished`, list/detail/create/update/delete | Token role visibility, draft 404 behavior, schema and response/error mapping | PASS | tests/unit/blogs/blogs.service.test.ts; tests/unit/blogs/blogs.controller.test.ts | — |
| 6 | Attendance | `attendance/attendance.service.ts` | `memberCheckIn` and private session helper | Announcement/date/window checks, session create/reuse/closed, upsert key/status/note, dependency failures | PASS | tests/unit/attendance/attendance.service.test.ts; tests/unit/attendance/attendance.controller.test.ts | — |
| 6 | Attendance | `attendance/attendance.service.ts` | `adminCheckIn`, `cancelAttendance` | Announcement/date validation, session create/reuse, status/note upsert, missing session/record | PASS | tests/unit/attendance/attendance.service.test.ts; tests/unit/attendance/attendance.controller.test.ts | — |
| 6 | Attendance | `attendance/attendance.service.ts` | `sessionSummary` | Missing announcement/session, status counts, unique attendees, member absence, search/pagination, empty data | PASS | tests/unit/attendance/attendance.service.test.ts; tests/unit/attendance/attendance.controller.test.ts | — |
| 6 | Attendance | `attendance/attendance.service.ts` | `exportSessionCsv`, private `csvSafe` | Status rows, absent rows, header, CSV escaping for comma/quote/newline, empty list | PASS | tests/unit/attendance/attendance.service.test.ts; tests/unit/attendance/attendance.controller.test.ts | — |
| 6 | Attendance | `attendance/attendance.service.ts` | `createSession`, `listSessions` | Announcement/session mapping, state/date, search/status/sort/pagination/projection and errors | PASS | tests/unit/attendance/attendance.service.test.ts; tests/unit/attendance/attendance.controller.test.ts | — |
| 6 | Attendance | `attendance/attendance.service.ts` | `getSessionDetail`, `updateSession`, `removeSession`, `listMemberSessions` | ID/not-found, partial transactional changes, cleanup order, future open sessions and attendance mapping | PASS | tests/unit/attendance/attendance.service.test.ts; tests/unit/attendance/attendance.controller.test.ts | — |
| 6 | Attendance controller | `attendance/attendance.controller.ts` | Selected member/admin check-in, summary and export handlers | DTO parsing, authenticated subject, ABSENT cancellation path, summary/export mapping | PASS | tests/unit/attendance/attendance.service.test.ts; tests/unit/attendance/attendance.controller.test.ts | — |
| 7 | Stats | `stats/stats.service.ts` | `getGlobalStats` | Count mapping, zero/mixed counts, published/unpublished, fixed-date today/upcoming filters, rejection | PASS | tests/unit/stats/stats.service.test.ts; tests/unit/stats/stats.controller.test.ts; tests/unit/uploads/upload.test.ts | — |
| 7 | Stats | `stats/stats.service.ts` | `getAttendanceStatsBySession` | Missing announcement/session, date validation, status aggregation, absent clamp, query payloads | PASS | tests/unit/stats/stats.service.test.ts; tests/unit/stats/stats.controller.test.ts; tests/unit/uploads/upload.test.ts | — |
| 7 | Stats controller | `stats/stats.controller.ts` | Global and attendance handlers | Global response mapping, attendance query validation and response mapping | PASS | tests/unit/stats/stats.service.test.ts; tests/unit/stats/stats.controller.test.ts; tests/unit/uploads/upload.test.ts | — |
| 7 | Upload | `common/upload/cloudinary.ts` | `uploadImage` | Stream options/buffer, success mapping, provider error without network | PASS | tests/unit/stats/stats.service.test.ts; tests/unit/stats/stats.controller.test.ts; tests/unit/uploads/upload.test.ts | — |
| 7 | Upload controller | `uploads/upload.controller.ts` | Image route and private signature validator | Missing file, valid PNG/JPEG/GIF/WebP signatures, MIME mismatch, Cloudinary mapping/error | PASS | tests/unit/stats/stats.service.test.ts; tests/unit/stats/stats.controller.test.ts; tests/unit/uploads/upload.test.ts | — |
| 7 | Seed script | `prisma/seed.ts` | `seedDatabase`, `createSlug`, `pickAttendanceStatus` | Cleanup/order and injected model writes, fixed-time slug, random status boundaries, dependency failure | PASS | `tests/unit/prisma/seed.test.ts` | — |
| 7 | Bootstrap | `src/app.ts`, `src/routes.ts`, `src/index.ts`, `modules/prisma/client.ts` | Middleware/route/client/server assembly | Inventory; avoid opening a listener or database; test only directly meaningful mapping/assembly behavior | PASS | Inventory only; server listener/assembly is outside isolated unit scope | — |

## Baseline

- Existing unit-test files/configuration/scripts: none found.
- Baseline `npm run lint`: PASS.
- Baseline `npm run build`: PASS (Prisma client generation and TypeScript build).
- Test case and bug counts are populated as batches execute.

## Unit findings

### GS-UNIT-001 — `parseYMD` accepted impossible calendar dates

- Scenario: `parseYMD('2025-02-29')` and out-of-range month/day values.
- Root cause: the parser clamped month/day inputs and did not compare the constructed date with the requested components.
- Fix: reject out-of-range components and dates normalized by JavaScript into another calendar day.
- Exact retest: `tests/unit/common/announcement-window.test.ts` passes.
- Regression: Batch 1 common utilities and full backend suite are rerun at batch completion.
- Status: CLOSED after Batch 1 regression passes.

### GS-UNIT-002 — Email whitespace failed validation before trimming

- Scenario: sign-up/sign-in email surrounded by whitespace.
- Root cause: email validation ran before the `.trim()` transform.
- Fix: trim before email validation in sign-up, sign-in, and user-update schemas.
- Exact retest: `tests/unit/common/schemas.test.ts` passes.
- Regression: Batch 1 validation and full backend suite are rerun at batch completion.
- Status: CLOSED after Batch 1 regression passes.

### GS-UNIT-003 — CORS whitelist parsing accepted ambiguous host suffixes and rejected URL entries

- Scenario: a configured full origin did not match its hostname, while `evilvercel.app` matched the `vercel.app` suffix.
- Root cause: whitelist entries were compared as raw strings with unrestricted `hostname.endsWith(entry)`.
- Fix: normalize configured URLs/hostnames and require an exact host or dot-delimited subdomain match; honor configured scheme and port.
- Exact retest: `tests/unit/common/security-middleware.test.ts` passes.
- Regression: Batch 1 common middleware and full backend suite are rerun at batch completion.
- Status: CLOSED after Batch 1 regression passes.

### GS-UNIT-004 — Query parser accepted array JSON as a Prisma filter object

- Scenario: `filter=[]` is valid JSON but is not a filter object.
- Root cause: arrays satisfy JavaScript's `typeof value === 'object'` check.
- Fix: ignore array values when parsing the optional filter.
- Exact retest: `tests/unit/common/query.test.ts` passes after the fix.
- Regression: Batch 1 common utilities and full backend suite are rerun at batch completion.
- Status: CLOSED after exact retest and Batch 1 regression pass.

## BATCH 1 SUMMARY

Modules: common helpers, time, query, schemas, JWT, guards, error middleware, environment, CORS.

Tests: 30 passed, 0 failed, 0 skipped.

Coverage: 96.00% lines, 89.92% branches, 100.00% functions for source files loaded by Batch 1 tests. This is partial-project coverage, not final backend coverage.

Bugs found and fixed: GS-UNIT-001 through GS-UNIT-004. Exact retests and the Batch 1 full suite pass.

Typecheck: `npx tsc --noEmit -p tsconfig.test.json` passed.

BATCH STATUS: PASSED

## BATCH 2 SUMMARY

Modules: auth service, Passport local credential strategy, auth routes.

Tests: 22 passed; 0 failed; 0 skipped. Includes duplicate email, password hashing, safe response fields, token payload/refresh, credential errors, profile mapping, cookies, and auth route validation.

Bugs found: none. Test infrastructure issue: Prisma v5 delegates are dynamic proxies, so test stubs temporarily assign delegate methods and restore them with `t.after`.

BATCH STATUS: PASSED

## BATCH 3 SUMMARY

Modules: users service, CRUD/role handlers, CSV import/export.

Tests: 21 passed; 0 failed; 0 skipped. Covers filtering, query mapping, sensitive-field exclusion, duplicate email, transaction cleanup/reassignment, CSV normalization/default password/escaping, and error mapping.

Bugs found: none.

BATCH STATUS: PASSED

## BATCH 4 SUMMARY

Modules: announcements service and controller routes.

Tests: 10 passed; 0 failed; 0 skipped. Covers type normalization, search/sort/pagination, author projection, create defaults, date/null mapping, partial update, deletion and validation forwarding.

Bugs found: none.

BATCH STATUS: PASSED

## BATCH 5 SUMMARY

Modules: blogs service and controller routes.

Tests: 10 passed; 0 failed; 0 skipped. Covers public/admin published filtering, search/tag, pagination, author sanitization, draft visibility by access-token role, DTO validation and CRUD payload mapping.

Bugs found: none.

BATCH STATUS: PASSED

## BATCH 6 SUMMARY

Modules: attendance service and selected controller mappings.

Tests: 19 passed; 0 failed; 0 skipped. Covers member/admin check-in, schedule/window/session rules, attendance upsert/cancellation, status aggregation, CSV escaping, session CRUD/cleanup and member session mapping. Controller tests cover member check-in validation, admin ABSENT cancellation, summary/export mapping.

Bugs found: none. Remaining controller handlers are mostly direct mappings to independently tested services; the Matrix entries should be read as service behavior coverage, not a claim that every Express route callback has its own test.

BATCH STATUS: PASSED

## BATCH 7 SUMMARY

Modules: general and attendance stats, stats routes, Cloudinary wrapper/upload validation, Prisma seed tooling.

Tests: 16 passed; 0 failed; 0 skipped. Cloudinary was stubbed; PNG/JPEG/GIF/WebP signature checks, provider failures, and Multer's exact 5 MiB/one-byte-over boundary are covered.

Bugs found: none. Multer's 5 MiB transport limit is exercised directly as middleware using an in-memory multipart stream; exact-limit succeeds and one byte over returns `LIMIT_FILE_SIZE`.

Seed script: added an injectable `seedDatabase` boundary and guarded CLI entry point. Tests import the module without running the destructive seed; all Prisma methods, Faker, hashing, time, randomness, and logging use injected fakes. `npm run seed` continues to execute the same seed workflow.

BATCH STATUS: PASSED

## Final inventory notes

- `src/app.ts`, `src/routes.ts`, `src/index.ts`, and the Prisma singleton are assembly/bootstrap code. The listener was not started and the database was not contacted. Middleware/route behaviors with independent logic were tested at their module boundaries. The seed CLI is now import-safe and covered with injected dependencies.
- The Express listener/bootstrap was not started; server binding and live middleware integration remain outside unit scope. Multer's middleware itself was exercised with an in-memory multipart request.
