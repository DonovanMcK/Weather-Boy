# QA Report: <branch / feature>

- **Date:**
- **Environment:** local / staging URL:
- **Derived from diff:** routes/pages/commands affected:

## Flows tested

| Flow | States exercised (empty/loading/error/success/invalid) | Result |
|---|---|---|
| | | pass / fail |

## Visual QA

Screenshots captured at 375 / 768 / 1440 px for each affected page.
Attach or link them.

Per-screenshot checklist:

- [ ] No overflow, clipping, or overlapping elements
- [ ] Layout intact at all three viewports (nothing collapsed or stacked wrong)
- [ ] Empty state renders something intentional (not a blank region)
- [ ] Loading state visible and not layout-shifting on resolve
- [ ] Error state visible, readable, and actionable
- [ ] Text readable (contrast, truncation, wrapping)
- [ ] Interactive elements visually identifiable; focus states present
- [ ] Before/after pair reviewed for intentional visual changes

## Findings

```
[SEVERITY] flow/page — finding
Evidence: screenshot filename or repro steps
```

## Fixes applied

| Finding | Fix commit | Regression test | Re-verified |
|---|---|---|---|
| | | | ☐ |

## Verdict

- [ ] Verification commands were run this session; output attached above
      (claims without output don't count — docs/08-failure-modes.md)
- [ ] Ship
- [ ] Ship after listed fixes
- [ ] Back to implementation
