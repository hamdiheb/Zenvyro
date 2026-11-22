#!/usr/bin/env python3
"""PreToolUse (Edit/Write/MultiEdit/NotebookEdit):
files under backend/ may only be changed on the `backend` branch,
files under frontend/ only on the `frontend` branch."""
import json
import os
import subprocess
import sys

data = json.load(sys.stdin)
tool_input = data.get("tool_input", {})
path = tool_input.get("file_path") or tool_input.get("notebook_path") or ""
if not path:
    sys.exit(0)

project = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()
rel = os.path.relpath(os.path.realpath(path), os.path.realpath(project))
area = rel.split(os.sep, 1)[0]
if area not in ("backend", "frontend"):
    sys.exit(0)

try:
    branch = subprocess.run(
        ["git", "-C", project, "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True, text=True, check=True,
    ).stdout.strip()
except Exception:
    sys.exit(0)  # not a git repo / git unavailable: don't get in the way

if branch != area:
    print(
        f"WRONG BRANCH: you are trying to change `{rel}` (the {area} folder) "
        f"but the current git branch is `{branch}`.\n"
        f"{area}/ work must happen on the `{area}` branch. Stop and ask the user to switch "
        f"branches themselves, e.g.:\n  git switch {area}\n"
        "(stash or commit pending changes first if needed). Do NOT switch branches yourself.",
        file=sys.stderr,
    )
    sys.exit(2)
sys.exit(0)
