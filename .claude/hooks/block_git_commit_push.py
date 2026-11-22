#!/usr/bin/env python3
"""PreToolUse (Bash): Claude must never commit or push. The user does that by hand."""
import json
import re
import shlex
import sys

BLOCKED = {"commit", "push"}
# git global options that take a value as the next argument
OPTS_WITH_VALUE = {"-C", "-c", "--git-dir", "--work-tree", "--namespace", "--exec-path"}

data = json.load(sys.stdin)
command = data.get("tool_input", {}).get("command", "")


def git_subcommands(cmd):
    # Split on shell separators so `cd x && git commit` is caught too.
    for segment in re.split(r"&&|\|\||;|\||\n|\$\(|`", cmd):
        try:
            tokens = shlex.split(segment)
        except ValueError:
            tokens = segment.split()
        for i, tok in enumerate(tokens):
            if tok.rsplit("/", 1)[-1] != "git":
                continue
            j = i + 1
            while j < len(tokens) and tokens[j].startswith("-"):
                j += 2 if tokens[j] in OPTS_WITH_VALUE else 1
            if j < len(tokens):
                yield tokens[j]


hit = next((s for s in git_subcommands(command) if s in BLOCKED), None)
if hit:
    print(
        f"BLOCKED: Claude is not allowed to run `git {hit}` in this project. "
        "Never commit or push. Instead, give the user a ready-to-use commit message "
        "and the exact commands to run themselves (git add / git commit / git push).",
        file=sys.stderr,
    )
    sys.exit(2)
sys.exit(0)
