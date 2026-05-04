#!/usr/bin/env python3
"""Report stale tasks — follow-ups waiting too long, elicitations sitting too long.

Usage:
    python stale_check.py <ea-state-dir> [--wait-days N] [--elicit-days M]

Defaults: --wait-days 3, --elicit-days 7. Both are business-day-ish
(simple calendar-day count; good enough for nudging).

Exit codes:
    0 — nothing stale
    1 — stale items found (useful for wiring into cron/tinyclaw:
        `if stale_check ...; then send_nudge; fi`)
    2 — error
"""

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

TASK_RE = re.compile(r"^\s*-\s*\[(.)\]\s*(.+?)\s*$")
SINCE_RE = re.compile(r"\bsince:(\d{4}-\d{2}-\d{2})\b")
SRC_RE = re.compile(r"\bsrc:(\S+)\b")


def days_since(date_str: str, today: dt.date) -> int:
    try:
        d = dt.date.fromisoformat(date_str)
    except ValueError:
        return -1
    return (today - d).days


def main():
    p = argparse.ArgumentParser()
    p.add_argument("root", help="ea-state directory")
    p.add_argument("--wait-days", type=int, default=3)
    p.add_argument("--elicit-days", type=int, default=7)
    p.add_argument("--decision-days", type=int, default=5,
                   help="Days before an unresolved [?] decision is flagged stale")
    args = p.parse_args()

    root = Path(args.root)
    open_path = root / "tasks" / "open.md"
    if not open_path.exists():
        print(f"No open.md at {open_path}", file=sys.stderr)
        sys.exit(2)

    today = dt.date.today()
    stale_waiting = []
    stale_elicit = []
    stale_decisions = []

    for lineno, line in enumerate(open_path.read_text().splitlines(), start=1):
        m = TASK_RE.match(line)
        if not m:
            continue
        status_char = m.group(1)
        text = m.group(2)

        if status_char == ">":
            since = SINCE_RE.search(text)
            if since:
                age = days_since(since.group(1), today)
                if age >= args.wait_days:
                    stale_waiting.append((age, line.strip()))
        elif status_char == "~":
            src = SRC_RE.search(text)
            if src:
                date_match = re.search(r"\d{4}-\d{2}-\d{2}", src.group(1))
                if date_match:
                    age = days_since(date_match.group(0), today)
                    if age >= args.elicit_days:
                        stale_elicit.append((age, line.strip()))
        elif status_char == "?":
            # Decisions: age by src date, since decisions don't have a "since" field.
            # The idea: a decision that's been sitting > N days is blocking other work.
            src = SRC_RE.search(text)
            if src:
                date_match = re.search(r"\d{4}-\d{2}-\d{2}", src.group(1))
                if date_match:
                    age = days_since(date_match.group(0), today)
                    if age >= args.decision_days:
                        stale_decisions.append((age, line.strip()))

    if not stale_waiting and not stale_elicit and not stale_decisions:
        print("No stale items.")
        sys.exit(0)

    sections = []
    if stale_waiting:
        lines_out = [f"Waiting > {args.wait_days} days:"]
        for age, line in sorted(stale_waiting, reverse=True):
            lines_out.append(f"  [{age}d] {line}")
        sections.append("\n".join(lines_out))
    if stale_decisions:
        lines_out = [f"Unresolved decisions > {args.decision_days} days:"]
        for age, line in sorted(stale_decisions, reverse=True):
            lines_out.append(f"  [{age}d] {line}")
        sections.append("\n".join(lines_out))
    if stale_elicit:
        lines_out = [f"Needs-elicitation > {args.elicit_days} days:"]
        for age, line in sorted(stale_elicit, reverse=True):
            lines_out.append(f"  [{age}d] {line}")
        sections.append("\n".join(lines_out))

    print("\n\n".join(sections))
    sys.exit(1)


if __name__ == "__main__":
    main()
