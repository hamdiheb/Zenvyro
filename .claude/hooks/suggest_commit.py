#!/usr/bin/env python3
"""Stop hook: when Claude finishes a step and the working tree has new changes,
make Claude write a commit message and hand commit + push to the user.
Fires once per distinct set of changes, so plain Q&A turns are not interrupted."""
import hashlib
import json
import os
import subprocess
import sys

data = json.load(sys.stdin)
if data.get("stop_hook_active"):
    sys.exit(0)  # we already asked once this turn; let Claude stop

project = os.environ.get("CLAUDE_PROJECT_DIR") or data.get("cwd") or os.getcwd()


def git(*args):
    return subprocess.run(["git", "-C", project, *args], capture_output=True, text=True).stdout


try:
    status = git("status", "--porcelain")
except Exception:
    sys.exit(0)
if not status.strip():
    sys.exit(0)

fingerprint = hashlib.sha256((status + git("diff") + git("diff", "--cached")).encode()).hexdigest()
git_dir = git("rev-parse", "--absolute-git-dir").strip()
state_file = os.path.join(git_dir, "claude-last-commit-prompt")
try:
    if open(state_file).read().strip() == fingerprint:
        sys.exit(0)  # these exact changes were already handed to the user
except OSError:
    pass
try:
    with open(state_file, "w") as f:
        f.write(fingerprint)
except OSError:
    pass

branch = git("rev-parse", "--abbrev-ref", "HEAD").strip()
print(
    "There are uncommitted changes. Before finishing, end your reply with a 'Ready to commit' "
    "section that contains:\n"
    "1. A Conventional Commits message (type(scope): summary, plus a short body if useful), "
    "matching the style of `git log`.\n"
    f"2. The exact commands for the user to run manually on branch `{branch}`: "
    "`git add <files>`, `git commit -m ...`, `git push origin " + branch + "`.\n"
    "Do NOT run git commit or git push yourself. If the work is not finished yet, say so "
    "briefly instead of proposing a commit.",
    file=sys.stderr,
)
sys.exit(2)
