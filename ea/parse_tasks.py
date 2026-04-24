#!/usr/bin/env python3
"""Parse ea-state/tasks/open.md into structured JSON.

Usage:
    python parse_tasks.py <path-to-open.md>

Output: JSON array on stdout, one object per task.
Exit code 0 on success, 1 on parse failure.

The format this parses is the one documented in SKILL.md:

    - [STATUS] Task text  @owner  due:YYYY-MM-DD  src:slug  ...

STATUS is one of: space (open), ~ (needs-elicitation), > (waiting), x (done).
Tags are whitespace-separated key:value pairs, except @owner which starts with @.
Everything before the first tag is the task text.
"""

import json
import re
import sys
from pathlib import Path

STATUS_MAP = {
    " ": "open",
    "~": "needs_elicitation",
    ">": "waiting",
    "?": "decision",
    "x": "done",
}

# Matches a task line: "- [X] text..."
TASK_RE = re.compile(r"^\s*-\s*\[(.)\]\s*(.+?)\s*$")

# Tag pattern: either @word or key:value (value can contain dashes/digits/letters)
TAG_RE = re.compile(r"(?:^|\s)(@\S+|[a-z_]+:[^\s]+)")


def parse_line(line: str, lineno: int) -> dict | None:
    m = TASK_RE.match(line)
    if not m:
        return None
    status_char, rest = m.group(1), m.group(2)
    status = STATUS_MAP.get(status_char)
    if status is None:
        # Unknown status marker — surface as open with a warning tag
        status = "open"

    # Find all tags and strip them from the text to get the clean task body
    tags = {}
    owner = None
    for match in TAG_RE.finditer(" " + rest):
        token = match.group(1)
        if token.startswith("@"):
            owner = token[1:]
        else:
            key, _, value = token.partition(":")
            tags[key] = value

    # Task text = everything before the first tag
    first_tag_match = TAG_RE.search(" " + rest)
    if first_tag_match:
        # The +1 accounts for the leading space we prepended
        text = rest[: first_tag_match.start() - 1].rstrip()
    else:
        text = rest.strip()

    return {
        "line": lineno,
        "status": status,
        "text": text,
        "owner": owner,
        "tags": tags,
    }


def main():
    if len(sys.argv) != 2:
        print("Usage: parse_tasks.py <path-to-open.md>", file=sys.stderr)
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}", file=sys.stderr)
        sys.exit(1)

    tasks = []
    for i, line in enumerate(path.read_text().splitlines(), start=1):
        parsed = parse_line(line, i)
        if parsed:
            tasks.append(parsed)

    json.dump(tasks, sys.stdout, indent=2)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main()
