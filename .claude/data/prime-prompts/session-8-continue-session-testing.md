/prime planning/yolo-mode-plans/account-setup/phase-4

## Context: Continue-Session Skill - Testing & Feature Expansion

We created a `/continue-session` skill that automates the workflow of continuing a Claude Code project in a new session. The skill generates a prime prompt, saves it to a file, and automatically opens a split terminal in Cursor with a new Claude session.

### Previous Sessions Summary
- Session 2-5: Built Reports Tab for Lead Scraping page with analytics, heatmaps, filters
- Session 6: Consolidated Coverage/City Breakdown tabs, added Expand All toggle, clickable status badge, Current Step filter
- Session 7: Created `/continue-session` skill with AppleScript-based terminal splitting in Cursor

### What Was Built in Session 7

**The `/continue-session` skill:**
- Location: `.claude/skills/continue-session/`
- Generates context-aware prime prompts based on session history
- Saves prompts to `.claude/data/prime-prompts/`
- Uses AppleScript to split the terminal in Cursor and start a new Claude session

**Key discovery:** Cursor needed Accessibility permissions (System Settings > Privacy & Security > Accessibility) for the AppleScript to send keystrokes.

**The split terminal command:**
```bash
osascript <<'EOF'
tell application "Cursor"
    activate
end tell
delay 0.3
tell application "System Events"
    tell process "Cursor"
        key code 42 using {command down}  -- Cmd+\ to split terminal
    end tell
end tell
delay 0.5
tell application "System Events"
    keystroke "claude \"$(cat .claude/data/prime-prompts/{filename}.md)\""
    delay 0.1
    key code 36  -- Enter
end tell
EOF
```

---

## Tasks for Session 8

### Task 1: Test Terminal Splitting from IDE Extension
**Goal:** Verify the `/continue-session` skill works correctly when Claude Code is running via the Cursor IDE extension (not just terminal).

**What to test:**
- Does the AppleScript still work when invoked from the IDE extension?
- Does Cursor focus correctly?
- Does the split terminal open in the right place?
- Does the Claude command execute properly?

### Task 2: Brainstorm Feature Expansion Ideas
**Goal:** Think of ways to leverage and improve the continue-session workflow.

**Ideas to explore:**
- Could we support different IDEs (VS Code, Terminal.app, iTerm)?
- Could we add a "session summary" that's auto-generated at the end of each session?
- Could we track session history in a structured way (JSON/database)?
- Could we add a `/resume-session` command to pick from previous sessions?
- Could we integrate with git branches (one branch per session)?
- Could we add session tagging/categorization?

### Task 3: Potential Improvements to Current Implementation
**Consider:**
- Error handling if Accessibility permissions aren't granted
- Detecting which IDE/terminal is being used
- Making the keyboard shortcuts configurable
- Adding a "dry run" mode that just generates the prompt without opening terminal

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/skills/continue-session/SKILL.md` | Skill definition and workflow instructions |
| `.claude/skills/continue-session/scripts/open-split-claude.sh` | AppleScript wrapper for terminal splitting |
| `.claude/data/prime-prompts/` | Directory storing generated prime prompts |

---

## Notes
- The skill was tested successfully in terminal - this session tests IDE extension behavior
- Cursor requires Accessibility permissions for AppleScript keystroke injection
- The `context: fork` frontmatter was removed so the skill has access to full conversation history
- Consider edge cases: What if user is in a different app? What if multiple Cursor windows?
