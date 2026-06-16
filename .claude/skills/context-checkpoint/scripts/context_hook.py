#!/usr/bin/env python3
"""UserPromptSubmit hook: nudge the agent once context usage crosses a threshold.

This is the mechanical half of the 40% rule (docs/07-context-hygiene.md).
The context-checkpoint skill supplies judgment when invoked; this hook makes
the invocation happen automatically by injecting a one-line reminder into the
agent's context when usage crosses the threshold.

Setup — add to .claude/settings.json (project) or ~/.claude/settings.json:

  {
    "hooks": {
      "UserPromptSubmit": [
        {
          "hooks": [
            {
              "type": "command",
              "command": "python \"%USERPROFILE%/.claude/skills/context-checkpoint/scripts/context_hook.py\""
            }
          ]
        }
      ]
    }
  }

(Adjust the path to wherever the skill is installed; on macOS/Linux use
$HOME instead of %USERPROFILE%.)

Fires at most once per 10-percentage-point band per session, so it nudges
at ~40%, again at ~50%, and so on — not on every prompt.

No dependencies; Python 3.8+. Fails silent: a hook error should never block
a prompt.
"""
import json
import os
import sys
import tempfile

THRESHOLD = 40  # percent; the 40% rule. Edit to taste.
DEFAULT_WINDOW = 200_000


def latest_usage(path):
    last = None
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    rec = json.loads(line)
                except json.JSONDecodeError:
                    continue
                usage = (rec.get("message") or {}).get("usage")
                if usage and usage.get("input_tokens") is not None:
                    last = usage
    except OSError:
        return None
    return last


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    transcript = data.get("transcript_path") or ""
    session = data.get("session_id") or "unknown"
    usage = latest_usage(transcript)
    if not usage:
        return
    used = (
        (usage.get("input_tokens") or 0)
        + (usage.get("cache_creation_input_tokens") or 0)
        + (usage.get("cache_read_input_tokens") or 0)
    )
    pct = round(100 * used / DEFAULT_WINDOW)
    if pct < THRESHOLD:
        return

    # Hysteresis: fire once per 10-point band per session.
    band = pct // 10
    state = os.path.join(tempfile.gettempdir(), f"context-checkpoint-{session}.state")
    prev = -1
    try:
        with open(state, encoding="utf-8") as f:
            prev = int(f.read().strip())
    except Exception:
        pass
    if band <= prev:
        return
    try:
        with open(state, "w", encoding="utf-8") as f:
            f.write(str(band))
    except Exception:
        pass

    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"Context usage is ~{pct}%, past the {THRESHOLD}% checkpoint "
                        "(docs/07-context-hygiene.md). At the next clean boundary — "
                        "committed step, delivered report — invoke the "
                        "context-checkpoint skill and recommend the user compact or "
                        "clear. Do not stop mid-edit."
                    ),
                }
            }
        )
    )


if __name__ == "__main__":
    main()
