# Plan: <short title>

- **Date:**
- **Branch:**
- **Size estimate:** small / medium / large
- **Status:** draft / approved / shipped / retro-done

## 1. Problem

What is broken or missing, from the user's point of view. One paragraph.

## 2. Non-goals

What this change will NOT do. Be specific — this is the scope-creep fence.

- This change will not …
- This change will not …

## 3. Premises

Falsifiable claims this plan depends on. The agent must verify each against
the actual code before implementation and mark it ✅/❌. Library claims count
too — "library X at our pinned version exposes method Z" is a premise,
verified against the installed version's docs, not the agent's memory.

| # | Premise | Verified |
|---|---|---|
| 1 | | |
| 2 | | |

## 4. Approach

### Considered alternatives

| Approach | Effort | Key tradeoff |
|---|---|---|
| A. | | |
| B. | | |

### Chosen approach and why

## 5. Design

Affected files/modules, data flow, and state transitions. For anything with
more than two moving parts, include a diagram (ASCII is fine).

Existing helpers/modules this change should reuse (the agent must search
before claiming none exist):

-

## 6. Failure modes

| Scenario | Expected behavior |
|---|---|
| Partial failure (step X succeeds, step Y fails) | |
| Retry / duplicate request | |
| Concurrent access | |
| Empty / oversized / malformed input | |

## 7. UI states (delete section if no UI)

| Screen/component | Empty | Loading | Error | Success | Narrow viewport |
|---|---|---|---|---|---|
| | | | | | |

## 8. Test plan

| Case | Level (unit/integration/e2e) | Covers failure mode # |
|---|---|---|
| | | |

## 9. Steps

Ordered, checkpoint-sized. One commit per step.

1.
2.
3.

## 10. Retro (fill after shipping)

- Premises that turned out wrong:
- Missing from this plan:
- Context-file updates made:
