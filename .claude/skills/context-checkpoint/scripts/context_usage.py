#!/usr/bin/env python3
"""Print current Claude Code context usage, read from the session transcript.

Usage: python context_usage.py [session_id]

Claude Code writes a JSONL transcript per session under ~/.claude/projects/.
The latest assistant message's `usage` block holds the token counts currently
in the window: input_tokens + cache_creation_input_tokens +
cache_read_input_tokens. That sum over the window size is the same figure the
status line's context_window.used_percentage reports.

No dependencies; Python 3.8+. If anything fails, prints "unknown" — the
caller falls back to asking the user to run /context.
"""
import glob
import json
import os
import sys

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
    session = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("CLAUDE_SESSION_ID", "")
    root = os.path.expanduser(os.path.join("~", ".claude", "projects"))
    pattern = (
        os.path.join(root, "*", session + ".jsonl")
        if session
        else os.path.join(root, "*", "*.jsonl")
    )
    files = glob.glob(pattern)
    if not files:
        print("context usage: unknown (no transcript found; ask the user to run /context)")
        return
    path = max(files, key=os.path.getmtime)
    usage = latest_usage(path)
    if not usage:
        print("context usage: unknown (no usage data yet; ask the user to run /context)")
        return
    used = (
        (usage.get("input_tokens") or 0)
        + (usage.get("cache_creation_input_tokens") or 0)
        + (usage.get("cache_read_input_tokens") or 0)
    )
    pct = round(100 * used / DEFAULT_WINDOW)
    print(
        f"context usage: ~{pct}% of a {DEFAULT_WINDOW // 1000}k window "
        f"({used:,} tokens in the latest turn). "
        "If this session runs an extended 1M window, the true percentage is one fifth of this."
    )


if __name__ == "__main__":
    main()
