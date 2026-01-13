/prime .claude/skills/continue-session

## Context: Continue-Session Skill - Debugging Terminal Launch Workflow

We created a `/continue-session` skill that generates prime prompts for continuing projects in new Claude sessions. The skill works for generating and saving prompts, but the automated terminal launch is unreliable.

### Previous Session Summary
- Session 7: Created the `/continue-session` skill with:
  - SKILL.md defining the workflow
  - `scripts/open-split-claude.sh` for launching new Claude sessions
  - Successfully tested generating prime prompts and saving to `.claude/data/prime-prompts/`
  - Tested multiple approaches for opening terminals:
    - AppleScript with `Cmd+\` to split terminal - worked from CLI but not from IDE extension
    - AppleScript with command palette (`Cmd+Shift+P` + "Terminal: Create New Terminal") - fragile, fails if user interacts with Cursor during execution
    - Terminal.app `do script` - reliable but opens external terminal instead of Cursor's integrated terminal

---

## Task for Session 8: Explore Alternative Approaches

### Problem
The current AppleScript keystroke approach is fragile - it depends on window focus and fails if the user clicks or types during execution. We need a more robust solution.

### Alternatives to Explore

#### Option 1: Print Session ID for Manual Continue
Instead of trying to automate the terminal, run Claude with `-p` (print mode) to get a response, capture the session ID, and provide a copy-pasteable command.

**Concept:**
```bash
# Start Claude in print mode, capture session ID
claude -p "$(cat prompt.md)" --output-format json | jq -r '.session_id'
# Then user runs: claude --resume {session_id}
```

**Files to investigate:**
- Check `claude --help` for session ID output options
- Test if `-p` mode returns session ID in JSON output
- Consider if this defeats the purpose (user still needs to manually run command)

#### Option 2: Using the Claude Agent SDK
Build a more sophisticated solution using the Agent SDK that could:
- Spawn a new Claude process programmatically
- Handle the session handoff more reliably

**Files to investigate:**
- Claude Agent SDK documentation
- Check if SDK allows spawning interactive sessions

#### Option 3: Hybrid Approach
- Generate prompt and save to file (current working approach)
- Copy a simple command to clipboard: `claude "$(cat .claude/data/prime-prompts/latest.md)"`
- User just opens new terminal and pastes

**Consider:**
- Create a symlink `latest.md` pointing to most recent prompt
- Makes the paste command consistent every time

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/skills/continue-session/SKILL.md` | Skill definition and workflow |
| `.claude/skills/continue-session/scripts/open-split-claude.sh` | Terminal launch script (needs fixing) |
| `.claude/data/prime-prompts/` | Directory where prime prompts are saved |

---

## Notes
- The prompt generation and file saving works perfectly - only the terminal launch needs fixing
- AppleScript `do script` with Terminal.app is reliable but opens external window
- Cursor/VS Code doesn't have a reliable programmatic API for running commands in integrated terminal
- The solution should work from both CLI and IDE extension contexts
- Consider what provides the best UX vs. what's technically feasible
