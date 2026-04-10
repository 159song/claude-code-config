---
phase: 1
slug: cli-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-10
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js assert / manual CLI verification |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `node wf/bin/wf-tools.cjs state json` |
| **Full suite command** | `node wf/bin/wf-tools.cjs init plan-phase 1` |
| **Estimated runtime** | ~2 seconds |

---

## Sampling Rate

- **After every task commit:** Run `node wf/bin/wf-tools.cjs state json`
- **After every plan wave:** Run `node wf/bin/wf-tools.cjs init plan-phase 1`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | INFRA-01 | — | N/A | integration | `node wf/bin/wf-tools.cjs init plan-phase 1` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFRA-02 | — | N/A | unit | `node wf/lib/*.js --test` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | INFRA-03 | — | N/A | integration | `grep -r 'wf-' settings.json` | ✅ | ⬜ pending |
| TBD | TBD | TBD | INFRA-04 | — | N/A | grep | `grep -r '{{WF_ROOT}}' commands/` | ✅ | ⬜ pending |
| TBD | TBD | TBD | INFRA-05 | — | N/A | integration | `node wf/bin/wf-tools.cjs --cwd /tmp state json` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Test runner infrastructure for CLI module verification
- [ ] Fixture data for mock `.planning/` directory structures

*If none: "Existing infrastructure covers all phase requirements."*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Hook triggers in Claude Code | INFRA-03 | Requires live Claude Code session | Open Claude Code, trigger a Bash tool call, check hook log output |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
