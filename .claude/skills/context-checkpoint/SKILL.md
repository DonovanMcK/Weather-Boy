---
name: context-checkpoint
description: Use when context usage needs checking or a compact/clear decision is due — a context warning or usage figure appears, the user asks whether to compact or clear, the session shows degradation (re-read files, repeated corrections, forgotten constraints), or a dev-workflow phase boundary is reached (step committed, review or QA report delivered).
---

# Context Checkpoint

Measured usage for this session (may be unavailable):

!`python "${CLAUDE_SKILL_DIR}/scripts/context_usage.py" "${CLAUDE_SESSION_ID}"`

You are deciding whether the session should reset, and recommending — you
cannot run `/compact` or `/clear` yourself; only the user can.

## 1. Get a real number

- If the measurement above shows a percentage, use it.
- Otherwise ask the user to run `/context` (or read their status line) and
  tell you the figure. **Never guess a percentage, and never act on a
  guessed one.**

## 2. Under 40%: report and continue

One line — "Context at ~N%, no reset needed" — then back to the task.

## 3. At or past 40%: recommend a reset at the next clean boundary

A clean boundary is a just-committed step, a just-delivered review or QA
report — any moment the working state is written down. First finish reaching
the boundary (complete the commit, deliver the artifact); never stop
mid-edit. Then recommend exactly one of:

**Clear and reseed — preferred when state is written down.** If the plan
document is committed and current: have the user fill the session-handoff
template (bundled docs/templates/SESSION-HANDOFF.md if the repo has it;
otherwise: current step, decisions not yet in the plan, next action, known
landmines — you can draft it for them), then `/clear`, then seed the new
session with the plan and the handoff. In Claude Code, `/clear` keeps the
old conversation available under `/resume`, so nothing is lost.

**Compact — when state is NOT yet written down.** Mid-task with decisions
that exist only in conversation: offer to write the handoff note now, and
give the user a ready-to-paste command with explicit preservation
instructions, e.g.:

```
/compact preserve: the plan at docs/plans/<file>, current step <N> and its
status, decisions made this session, unresolved findings, the exact next action
```

Past 60%, or if auto-compact has already fired this session: recommend
clear-and-reseed, not compact — the deliberate reset is overdue.

## 4. Rot symptoms override the number

If the session shows two or more of — re-reading files already read,
re-asking answered questions, contradicting a recorded decision, forgetting
a context-file or plan constraint — recommend the reset **now**, at whatever
the usage number is, and name the symptoms. Do not offer "just push on" as
the default option.

## Rules

- A measured or user-provided number only; never invented.
- Never claim to have compacted or cleared — recommend, with the exact
  command, and let the user run it.
- 40% is the default threshold (rationale: docs/07-context-hygiene.md);
  honor a different threshold if the user has set one.
- This skill checks only when invoked. The automatic nudge comes from the
  optional hook (`scripts/context_hook.py` next to this file — setup
  instructions in its header). If the user relies on the 40% rule, recommend
  once per project that they install the hook and a status line showing
  `context_window.used_percentage`.
