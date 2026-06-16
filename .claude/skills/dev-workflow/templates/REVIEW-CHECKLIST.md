# Review Checklists

Run each lens as a **separate pass in fresh context** (new session or
subagent), read-only, against the diff plus the plan. Output format per
finding:

```
[SEVERITY] file:line — finding
Scenario: one concrete sentence describing how this fails/is exploited.
```

Severities: HIGH (ship-blocker), MED (fix before merge unless argued),
LOW (note it). A finding with no concrete scenario is LOW at best.

---

## Lens 1 — Correctness & robustness

- [ ] Race conditions: can two requests/tabs/jobs interleave on the same
      state? Are read-modify-write sequences atomic?
- [ ] Partial failure: for every multi-step operation, what is persisted if
      step N fails? Is cleanup/rollback handled or are orphans created?
- [ ] Idempotency: can retries (user, client, queue) duplicate effects?
- [ ] N+1 queries and missing indexes on new query paths.
- [ ] New enum/status/type values: traced through EVERY switch, map, and
      allowlist in the codebase — not just changed files.
- [ ] Error handling: are errors swallowed, logged-and-ignored, or
      surfaced? Do error paths leave consistent state?
- [ ] Resource lifecycle: connections, file handles, listeners, timers —
      released on all paths including error paths?
- [ ] Invariants stated in the plan: still enforced under concurrency?
- [ ] Tests: do they assert the failure modes from the plan, or only the
      happy path? Would any test still pass if the feature were broken?
- [ ] Test integrity: diff the tests themselves. No assertions weakened,
      no tests skipped or deleted, no hardcoded expected outputs, no
      special-casing of the exact inputs the tests use, no errors
      swallowed to get green (see docs/08-failure-modes.md).

## Lens 2 — Security & trust boundaries

- [ ] Every new external input validated by content, not by
      client-supplied metadata (file type, declared length, headers).
- [ ] Injection: SQL/command/path injection on new inputs; prompt injection
      anywhere fetched web content or model output feeds another query,
      command, or model call.
- [ ] Authorization on every new route/action — including the non-obvious
      ones (bulk endpoints, export, admin variants), not just the primary.
- [ ] Secrets: none in the diff, none in logs, none in error messages or
      client-visible responses.
- [ ] New dependencies: necessary, maintained, and pinned? Exact package
      name verified on the registry and pointing at the project you think
      it is — agents hallucinate plausible names, and typo-shaped names
      get registered by attackers (see docs/08-failure-modes.md).
- [ ] Anything user-controlled rendered into HTML/markdown: escaped?

## Lens 3 — Plan conformance & completeness

- [ ] Everything in the plan's steps is present, or explicitly deferred
      with the plan document updated.
- [ ] Nothing significant in the diff is absent from the plan.
- [ ] Non-goals respected: the fenced-off areas are untouched.
- [ ] Diff file list contains no surprise files.
- [ ] Shortcut check: where the implementation chose the 80% version, is
      the 100% version actually cheap? If so, flag it.
- [ ] Reuse check: for every new helper/utility in the diff, search the
      codebase — did something already do this?
- [ ] Docs that describe changed behavior are updated (README, API docs).
- [ ] Context file (CLAUDE.md / AGENTS.md) still accurate after this change.
