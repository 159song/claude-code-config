---
phase: 04-session-management
reviewed: 2026-04-13T12:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - commands/wf/next.md
  - commands/wf/pause.md
  - commands/wf/resume.md
  - hooks/wf-session-state.js
  - settings.json
  - wf/bin/lib/session.cjs
  - wf/workflows/next.md
  - wf/workflows/session.md
findings:
  critical: 0
  warning: 3
  info: 3
  total: 6
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-04-13T12:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** issues_found

## Summary

Reviewed the session management infrastructure for the WF workflow system: 3 command entry points (next, pause, resume), 1 SessionStart hook (wf-session-state.js), 1 library module (session.cjs), 1 settings config (settings.json), and 2 workflow definitions (next.md, session.md).

Overall the code is well-structured and follows project conventions. Security considerations (path traversal guard on session_id, step whitelist validation, phase integer validation) are properly implemented. The main concerns are: (1) a potential race condition where `sessionResume` deletes HANDOFF.json before the caller has consumed the returned data, contradicting the workflow document's intended order; (2) `JSON.parse` in the hook's `main()` is inside a try/catch but the error context is completely lost; and (3) the inline YAML parser has an edge-case limitation that could silently drop values. No critical security vulnerabilities were found.

## Warnings

### WR-01: sessionResume deletes HANDOFF before workflow routes to Skill()

**File:** `wf/bin/lib/session.cjs:191`
**Issue:** `sessionResume()` calls `deleteHandoff(cwd)` on line 191, removing HANDOFF.json and .continue-here.md, then outputs the handoff data. However, the resume workflow in `wf/workflows/session.md` (Step 3 and Step 4) describes reading the handoff data first, routing to the correct Skill() in Step 3, and then calling `wf-tools session resume` in Step 4 to clean up. This means the CLI `session resume` subcommand both returns data AND deletes files atomically. If the orchestrating agent calls `session resume` in Step 1 (as shown in session.md Step 1's code block suggesting `session status`), and then again in Step 4, the second call will fail with "No HANDOFF.json found" and exit(1). The workflow document is internally consistent (Step 1 uses `session status`, Step 4 uses `session resume`), but the code's atomic read-and-delete behavior means any caller that accidentally calls `resume` instead of `status` first will lose the checkpoint data even if the subsequent routing fails. This is fragile.
**Fix:** Split the `sessionResume` function into two explicit operations, or add a `--no-delete` flag:

```javascript
// Option A: Add a peek mode
function sessionResume(cwd, args) {
  const noclean = args.includes('--peek');
  const handoff = readHandoff(cwd);
  if (!handoff) {
    utils.output({ success: false, error: 'No HANDOFF.json found' });
    process.exit(1);
  }
  // ... validation ...
  if (!noclean) {
    deleteHandoff(cwd);
  }
  utils.output({ success: true, handoff: handoff, cleaned: !noclean });
}
```

### WR-02: Inline frontmatter parser skips lines that are blank or contain only whitespace

**File:** `hooks/wf-session-state.js:46`
**Issue:** Line 46 `if (!line) continue;` skips empty lines in the YAML block, but also causes the parser to lose track of `currentParent` context when a blank line appears between a parent key and its children. For example, if STATE.md contains:

```yaml
---
progress:

  current_phase: 3
  percent: 40
---
```

The blank line after `progress:` will not reset `currentParent`, so `current_phase` and `percent` will still be parsed as children of `progress` -- this happens to work correctly by accident. However, if two top-level blocks are separated by a blank line, a child of the second block could be misattributed to the first parent because `currentParent` is never reset by blank lines. This is unlikely with current STATE.md schemas but is a latent bug in the parser.
**Fix:** Reset `currentParent` when encountering a non-indented, non-matching line:

```javascript
for (const line of lines) {
  if (!line.trim()) {
    // Blank line does not change currentParent (YAML allows blank lines in blocks)
    continue;
  }

  // Indented line = child key of currentParent
  const indentMatch = line.match(/^(\s+)([\w][\w_]*):\s*(.*)$/);
  if (indentMatch && currentParent) {
    // ... existing child logic ...
    continue;
  }

  // If line is indented but no currentParent, skip (orphan)
  if (indentMatch && !currentParent) {
    continue;
  }

  // Top-level key
  const match = line.match(/^([\w][\w_]*):\s*(.*)$/);
  if (match) {
    // ... existing top-level logic ...
  } else {
    // Unrecognized line at top level - reset parent context
    currentParent = null;
  }
}
```

### WR-03: parseFm does not handle frontmatter starting with `---\r\n` (Windows line endings)

**File:** `hooks/wf-session-state.js:32`
**Issue:** The frontmatter guard on line 32 checks `content.startsWith('---\n')` and the end delimiter is searched with `'\n---\n'` on line 35. If a STATE.md file is edited on Windows or by a tool that uses CRLF line endings, the parser will fail silently and return an empty frontmatter object, causing the hook to display no state information. The project lists Windows (WSL/Git Bash) as a supported platform.
**Fix:** Normalize line endings before parsing:

```javascript
function parseFm(content) {
  if (!content) return { frontmatter: {}, body: content || '' };
  // Normalize CRLF to LF for cross-platform compatibility
  const normalized = content.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { frontmatter: {}, body: content };
  }
  const endIdx = normalized.indexOf('\n---\n', 4);
  // ... rest uses normalized ...
}
```

## Info

### IN-01: Empty catch block on bridge file write

**File:** `hooks/wf-session-state.js:226`
**Issue:** The bridge file write on line 225 has a completely empty catch block. While this follows project conventions for non-critical hook operations (silent failure to prevent deadlock), the bridge file is read by other hooks and `/wf-resume`. If it silently fails to write, those consumers will operate without session state, and the failure will be invisible.
**Fix:** Consider at minimum writing to stderr so operators can diagnose issues:

```javascript
} catch (e) {
  // Non-blocking: bridge file is convenience, not critical
  // fs.writeSync(2, `wf-session-state: bridge write failed: ${e.message}\n`);
}
```

### IN-02: deleteHandoff always returns success even if files do not exist

**File:** `wf/bin/lib/session.cjs:77-85`
**Issue:** `deleteHandoff()` catches all errors from `fs.unlinkSync()` and always returns `{ success: true }`. This means callers cannot distinguish between "files were cleaned up" and "files did not exist." While this is acceptable for the current usage (cleanup after resume), it makes the function's return value semantically misleading.
**Fix:** Return more precise status if needed by future callers:

```javascript
function deleteHandoff(cwd) {
  let handoffDeleted = false;
  let continueDeleted = false;
  try { fs.unlinkSync(handoffPath); handoffDeleted = true; } catch (e) {}
  try { fs.unlinkSync(continuePath); continueDeleted = true; } catch (e) {}
  return { success: true, handoff_deleted: handoffDeleted, continue_deleted: continueDeleted };
}
```

### IN-03: settings.json statusLine missing timeout field

**File:** `settings.json:39-41`
**Issue:** The `statusLine` configuration on lines 39-41 does not specify a `timeout` value, unlike the PostToolUse and PreToolUse hooks which set explicit timeouts (10s and 5s respectively). If `wf-statusline.js` hangs or is slow, there is no explicit timeout guard. Claude Code may have a default timeout, but being explicit improves resilience and consistency with the other hook configurations.
**Fix:** Add explicit timeout:

```json
"statusLine": {
  "type": "command",
  "command": "node \"$HOME/.claude/hooks/wf-statusline.js\"",
  "timeout": 5
}
```

---

_Reviewed: 2026-04-13T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
