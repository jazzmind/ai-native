#!/usr/bin/env python3
"""Atomically move [x] tasks from open.md to done.md, stamping each with done:DATE.

Usage:
    python move_to_done.py <ea-state-dir> [--dry-run]

Reads <dir>/tasks/open.md, finds all lines starting with "- [x]",
appends them to <dir>/tasks/done.md with a done:YYYY-MM-DD tag if one
isn't already present, and rewrites open.md without them.

Writes are atomic via temp-file + rename, so a crash mid-write won't
corrupt either file.
"""

import datetime as dt
import os
import re
import sys
from pathlib import Path

DONE_RE = re.compile(r"^\s*-\s*\[x\]", re.IGNORECASE)
HAS_DONE_TAG_RE = re.compile(r"\bdone:\d{4}-\d{2}-\d{2}\b")


def atomic_write(path: Path, content: str) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(content)
    os.replace(tmp, path)


def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    args = [a for a in args if a != "--dry-run"]
    if len(args) != 1:
        print("Usage: move_to_done.py <ea-state-dir> [--dry-run]", file=sys.stderr)
        sys.exit(1)

    root = Path(args[0])
    open_path = root / "tasks" / "open.md"
    done_path = root / "tasks" / "done.md"

    if not open_path.exists():
        print(f"No open.md found at {open_path}", file=sys.stderr)
        sys.exit(1)

    today = dt.date.today().isoformat()
    kept: list[str] = []
    moved: list[str] = []

    for line in open_path.read_text().splitlines():
        if DONE_RE.match(line):
            if not HAS_DONE_TAG_RE.search(line):
                line = line.rstrip() + f"  done:{today}"
            moved.append(line)
        else:
            kept.append(line)

    if not moved:
        print("No completed tasks to move.")
        return

    print(f"Moving {len(moved)} completed task(s):")
    for line in moved:
        print(f"  {line.strip()}")

    if dry_run:
        print("\n(dry run — nothing written)")
        return

    # Append to done.md (create if needed)
    done_existing = done_path.read_text() if done_path.exists() else ""
    if done_existing and not done_existing.endswith("\n"):
        done_existing += "\n"
    done_new = done_existing + "\n".join(moved) + "\n"

    done_path.parent.mkdir(parents=True, exist_ok=True)
    atomic_write(done_path, done_new)
    atomic_write(open_path, "\n".join(kept) + ("\n" if kept else ""))

    print(f"\nMoved to {done_path}")


if __name__ == "__main__":
    main()
