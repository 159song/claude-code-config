# Domain Pitfalls

**Domain:** Claude Code workflow plugin optimization (WF system)
**Researched:** 2026-04-10
**Method:** Full code audit of WF codebase + comparison with GSD reference implementation

---

## Critical Pitfalls

Mistakes that cause broken workflows, silent failures, or complete workflow stalls.

---

### Pitfall 1: Hook Path Mismatch -- Hooks Are Not Installed Where Settings Expects Them

**What goes wrong:** `settings.json` references `.claude/hooks/wf-*.js` but all hook files physically reside at `hooks/wf-*.js` (at the repo root, not inside `.claude/`). This means **every hook is silently non-functional** when the repo is used as a Claude Code config directory.

**Files and evidence:**
- `settings.json` line 8: `"command": "bash .claude/hooks/wf-session-state.sh"`
- `settings.json` line 15: `"command": "node .claude/hooks/wf-context-monitor.js"`
- `settings.json` line 23: `"command": "node .claude/hooks/wf-prompt-guard.js"`
- `settings.json` line 39: `"command": "node .claude/hooks/wf-statusline.js"`
- Actual hook locations: `hooks/wf-context-monitor.js`, `hooks/wf-prompt-guard.js`, `hooks/wf-statusline.js`, `hooks/wf-session-state.sh`
- Verification: `ls -la .claude/hooks/` returns "Directory does not exist"

**Why it happens:** The system was designed as a user-level config (installed to `~/.claude/`) where the hooks directory would be at `~/.claude/hooks/` and settings.json references `.claude/hooks/` relative to the project or home dir. But the repo structure places hooks at the root level, and no install script copies/links them to `.claude/hooks/`.

**Consequences:**
- Context monitor never fires -- no context budget warnings
- Prompt guard never fires -- no injection detection
- Session state never fires -- no project state reminder on session start
- Statusline never fires -- no status display
- User believes all safety features are active when none are

**Prevention:**
- Either move hooks into `.claude/hooks/` directory, OR update `settings.json` to reference the correct paths
- Add a validation check that runs `ls` on every hook path referenced in settings.json
- GSD avoids this problem by using absolute paths: `$HOME/.claude/get-shit-done/hooks/...`

**Detection:** Run `/wf-progress` and notice no statusline appears. Check if context warnings fire when context is > 65% used.

**Phase:** Must be fixed in Phase 1 (foundational fix, blocks all hook functionality).

---

### Pitfall 2: `{{WF_ROOT}}` Template Variable Never Resolved

**What goes wrong:** All 9 command files reference `@{{WF_ROOT}}/wf/workflows/*.md` and `@{{WF_ROOT}}/wf/references/*.md` as `execution_context`. This is a template variable that is **never substituted** with an actual path. Claude Code's `@` file reference mechanism requires real paths.

**Files and evidence:**
- `commands/wf/do.md` lines 16-17: `@{{WF_ROOT}}/wf/workflows/do.md`
- `commands/wf/new-project.md` lines 26-29: four `@{{WF_ROOT}}/...` references
- All other command files: same pattern (74 total instances per CONCERNS.md)
- No install script, no substitution utility, no evidence of a build step

**Why it happens:** The system was designed with the intent to have an install step that replaces `{{WF_ROOT}}` with the actual path. That install step was never built.

**Consequences:**
- `execution_context` references resolve to nothing -- Claude cannot load the workflow instructions
- Commands become hollow shells: they tell Claude to "follow the workflow" but Claude cannot read the workflow file
- Claude falls back to interpreting the command description alone, producing unpredictable results
- Every single `/wf-*` command is affected

**Prevention:**
- Option A: Replace `{{WF_ROOT}}` with absolute paths (like GSD uses `$HOME/.claude/get-shit-done/...`)
- Option B: Build an install script that performs substitution
- Option C: Use environment variable `$WF_ROOT` that Claude Code can resolve at runtime
- Add a smoke test that verifies all `@` references in command files resolve to real files

**Detection:** Run any `/wf-*` command. If Claude asks "what should I do?" instead of following the workflow, the references are broken.

**Phase:** Must be fixed in Phase 1 (blocks all command functionality).

---

### Pitfall 3: wf-tools.cjs Uses Relative Path `.planning` -- Breaks in Sub-Agent Contexts

**What goes wrong:** `wf-tools.cjs` hardcodes `const PLANNING_DIR = '.planning'` (line 21) as a relative path. When sub-agents run in worktrees, different CWDs, or sandboxed environments, `.planning` resolves to the wrong location or doesn't exist.

**Files and evidence:**
- `wf/bin/wf-tools.cjs` line 21: `const PLANNING_DIR = '.planning';`
- All functions use this relative constant: `readFile(path.join(PLANNING_DIR, 'STATE.md'))` etc.
- No `--cwd` flag, no project root resolution, no worktree awareness

**Comparison with GSD:**
- `gsd-tools.cjs` lines 221-258: Full CWD resolution with `--cwd` flag, worktree root detection, `findProjectRoot()` traversal
- GSD resolves the actual project root before any file operations
- GSD handles linked worktrees where `.planning/` lives in the main worktree

**Consequences:**
- Sub-agents spawned with `isolation: "worktree"` cannot find `.planning/`
- CLI tool produces empty/wrong results when called from a subdirectory
- Progress reporting and state management fail silently in parallel execution

**Prevention:**
- Add `--cwd` flag support (like GSD)
- Implement `findProjectRoot()` that traverses up until `.planning/` is found
- Implement `resolveWorktreeRoot()` for git worktree scenarios
- Accept CWD from environment variable as fallback

**Detection:** Run `node wf-tools.cjs progress` from a subdirectory -- returns `{"progress": 0, "phases": []}` even when phases exist.

**Phase:** Phase 1 (blocks parallel execution and sub-agent workflows).

---

### Pitfall 4: No Session Resume / State Recovery Workflow

**What goes wrong:** WF has no `/wf-resume` command and no mechanism to recover context when a session ends mid-workflow. Users returning to a project must manually figure out where they left off.

**Files and evidence:**
- `commands/wf/` contains 9 commands: `do`, `new-project`, `discuss-phase`, `plan-phase`, `execute-phase`, `verify-work`, `autonomous`, `quick`, `progress` -- no resume
- `wf-session-state.sh` only shows the first 20 lines of STATE.md -- insufficient for full context restoration
- No HANDOFF.json mechanism, no `.continue-here` files, no interrupted agent detection

**Comparison with GSD:**
- GSD has a full `resume-project.md` workflow (286 lines) that:
  - Reads HANDOFF.json for structured handoff data
  - Detects `.continue-here` files for mid-plan resumption
  - Finds plans without summaries (incomplete execution)
  - Detects interrupted agents
  - Reconstructs STATE.md if missing
  - Offers contextual next-action routing

**Consequences:**
- Users waste 5-10 minutes per session figuring out "where was I?"
- Context budget is consumed reading files that a resume workflow would pre-load
- Incomplete executions (session timeout) leave no breadcrumbs for the next session
- The autonomous workflow cannot reliably resume mid-phase

**Prevention:**
- Implement `/wf-resume` that mirrors GSD's resume-project workflow
- Add HANDOFF.json generation when context monitor detects critical threshold
- Session state hook should inject full context summary, not just first 20 lines

**Detection:** Start a new session on a project mid-phase. If you have to manually read STATE.md, ROADMAP.md, and the current phase's files, resume is missing.

**Phase:** Phase 2 (essential UX improvement, but core commands must work first).

---

### Pitfall 5: Autonomous Workflow Has No Concrete Implementation -- It's Aspirational Pseudocode

**What goes wrong:** The autonomous workflow (`wf/workflows/autonomous.md`) describes what should happen but provides no actual executable steps. It uses `cat .planning/ROADMAP.md` and `cat .planning/STATE.md` as inline bash -- which does nothing useful because the output is not parsed or acted upon. Compare this to GSD's autonomous.md which has 1057 lines of precise, step-by-step instructions with real tool invocations.

**Files and evidence:**
- `wf/workflows/autonomous.md` lines 22-28: "reads" files with `cat` but no JSON parsing, no state extraction
- `wf/workflows/autonomous.md` line 55: "调用 discuss-phase 工作流，使用 `--auto --batch` 模式" -- but no `Skill()` invocation, no actual tool call
- No `gsd-tools.cjs init milestone-op` equivalent to bootstrap context
- No roadmap phase analysis to determine which phases are complete
- No VERIFICATION.md reading for post-execution routing
- No handle_blocker step for error recovery

**Comparison with GSD:**
- GSD autonomous.md (1057 lines) includes: concrete bash commands for state loading, JSON parsing of `roadmap analyze` output, explicit `Skill()` invocations for each sub-workflow, detailed verification routing (passed/human_needed/gaps_found), gap closure with retry limits, lifecycle management (audit/complete/cleanup), interactive mode pipelining
- Every step in GSD has explicit error detection: "If `has_context` is false..."

**Consequences:**
- `/wf-autonomous` is the "recommended default entry" per the docs but produces inconsistent results
- Claude interprets the aspirational instructions differently each time
- No gap closure after failed verification -- workflow just says "自动进行一次 gap closure" without specifying how
- No lifecycle management after all phases complete
- Error recovery is described but not implemented

**Prevention:**
- Rewrite autonomous.md with concrete `Skill()` invocations for each sub-step
- Add explicit `wf-tools.cjs` calls for state bootstrapping and phase discovery
- Add verification routing with explicit status checking
- Implement handle_blocker with retry/skip/stop options

**Detection:** Run `/wf-autonomous`. If Claude outputs banners but doesn't actually invoke discuss/plan/execute in sequence, the workflow is aspirational.

**Phase:** Phase 2 (major workflow rewrite, depends on Phase 1 fixing tool/command infrastructure).

---

### Pitfall 6: `wf-tools.cjs` Missing Critical Commands vs GSD

**What goes wrong:** WF's CLI tool has 8 commands covering basic state operations. GSD's CLI tool has 70+ commands covering the full workflow lifecycle. Critical missing commands mean WF workflows fall back to brittle inline bash parsing instead of reliable structured output.

**Files and evidence:**

| Capability | GSD Has | WF Has | Impact of Missing |
|---|---|---|---|
| `init execute-phase <N>` | Yes -- returns JSON with all context | No | Orchestrator must manually load 5+ files |
| `init plan-phase <N>` | Yes | No | Same -- brittle context loading |
| `init resume` | Yes | No | No structured resume capability |
| `roadmap get-phase <N>` | Yes -- extracts specific phase | No | Must parse ROADMAP.md with regex |
| `phase complete <N>` | Yes | No | Manual STATE.md updates |
| `phase add/insert/remove` | Yes | No | No dynamic phase management |
| `validate consistency` | Yes | No | No self-repair capability |
| `validate health [--repair]` | Yes | No | No integrity checking |
| `verify plan-structure` | Yes | No | Plan quality must be checked manually |
| `verify phase-completeness` | Yes | No | No automated completeness check |
| `scaffold context/uat/verification` | Yes | No | Templates must be created manually |
| `frontmatter get/set/merge/validate` | Yes | No | No structured metadata management |
| `state advance-plan` | Yes | No | Manual plan counter updates |
| `state add-decision/add-blocker` | Yes | No | Manual state tracking |
| `state record-session` | Yes | No | No session continuity |
| `websearch` | Yes (Brave API) | No | No web search integration |
| `commit` with `--files` | Yes | Partial (no `--files`) | `gitCommitPlanning()` only commits `.planning/` |

- `wf/bin/wf-tools.cjs`: 324 lines, 8 commands
- GSD `bin/gsd-tools.cjs`: 1047 lines (entry point) + modular `lib/` directory with 15+ modules

**Consequences:**
- Workflows that reference `wf-tools.cjs` for operations it doesn't support will fail
- Agents must use fragile inline bash/grep to extract state, which breaks when format changes
- No structured JSON output for init operations -- orchestrator wastes context parsing markdown
- No validation/health checks -- corrupted state goes undetected

**Prevention:**
- Prioritize implementing `init` compound commands (execute-phase, plan-phase, resume, quick)
- Add `roadmap get-phase` and `phase complete`
- Add `validate health` for self-repair
- Structure as modular `lib/` directory (like GSD) to manage complexity

**Detection:** Grep workflow files for `wf-tools.cjs` calls that reference non-existent commands.

**Phase:** Phase 1-2 (init commands in Phase 1, advanced features in Phase 2).

---

### Pitfall 7: Session State Hook Outputs Raw Markdown Instead of Structured Context

**What goes wrong:** `wf-session-state.sh` uses `head -20 .planning/STATE.md` to dump the first 20 lines of STATE.md as-is. This wastes context tokens on markdown formatting characters and provides incomplete state information.

**Files and evidence:**
- `hooks/wf-session-state.sh` line 9: `head -20 .planning/STATE.md`
- Output includes markdown headers, bullet markers, status formatting -- all noise
- Only first 20 lines shown -- might cut off mid-section
- No JSON output, no structured data

**Comparison with GSD:**
- GSD's session hook uses `gsd-tools.cjs init resume` which returns structured JSON
- Includes: current phase, plan count, completion %, blockers, interrupted agents, handoff data
- Minimal token usage, maximum information density

**Consequences:**
- 20 lines of raw markdown consumes ~200 tokens of context on every session start
- Claude must re-parse the markdown to understand state, consuming more context
- If STATE.md template changes, the raw output may be misleading
- No blocker detection, no interrupted agent detection, no smart routing

**Prevention:**
- Replace with `node wf-tools.cjs state json` to output structured JSON
- Add `wf-tools.cjs init resume` and use that for session start context
- Keep output under 10 lines of dense, actionable information

**Detection:** Start a session and check the injected context -- if it's raw markdown with `##` headers, the hook is unoptimized.

**Phase:** Phase 1 (low effort, high impact on context budget).

---

## Moderate Pitfalls

Issues that cause degraded performance, poor UX, or correctness problems under certain conditions.

---

### Pitfall 8: Prompt Guard Has False Positive on "act as a" in Documentation

**What goes wrong:** The regex `act\s+as\s+(?:a|an|the)\s+(?!plan|phase|wave)/i` triggers on legitimate documentation like "Act as a quality reviewer" or "act as an architect" in CONTEXT.md or PLAN.md files.

**Files and evidence:**
- `hooks/wf-prompt-guard.js` line 18: `act\s+as\s+(?:a|an|the)\s+(?!plan|phase|wave)/i`
- Negative lookahead only excludes `plan`, `phase`, `wave` -- misses common legitimate uses: `developer`, `architect`, `reviewer`, `tester`, `user`, `admin`, `system`
- Advisory only (non-blocking), but warning text injects into agent context and consumes tokens

**Consequences:**
- Every CONTEXT.md that describes roles triggers a false injection warning
- Warning text "PROMPT INJECTION 警告" in agent context can cause Claude to become overly cautious
- Repeated false positives train users to ignore real warnings

**Prevention:**
- Expand negative lookahead: `(?!plan|phase|wave|developer|architect|reviewer|tester|user|admin|role|agent|system|service|module|component|function|class|method)`
- Better: Add allowlist for files that are known-safe (e.g., anything matching `CONTEXT.md`, `PLAN.md`, `REQUIREMENTS.md`)
- Add a `<!-- wf:safe -->` comment to suppress warnings for specific sections

**Phase:** Phase 1 (quick regex fix).

---

### Pitfall 9: Context Monitor Debounce State Persists Across Sessions

**What goes wrong:** The debounce file `/tmp/claude-ctx-{session_id}-warned.json` and the metrics bridge file `/tmp/claude-ctx-{session_id}.json` are never cleaned up. If a session ID is reused (or similar), stale data can cause wrong behavior in a new session.

**Files and evidence:**
- `hooks/wf-context-monitor.js` line 62: reads warn file from `/tmp/`
- `hooks/wf-statusline.js` line 34: writes bridge file to `/tmp/`
- No cleanup mechanism (no SessionEnd hook, no TTL, no garbage collection)
- STALE_SECONDS check (line 54, 60 seconds) helps but only for the metrics file, not the warn state file

**Consequences:**
- `/tmp` accumulates abandoned JSON files (two per session)
- On systems with aggressive session ID recycling, stale warn state could suppress important warnings
- No way to manually clean up without knowing session IDs

**Prevention:**
- Add TTL check to warn state file (not just metrics file)
- Use `.planning/.tmp/` directory (project-scoped, visible, git-ignorable)
- Add cleanup in session state hook or a `/wf-cleanup` command
- Write both files with `{ mode: 0o600 }` for security

**Phase:** Phase 2 (non-critical but accumulates tech debt).

---

### Pitfall 10: Executor Agent Has No Context Budget Awareness

**What goes wrong:** The `wf-executor.md` agent instructions say "execute all tasks" but provide no guidance on what to do when context runs low mid-execution. The agent will keep executing until Claude's context window fills, then produce truncated or incomplete output.

**Files and evidence:**
- `agents/wf-executor.md`: No mention of context budget, no checkpoint mechanism
- `agents/wf-planner.md` line 37: Mentions "计划应在 ~50% context 内完成执行" but this is planner guidance, not executor enforcement
- No "save state and exit" instruction
- No partial-completion tracking

**Comparison with GSD:**
- GSD executor has explicit context budget rules: save SUMMARY.md checkpoint at 60% usage, hard-stop at 75%
- GSD uses `.continue-here` files so the next session can resume mid-plan

**Consequences:**
- Long execution phases silently fail when context exhausts
- No checkpoint saved -- work must be redone from scratch
- Autonomous mode stalls with no recovery mechanism

**Prevention:**
- Add context budget awareness to executor agent instructions
- Implement `.continue-here` checkpoint files
- Add "at 70% context usage, save progress and stop" rule
- Have orchestrator monitor executor context via bridge file

**Phase:** Phase 2 (requires agent instruction updates and checkpoint mechanism).

---

### Pitfall 11: `roadmapAnalyze()` Status Detection Is Simplistic

**What goes wrong:** The roadmap analysis in `wf-tools.cjs` determines phase status purely by file existence checks. A phase with a `VERIFICATION.md` that says "FAIL" is still marked as "verified".

**Files and evidence:**
- `wf/bin/wf-tools.cjs` lines 138-143:
  ```javascript
  let status = 'pending';
  if (hasVerification) status = 'verified';
  else if (hasSummary) status = 'executed';
  else if (hasPlans) status = 'planned';
  else if (hasContext) status = 'discussed';
  ```
- No content inspection: doesn't read VERIFICATION.md for pass/fail status
- No SUMMARY.md inspection: doesn't check if tasks actually passed

**Comparison with GSD:**
- GSD's `roadmap analyze` reads VERIFICATION.md frontmatter for `status:` field
- GSD distinguishes between `complete`, `in-progress`, `gaps_found`, `human_needed`
- GSD reads disk state AND roadmap state and reconciles

**Consequences:**
- `/wf-progress` shows a failed phase as "verified" (green checkmark)
- Autonomous mode skips failed phases thinking they're done
- Gap closure never triggers because the system thinks verification passed

**Prevention:**
- Read VERIFICATION.md content and parse for PASS/FAIL/WARN status
- Read SUMMARY.md to count completed vs total tasks
- Add disk_status field that reflects actual content, not just file existence

**Phase:** Phase 1 (correctness bug in progress calculation).

---

### Pitfall 12: No `--no-transition` Flag in Execute-Phase -- Autonomous Mode Cannot Manage Transitions

**What goes wrong:** GSD's execute-phase accepts `--no-transition` so the autonomous orchestrator can manage phase transitions itself. WF's execute-phase has `--wave`, `--interactive`, and `--chain` but no equivalent. This means execute-phase and autonomous may compete over phase state updates.

**Files and evidence:**
- `commands/wf/execute-phase.md` line 5: `"<phase-number> [--wave N] [--interactive] [--chain]"`
- `wf/workflows/execute-phase.md` lines 150-152: Always updates STATE.md and marks phase complete
- `wf/workflows/autonomous.md` line 97: Also updates STATE.md
- No mechanism to prevent double-update

**Comparison with GSD:**
- GSD execute-phase.md accepts `--no-transition` flag
- When invoked from autonomous, always passes `--no-transition`
- Autonomous manages its own transition logic after reading verification status

**Consequences:**
- STATE.md may be updated twice per phase in autonomous mode
- Race condition: execute-phase marks phase complete before autonomous reads verification
- Autonomous may skip gap closure because execute-phase already advanced the state

**Prevention:**
- Add `--no-transition` flag to execute-phase
- When flag is set, skip STATE.md update and phase completion
- Autonomous always passes `--no-transition`

**Phase:** Phase 2 (important for autonomous workflow correctness).

---

### Pitfall 13: Workflow Files Reference `Agent()` and `Skill()` Invocations Without Defining Them

**What goes wrong:** Workflow files (e.g., `wf/workflows/new-project.md` line 76, `execute-phase.md` line 47) reference `Agent()` calls with `subagent_type`, `isolation`, etc. These are pseudocode showing intent, but Claude Code's actual Task/Agent tool has specific parameter names. If Claude interprets these literally, it may hallucinate non-existent API parameters.

**Files and evidence:**
- `wf/workflows/new-project.md` line 76: `Agent({ subagent_type: "wf-researcher", prompt: "..." })`
- `wf/workflows/execute-phase.md` line 47: `Agent({ subagent_type: "wf-executor", isolation: "worktree", ... })`
- Claude Code's actual tool API uses `Task()` (not `Agent()`) with parameters like `prompt`, `description`, `subagent_type`, `model`

**Comparison with GSD:**
- GSD uses the actual `Task()` or `Skill()` syntax that Claude Code understands
- GSD explicitly names parameter syntax: `Task(prompt="...", subagent_type="gsd-executor", ...)`

**Consequences:**
- Claude may try to call `Agent()` which doesn't exist as a tool
- Parameter names like `isolation: "worktree"` may be hallucinated
- Workflow execution becomes inconsistent and model-dependent

**Prevention:**
- Replace `Agent()` with the actual `Task()` tool syntax
- Use `Skill()` for invoking other WF commands
- Document the exact API surface in a reference file

**Phase:** Phase 2 (workflow rewrite).

---

## Minor Pitfalls

Issues that cause friction, suboptimal performance, or cosmetic problems.

---

### Pitfall 14: `wf-tools.cjs` `phaseInfo()` Regex Fails for Multi-Line Goals

**What goes wrong:** The regex for extracting phase name and goal assumes the goal is on a single line immediately after the phase header:

```javascript
const pattern = new RegExp(
  `## Phase ${phaseNum}:\\s*(.+?)\\n\\n\\*\\*目标:\\*\\*\\s*(.+?)\\n`, 's'
);
```

If the goal spans multiple lines or there's extra whitespace, the regex fails silently and `info.name` and `info.goal` are undefined.

**Files and evidence:**
- `wf/bin/wf-tools.cjs` lines 183-191
- The `(.+?)` with `\\n` terminus is fragile -- fails on multiline goals

**Prevention:**
- Use a more robust parser that reads until the next `##` or `---`
- Or use frontmatter-based metadata extraction (like GSD's approach)

**Phase:** Phase 1 (quick fix to parser).

---

### Pitfall 15: `stateSet()` Assumes Chinese Section Headers

**What goes wrong:** `stateSet()` uses a hardcoded regex `^(## 当前状态\n\n)/m` to find the insertion point for new keys. If the STATE.md template is modified or uses different headers, new keys are silently not written.

**Files and evidence:**
- `wf/bin/wf-tools.cjs` lines 99-101:
  ```javascript
  content = content.replace(
    /^(## 当前状态\n\n)/m,
    `$1- **${key}:** ${value}\n`
  );
  ```
- Template at `wf/templates/state.md` line 3: `## 当前状态`

**Prevention:**
- Use a generic section-finding regex that works with any header text
- Or add a `[metadata]` section with structured key-value format
- Or use frontmatter YAML (like GSD) for machine-readable state

**Phase:** Phase 1 (robustness fix).

---

### Pitfall 16: `gitCommitPlanning()` Always Stages All of `.planning/`

**What goes wrong:** The commit function does `git add .planning/` which stages everything, including files that may not be part of the current operation. This can accidentally commit partial work from other operations.

**Files and evidence:**
- `wf/bin/wf-tools.cjs` line 239: `execFileSync('git', ['add', '.planning/'], { stdio: 'pipe' });`
- No `--files` parameter to specify which files to stage
- GSD's commit command accepts `--files f1 f2` for selective staging

**Prevention:**
- Add `--files` parameter to the commit command
- Stage only specified files, not the entire `.planning/` directory
- Implement dirty-check before commit: verify only expected files changed

**Phase:** Phase 1 (safety improvement for git operations).

---

### Pitfall 17: Quick Workflow Has No Task Tracking in STATE.md

**What goes wrong:** The `/wf-quick` workflow stores results in `.planning/quick/` but never updates STATE.md. Quick task history is invisible to resume and progress workflows.

**Files and evidence:**
- `wf/workflows/quick.md`: No mention of STATE.md update
- No "Quick Tasks Completed" section in state template

**Comparison with GSD:**
- GSD quick.md Step 7: Explicitly adds a row to "Quick Tasks Completed" table in STATE.md
- Includes: task ID, description, date, commit hash, status, directory link

**Prevention:**
- Add STATE.md update step to quick workflow
- Create "Quick Tasks Completed" tracking table
- Record task ID, description, commit hash

**Phase:** Phase 2 (feature gap).

---

### Pitfall 18: Verify-Work Workflow's Smoke Test Uses `sleep 5` and `curl`

**What goes wrong:** The smoke test in verify-work.md uses `npm run dev &` followed by `sleep 5` and `curl localhost:3000`. This is brittle -- the dev server may take longer than 5 seconds to start, may use a different port, or may not be a web server at all.

**Files and evidence:**
- `wf/workflows/verify-work.md` lines 34-40:
  ```bash
  npm run dev &
  sleep 5
  curl -s http://localhost:3000 > /dev/null && echo "SERVER_OK" || echo "SERVER_FAIL"
  kill %1 2>/dev/null
  ```
- Hardcoded port 3000, hardcoded 5-second wait
- Background process not reliably killed on failure

**Prevention:**
- Make port configurable via config.json
- Use retry loop with health check instead of fixed sleep
- Detect actual start scripts from package.json
- Add timeout to prevent hanging

**Phase:** Phase 3 (workflow polish).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Hook infrastructure fix | Changing paths may break existing user installations | Add migration script that detects old paths |
| Template variable resolution | Hardcoding absolute paths reduces portability | Use `$HOME` or environment variable pattern |
| CLI tool expansion | Adding 50+ commands at once creates maintenance burden | Add modular lib/ structure first, then commands |
| Autonomous workflow rewrite | Rewrite may break existing user workflows | Keep old workflow as fallback, add new as `autonomous-v2.md` during testing |
| Agent instruction updates | Changes to agent prompts may change behavior in unexpected ways | Test each agent change independently before integrating |
| Resume workflow | STATE.md format changes may break existing projects | Add schema versioning, backwards-compatible parsing |

---

## Missing GSD Capabilities That WF Should Consider

These are not bugs but significant feature gaps that affect competitiveness:

1. **No `/wf-next` command** -- GSD has a "what's my next step?" quick-router
2. **No code review workflow** -- GSD has `code-review.md` + `code-review-fix.md` auto-chain
3. **No milestone lifecycle** -- GSD has `audit-milestone`, `complete-milestone`, `milestone-summary`
4. **No health/validate command** -- GSD has `validate health --repair` for self-healing
5. **No pause-work workflow** -- GSD generates HANDOFF.json for structured session handoff
6. **No codebase mapping** -- GSD has `map-codebase.md` for building `.planning/codebase/` intel
7. **No workstream/workspace support** -- GSD supports parallel milestone work via workstreams
8. **No learnings system** -- GSD has cross-project learnings that persist
9. **No UI phase/review** -- GSD has specialized workflows for frontend phases
10. **No `--pick` flag for CLI JSON output** -- GSD lets workflows extract specific JSON fields without jq

---

## Sources

- Full code audit of all files in `/Users/zxs/Desktop/claude-code-config/` (hooks, agents, commands, workflows, references, templates, wf-tools.cjs)
- Comparison with GSD reference implementation at `~/.claude/get-shit-done/` (bin/gsd-tools.cjs, workflows/, agents/)
- Existing concerns analysis at `.planning/codebase/CONCERNS.md`

---

*Pitfalls audit: 2026-04-10*
