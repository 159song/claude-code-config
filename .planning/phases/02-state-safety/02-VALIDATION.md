---
phase: 02
slug: state-safety
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js built-in test runner (node --test) |
| **Config file** | none — tests use direct node invocation |
| **Quick run command** | `node --test wf/bin/lib/*.test.cjs` |
| **Full suite command** | `node --test wf/bin/lib/*.test.cjs` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node --test wf/bin/lib/*.test.cjs`
- **After every plan wave:** Run `node --test wf/bin/lib/*.test.cjs`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | STATE-04 | — | N/A | unit | `node --test wf/bin/lib/state.test.cjs` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | STATE-05 | — | N/A | unit | `node --test wf/bin/lib/state.test.cjs` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | STATE-03 | — | N/A | unit | `node --test wf/bin/lib/validate.test.cjs` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | STATE-06 | — | N/A | unit | `node --test wf/bin/lib/state.test.cjs` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | STATE-02 | — | N/A | integration | `node wf/bin/wf-tools.cjs roadmap analyze` | ✅ | ⬜ pending |
| 02-04-01 | 04 | 3 | STATE-01 | — | N/A | grep | `grep -r 'Write\|Edit.*STATE' wf/workflows/ agents/` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `wf/bin/lib/state.test.cjs` — tests for frontmatter CRUD, patch, begin-phase, advance-plan
- [ ] `wf/bin/lib/validate.test.cjs` — tests for validate/health/repair commands

*Existing test infrastructure from Phase 1 covers the pattern.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workflow files migrated from Write/Edit to CLI | STATE-01 | Requires grep audit of markdown files | `grep -rn 'Write\|Edit' wf/workflows/ agents/ commands/` — verify no direct STATE.md mutations |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
