# Research Summary: WF Workflow System Optimization

**Domain:** Claude Code workflow/plugin orchestration system
**Researched:** 2026-04-10
**Overall confidence:** HIGH

## Executive Summary

WF is a Claude Code workflow system modeled after GSD (Get Shit Done). Both systems share the same fundamental architecture: slash-command routing -> workflow orchestration -> agent execution -> file-based state persistence. WF's 6-layer architecture is structurally sound -- the layers are correct and the data flow direction is right.

The critical gaps are not architectural (WF does not need a redesign) but operational: the **connective tissue** between layers is underdeveloped. GSD has evolved through 134+ minor versions to develop compound init commands (single CLI call returns all workflow context), agent completion contracts (structured handoff between agents and workflows), state mutation safety (all writes through CLI), and context budget architecture (tiered degradation rules). These are the patterns that make GSD reliable and context-efficient at scale.

The quantitative gap is significant: GSD has 14,620 lines of CLI code across 22 modules vs WF's 324 lines in one file. GSD has 68 workflows vs WF's 9. GSD has 35 reference documents vs WF's 3. But WF should not try to match GSD's feature count -- it should adopt GSD's highest-impact patterns (compound init, CLI modularization, state mutation safety) and let the feature set grow organically.

The single most impactful change is compound init commands: replacing 5-10 file reads per workflow invocation with a single CLI call that returns pre-computed JSON context. This alone would eliminate 60-70% of WF's unnecessary context consumption.

## Key Findings

**Stack:** Node.js CommonJS for CLI tooling, Markdown for workflow definitions, JSON for structured data exchange between CLI and workflows. This matches GSD and should not change.

**Architecture:** WF's 6-layer model is correct. The optimization target is the interfaces between layers, not the layers themselves. The CLI tool is the most under-invested component.

**Critical pitfall:** Direct state file mutation (Write/Edit to STATE.md) is the most dangerous pattern in the current codebase -- it causes format corruption and race conditions under parallel execution.

## Implications for Roadmap

Based on research, suggested phase structure:

1. **CLI Foundation** - Modularize wf-tools.cjs and implement compound init commands
   - Addresses: Context efficiency, state safety, extensibility
   - Avoids: Monolithic file anti-pattern, full-file read anti-pattern
   - Rationale: Every subsequent improvement depends on a robust CLI

2. **State Mutation Safety** - Route all STATE.md/ROADMAP.md mutations through CLI
   - Addresses: State corruption bugs, parallel execution reliability
   - Avoids: Direct mutation anti-pattern
   - Rationale: Must be done before improving autonomous execution

3. **Agent Contracts** - Define completion markers and handoff schemas
   - Addresses: Workflow-agent handoff reliability
   - Avoids: Agent completion detection bugs
   - Rationale: Enables reliable autonomous mode

4. **Reference Document Suite** - Codify architectural rules as reference docs
   - Addresses: Context budget rules, anti-patterns, continuation format
   - Avoids: Rule drift, inconsistent behavior across workflows
   - Rationale: Low effort, high consistency payoff

5. **Workflow Enhancement** - Improve individual workflow robustness
   - Addresses: Error handling, edge cases, user experience
   - Avoids: Workflow stalling issues noted in PROJECT.md
   - Rationale: Builds on the foundation from phases 1-4

6. **Advanced Features** - Milestone lifecycle, session resumption, templates
   - Addresses: Feature parity with GSD where valuable
   - Rationale: Only after the foundation is solid

**Phase ordering rationale:**
- CLI foundation must come first because every other improvement depends on reliable CLI commands
- State mutation safety depends on CLI modularization (new state commands need to exist)
- Agent contracts depend on understanding how workflows route (informed by CLI init work)
- Reference docs can be written incrementally alongside other work but are best codified after patterns are established
- Workflow enhancement benefits from all earlier phases being in place

**Research flags for phases:**
- Phase 1 (CLI Foundation): Standard patterns from GSD, unlikely to need research
- Phase 2 (State Safety): Standard patterns from GSD, unlikely to need research
- Phase 3 (Agent Contracts): May need research on Claude Code agent/task behavior specifics
- Phase 5 (Workflow Enhancement): Likely needs deeper investigation of specific stalling issues

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Architecture | HIGH | Direct source comparison of both codebases |
| CLI Gap Analysis | HIGH | Line-by-line comparison of wf-tools.cjs vs gsd-tools.cjs |
| Context Efficiency | HIGH | GSD's patterns are well-documented in its own reference docs |
| Optimization Priorities | HIGH | Based on quantitative gap analysis and dependency ordering |
| Feature Gaps | MEDIUM | Some GSD features may not be relevant to WF's use case |

## Gaps to Address

- WF's workflow stalling issues need runtime diagnosis (not researchable from static code)
- Specific context window metrics (how much context each WF workflow actually consumes) need measurement
- User experience issues mentioned in PROJECT.md need hands-on testing to characterize
- Hook optimization (reducing unnecessary triggers) needs runtime profiling data
