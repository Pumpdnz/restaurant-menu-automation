---
name: fork-session
description: "Use this skill to automatically open a split terminal in Cursor and start a new fork of the current Claude session"
model: haiku
context: fork
---

# Fork Session

IMMEDIATELY execute this bash command to fork the current session:

```bash
bash .claude/skills/fork-session/scripts/open-forked-claude.sh "${CLAUDE_SESSION_ID}"
```

If NUMBER_OF_FORKS is specified in the arguments, repeat the command that many times (waiting for each to complete).

NUMBER_OF_FORKS: $ARGUMENTS

After execution, respond with: "Forked session started in split terminal."
