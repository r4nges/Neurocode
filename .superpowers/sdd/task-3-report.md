# Task 3 Report — Serviço de conteúdo

## Status: DONE_WITH_CONCERNS

## Implementation Summary

Created two files and patched one config:

- **`server/src/content/service.js`** — verbatim from brief. Exports `listRoadmaps`, `getRoadmap`, `getCourse`, `getLesson`, `completeLesson`. Locking: roadmap `isLocked` ⇒ all courses locked; course locked if predecessor (order−1) not fully completed; first non-completed lesson in unlocked course is `available`, rest `locked`. `completeLesson` upserts `Progress` only (no XP/neuroPoints/level/badges), returns `{ ok, nextLessonId, courseCompleted }` or `{ error: 'not-found'|'locked' }`.

- **`server/tests/content.service.test.js`** — verbatim from brief (9 tests across 5 describe blocks).

- **`server/vitest.config.js`** — added `fileParallelism: false` (vitest 2 option). See concern below.

## TDD Evidence

### RED (before service.js existed)
```
FAIL  tests/content.service.test.js (0 test)
Error: Failed to load url ../src/content/service.js — Does the file exist?
Test Files: 1 failed | 13 passed (14)
```

### First GREEN attempt — partial failure (3 tests failed)
Root cause: vitest runs test files in parallel by default. `content.seed.test.js` calls `seedContent()` twice (its idempotency test), which deletes and recreates all lesson rows with new auto-increment IDs. `content.service.test.js` ran concurrently and had stale lesson IDs in `Progress` records, causing:
- `lessons[0].status` still `'available'` after completing it (Progress pointed to old ID)
- `lessons[2]` undefined (lesson count appeared < 3)
- `nextLessonId` null (ID mismatch in siblings lookup)

Fix: `fileParallelism: false` in vitest.config.js serializes test file execution — seed test runs after service test (or vice-versa, deterministically), no more race.

### Final GREEN
```
✓ tests/content.service.test.js (9 tests)  91ms
Test Files: 14 passed (14)
Tests:      51 passed (51)
Duration:   6.60s
```

## Files Changed

| File | Action |
|------|--------|
| `server/src/content/service.js` | Created (130 lines) |
| `server/tests/content.service.test.js` | Created (141 lines) |
| `server/vitest.config.js` | Modified — added `fileParallelism: false` |

## Commit

```
f19b4a1 feat(server): serviço de conteúdo com bloqueio sequencial e conclusão de aula
```

## Concerns

**`fileParallelism: false` is a deviation from the brief.** The brief only listed `service.js` and `content.service.test.js` as files to create/change. The config change was necessary because `content.seed.test.js` (Task 2) calls `seedContent()` during its idempotency test, deleting and recreating lesson rows mid-suite, which races with `content.service.test.js`. With SQLite (single writer) and Prisma, parallel file execution caused non-deterministic ID collisions.

The fix is minimal and correct for a SQLite test suite, but the next task owner should be aware that:
1. All test files now run sequentially (slightly slower, ~6.6s vs ~3.3s parallel).
2. If Task 2's idempotency test is ever moved to use a fresh DB snapshot instead of mutating the shared `test.db`, parallelism could be restored.
3. Alternatively, the seed's `deleteMany + create` pattern could be replaced with a true upsert-per-lesson (matching on `courseId + order`) to keep IDs stable across re-seeds — but that would require changing Task 2's seed.js.

---

## Fix: stable-id seed

### What changed

- **`server/src/content/seed.js`** — replaced the `deleteMany + create` loop with an update-in-place approach. For each seed lesson, we look up the existing row by `(courseId, order)`; if found, we `update` it in place (stable ID); if not, we `create` it. After processing all seed lessons for a course, we `deleteMany` only the stale rows whose `order` is not in the seed set. The roadmap/course upsert-by-slug logic is unchanged.

- **`server/vitest.config.js`** — removed the `fileParallelism: false` workaround; test files now run in parallel again.

### Commands run

```bash
cd server && npm test   # run 1
cd server && npm test   # run 2
```

### Run 1 output (parallel)

```
Test Files  14 passed (14)
      Tests  51 passed (51)
   Duration  3.26s
```
stderr: clean (only Prisma migration banner from global-setup).

### Run 2 output (parallel)

```
Test Files  14 passed (14)
      Tests  51 passed (51)
   Duration  3.29s
```
stderr: clean.

### Concerns

None. Both parallel runs are identical and deterministic. The race between `content.seed.test.js` and `content.service.test.js` is eliminated at the root: lesson IDs no longer change on re-seed.
