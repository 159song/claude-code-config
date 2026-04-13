# Codebase Concerns

**Analysis Date:** 2026-04-13

## Tech Debt

### 1. Implicit Type Conversions in YAML Parsing

**Issue:** Manual YAML parsing with implicit type conversions lacks robust validation.

**Files:**
- `hooks/wf-session-state.js` (lines 80-92, `parseVal()` function)
- `wf/bin/lib/state.cjs` (lines 17-37, `parseYamlValue()` function)

**Impact:** Type coercion edge cases can silently produce incorrect values. String "123abc" becomes integer 123 instead of remaining a string. This causes state corruption when YAML values contain unexpected formats.

**Fix approach:** Implement strict type checking instead of fuzzy coercion. Use explicit type tags in frontmatter (e.g., `status: !!str "123"`), or validate against schema before parsing.

### 2. Duplicate YAML Parsing Logic

**Issue:** Frontmatter parsing is duplicated across multiple files without shared utility.

**Files:**
- `hooks/wf-session-state.js` (lines 31-72, `parseFm()`)
- `wf/bin/lib/state.cjs` (lines 65-120+, `parseFrontmatter()`)
- Inline parsing in other workflow files

**Impact:** Bug fixes in one parser don't propagate. Maintenance burden increases with each copy.

**Fix approach:** Extract frontmatter parsing into a single, shared utility module (`wf/bin/lib/frontmatter.cjs`) and import everywhere. Reduces maintenance surface from 3+ files to 1.

### 3. Silent Failures in Hook Context

**Issue:** All hook scripts use `process.exit(0)` on error, hiding failures silently.

**Files:**
- `hooks/wf-context-monitor.js` (lines 24, 114-116)
- `hooks/wf-prompt-guard.js` (lines 35, 89-91)
- `hooks/wf-statusline.js` (lines 10, 88-90)
- `hooks/wf-session-state.js` (lines 13, 20-22)

**Impact:** When hooks crash due to unexpected input format, JSON parsing errors, or file I/O issues, the hook exits cleanly (code 0), making it impossible to debug. Real failures are indistinguishable from successful no-ops. Prevents monitoring and increases support burden.

**Fix approach:** 
1. Log errors to stderr before exiting (still exit 0 to avoid blocking Claude Code)
2. Implement structured error logging to `/tmp/wf-hook-errors-{sessionId}.log`
3. Add debug mode flag in config to enable verbose hook logging

## Known Bugs

### 1. Context Metrics Race Condition

**Symptoms:** Context warning appears inconsistently or with stale values; statusline sometimes shows incorrect percentage.

**Files:**
- `hooks/wf-statusline.js` (lines 33-40, writes bridge file)
- `hooks/wf-context-monitor.js` (lines 46-51, reads bridge file)

**Trigger:** Rapid tool invocations cause both hooks to read/write `/tmp/claude-ctx-{sessionId}.json` simultaneously, resulting in partial writes or reads of incomplete JSON.

**Workaround:** Close and reopen the status line UI to refresh context reading. Context warnings will appear on the next tool call.

**Fix approach:** 
1. Use atomic file operations: write to temp file, then `fs.renameSync()`
2. Add file locking via `node-file-lock` or equivalent
3. Implement exponential backoff + retry for reads (up to 3 retries)

### 2. Path Traversal Validation Gaps

**Issue:** Session ID validation uses regex but may miss edge cases.

**Files:**
- `hooks/wf-context-monitor.js` (line 34)
- `hooks/wf-statusline.js` (line 30)
- Both use: `/[/\\]|\.\./.test(sessionId)`

**Impact:** Session IDs containing null bytes, encoded dots (`%2E`), or other bypass techniques could potentially access unintended files or cause injection attacks, though impact is limited since only reading `/tmp/` files.

**Fix approach:** Whitelist allowed characters instead of blacklist: `/^[a-zA-Z0-9_-]+$/.test(sessionId)`. Session IDs should only contain alphanumerics, dash, underscore.

## Security Considerations

### 1. Prompt Injection Detection Limitations

**Risk:** Injection patterns in `wf-prompt-guard.js` use heuristic regex, not comprehensive detection.

**Files:** `hooks/wf-prompt-guard.js` (lines 11-29, `INJECTION_PATTERNS` array)

**Current mitigation:**
- Negative lookahead patterns reduce false positives for common terms
- Invisible Unicode character detection (line 60)
- Advisory-only warnings, no blocking

**Issue:** Sophisticated prompt injection can bypass regex-based detection. Patterns like "from now on you will" without comma may slip through. Base64 or ROT13 encoded injections won't match.

**Recommendations:**
1. Treat as advisory defense layer, not primary security boundary
2. Document that true prompt injection defense requires content moderation at agent level
3. Add external prompt injection detector API calls (e.g., OpenAI Moderation API) for high-risk documents
4. Log all detected patterns to audit trail for review

### 2. Temporary File Permissions

**Risk:** Bridge files in `/tmp/` are world-readable by default.

**Files:**
- `hooks/wf-statusline.js` (line 40, writes to `/tmp/claude-ctx-{sessionId}.json`)
- `hooks/wf-context-monitor.js` (line 62, writes to `/tmp/claude-ctx-{sessionId}-warned.json`)

**Current mitigation:** Session ID validation prevents access to other users' sessions

**Issue:** On shared systems, other users can read context metrics and warning state. May leak that a project is under resource pressure.

**Recommendations:**
1. Set restrictive permissions after write: `fs.chmodSync(path, 0o600)` (Unix only)
2. Alternative: Use `~/.claude/.wf-metrics/` instead of `/tmp/` for better isolation
3. For sensitive projects, disable context warnings via `config.hooks.context_warnings = false`

### 3. JSON Injection via Markdown Content

**Risk:** Frontmatter parser writes user-controlled content to JSON bridge files without sanitization.

**Files:**
- `wf/bin/lib/state.cjs` (lines 45-56, `formatYamlValue()`)
- Uses simple quote wrapping, not full JSON escaping

**Current mitigation:** YAML values are quoted but not deep-escaped for embedded quotes or newlines

**Issue:** If state contains value like `foo"bar` or `foo\nbar`, JSON output becomes malformed or injects extra fields.

**Recommendations:**
1. Use `JSON.stringify()` for all values in JSON output (already correct)
2. For YAML frontmatter, use proper YAML escaping library instead of manual quoting
3. Add round-trip test: write value → read value → assert equality (catches escaping bugs)

## Performance Bottlenecks

### 1. Synchronous File I/O in Hooks

**Problem:** All hook scripts use synchronous file operations, blocking execution.

**Files:**
- `hooks/wf-context-monitor.js` (lines 39-41, 51, 68, 80, 86)
- `hooks/wf-statusline.js` (lines 40, 64-69, 73)
- `hooks/wf-session-state.js` (similar patterns)

**Cause:** Hooks must return JSON synchronously to Claude Code; async operations would miss the response window.

**Improvement path:**
1. Pre-populate `/tmp/` files in SessionStart hook before tools run (single operation)
2. Cache metadata in memory for quick lookup (tradeoff: loss of cross-session accuracy)
3. Use `fs.readFileSync()` with 1-3s timeout only on `.planning/` config (not per-tool)

### 2. Regex Pattern Compilation Per Hook Call

**Problem:** `INJECTION_PATTERNS` array in `wf-prompt-guard.js` recompiles regex on every tool call.

**Files:** `hooks/wf-prompt-guard.js` (lines 53-56, loop over patterns)

**Cause:** No caching; each pattern test is O(pattern count) per character class.

**Impact:** Minimal on small files, but noticeable on large documents (>100KB).

**Improvement path:**
1. Pre-compile patterns at module load (done correctly in current code, but verify)
2. Short-circuit on first match instead of scanning all patterns (lines 54-56 can break early)
3. Profile actual execution time; if <10ms, not a priority

## Fragile Areas

### 1. `.planning/` Directory Initialization Order

**Files:**
- `wf/workflows/new-project.md` (initializes project structure)
- `wf/bin/lib/init.cjs` (creates directories)
- All downstream workflows expect fixed structure

**Why fragile:**
- No idempotency checks; re-running init may overwrite existing files
- Template files in `.planning/config.json` assume specific keys
- If directory creation partially fails (permissions, disk full), state becomes inconsistent

**Safe modification:**
1. Always check if directory exists before creating: `if (fs.existsSync(path)) return;`
2. Back up existing `.planning/` before re-init (via `/wf-checkpoint`)
3. Add validation step after init to verify all required files exist

**Test coverage:** Check if test suite covers partial failure recovery (likely missing).

### 2. YAML Frontmatter Format Assumption

**Files:**
- `wf/bin/lib/state.cjs` (parser assumes strict `---\n ... \n---\n` format)
- All workflows that write STATE.md

**Why fragile:**
- If frontmatter uses `---` without trailing newline or with extra spaces, parser breaks silently
- No error message; user gets empty/corrupted state
- Difficult to debug without examining raw file bytes

**Safe modification:**
1. Use YAML library (`js-yaml` or `yaml`) instead of manual parsing
2. If staying with manual parser, add validation: count frontmatter sections, warn if != 2
3. Add round-trip test: serialize → deserialize → assert deep equality

**Test coverage:** Add test case for edge-case frontmatter formats (missing newline, extra spaces, UTF-8 BOM).

### 3. Agent Resume Path Handling

**Files:**
- `agents/wf-executor.md` (line 28, `resume_from` parameter)
- `wf/bin/lib/state.cjs` (resume parsing logic)
- Executor must handle partial SUMMARY.md files

**Why fragile:**
- Partial SUMMARY may reference files that no longer exist (deleted in current execution)
- Resume assumes task ordering is stable; if plan changes, resume offset breaks
- No validation that resumed task corresponds to current plan

**Safe modification:**
1. Always validate resume SUMMARY matches current PLAN before resuming
2. Require explicit `/wf-resume --force` to override mismatches
3. Check file existence for all artifacts listed in resume before continuing

**Test coverage:** Test resume with modified plan (new task inserted before resume point).

### 4. Context Metric Stale Data Check

**Files:** `hooks/wf-context-monitor.js` (lines 54)

**Why fragile:** 60-second stale timeout is hardcoded. If statusline hook hasn't run in >60s, context-monitor ignores all warnings and exits silently.

**Safe modification:**
1. Make timeout configurable: `config.hooks.metrics_stale_seconds` (default 60)
2. Log stale detection to help debug timeouts
3. Add fallback: if metrics are stale, query context via alternative method (if available)

## Scaling Limits

### 1. Session ID Namespace Collision

**Current capacity:** `/tmp/claude-ctx-{sessionId}.json` limited by `/tmp/` filesystem

**Limit:** On long-running IDE instances with many sequential projects, session ID might collide or accumulate stale files.

**Scaling path:**
1. Implement cleanup: remove `/tmp/claude-ctx-*` files older than 24 hours
2. Switch to timestamped session IDs or UUID format to reduce collision risk
3. Monitor `/tmp/` usage; warn if cleanup is needed

### 2. Large Phase Execution

**Current capacity:** Phase execution expects all tasks fit in single PLAN.md (per design spec: max 3 tasks/plan)

**Limit:** If plan contains >5 tasks with complex dependencies, context budget exhausted during execution.

**Scaling path:**
1. Implement wave-based execution: split large phase into multiple 3-task waves
2. Use `/wf-autonomous --from N --to N --wave K` to run sequential waves in parallel sessions
3. Verify wave dependencies via `depends_on` field validation

## Dependencies at Risk

### 1. Manual YAML Parsing Maintenance

**Risk:** YAML spec changes or new syntax breaks custom parser.

**Impact:** STATE.md files become unreadable; all workflows fail.

**Migration plan:** Adopt `yaml` or `js-yaml` npm package. Provide migration script to convert existing `.planning/STATE.md` to canonical YAML format.

### 2. Node.js Compatibility

**Risk:** Code uses `process.stdin` / `process.stdout` directly; assumes Node.js >= 14.

**Impact:** If Claude Code environment updates Node.js, hooks may break due to API changes or deprecations.

**Migration plan:** Add Node.js version check in SessionStart hook; warn if < 14 detected.

## Test Coverage Gaps

### 1. Hook Error Scenarios

**What's not tested:** Hook failures under edge conditions:
- Malformed JSON input to hooks
- Missing required fields in context data
- `/tmp/` full or unwritable

**Files:** `hooks/*.js` (no test files exist)

**Risk:** High — production failures have no safety net.

**Priority:** HIGH — Add test suite for hook scripts.

### 2. State File Corruption Recovery

**What's not tested:** Partial or corrupted STATE.md recovery.

**Files:** `wf/bin/lib/state.cjs`, `wf/bin/lib/state.test.cjs`

**Coverage:** Unit tests cover happy path; missing edge cases (incomplete frontmatter, missing body, mixed YAML/bullet-list format).

**Risk:** MEDIUM — Users encountering corruption must manually fix files.

**Priority:** MEDIUM — Add corruption detection and repair tests.

### 3. Concurrent Workflow Execution

**What's not tested:** Multiple agents writing to STATE.md simultaneously.

**Files:** `wf/bin/lib/state.cjs` (uses synchronous writes, no locking)

**Risk:** MEDIUM — Rare but possible in autonomous mode with parallel waves; last write wins, earlier updates lost.

**Priority:** MEDIUM — Add file-locking tests or mutex implementation.

### 4. Cross-Platform File Path Handling

**What's not tested:** Windows vs. Unix path separators in bridge files.

**Files:**
- `hooks/wf-context-monitor.js` (line 34, `/[/\\]/` check)
- `hooks/wf-prompt-guard.js` (line 47, both separators checked)

**Coverage:** Tests likely run on macOS only; Windows path edge cases untested.

**Risk:** LOW-MEDIUM — Path traversal bypass possible on Windows.

**Priority:** LOW — Add Windows CI test step.

---

*Concerns audit: 2026-04-13*
