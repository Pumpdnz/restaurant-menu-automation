---
name: continue-ralph
description: "Continue a Ralph Loop by spawning a new Claude session with the RALPH_PROMPT.md. Use at the end of each Ralph Loop iteration when features remain incomplete. Triggers on 'continue ralph', 'next ralph iteration', or when Ralph Loop workflow specifies /continue-ralph."
---

# Continue Ralph Loop

Spawn a new Claude session to continue the Ralph Loop iteration, passing the RALPH_PROMPT.md directly as the initial prompt.

## Arguments

The ralph loop directory path is passed as an argument:

```
/continue-ralph {RALPH_LOOP_DIR}
```

Example:
```
/continue-ralph .claude/data/ralph-loops/dashboard-city-table
```

## When to Use

Run this skill at the end of a Ralph Loop iteration when:
- At least one feature in `feature_list.json` still has `passes: false`
- The current iteration is complete (one feature implemented and verified)
- You've updated `progress.txt` with results

**Do NOT run this if:**
- ALL features have `passes: true` (output the completion promise instead)
- You haven't completed the current feature

## Workflow

### Step 1: Use Provided Ralph Loop Directory

The ralph loop directory is provided as the argument `$ARGUMENTS`. Use this path directly:
```
{RALPH_LOOP_DIR}/RALPH_PROMPT.md
```

If no argument provided, check the current session context for the ralph loop directory path from the RALPH_PROMPT.md that was used to start this session.

### Step 2: Verify Files Exist

Confirm these files exist:
- `RALPH_PROMPT.md` - The prompt to pass to the new session
- `progress.txt` - Should be updated with current iteration results
- `feature_list.json` - Should have at least one `passes: false`

### Step 3: Update Progress for Next Session

Before spawning, ensure `progress.txt` reflects:
- Current iteration number incremented
- Last iteration's results documented
- Any blockers noted

### Step 4: Spawn New Session

Execute the script to open a split terminal and start Claude with RALPH_PROMPT.md:

```bash
bash .claude/skills/continue-ralph/scripts/open-split-ralph.sh "{RALPH_LOOP_PATH}"
```

Where `{RALPH_LOOP_PATH}` is the path to the ralph loop directory (e.g., `.claude/data/ralph-loops/dashboard-city-table`).

## Key Differences from /continue-t

| Aspect | /continue-t | /continue-ralph |
|--------|-------------|-----------------|
| Prompt source | Generates new prime prompt | Uses existing RALPH_PROMPT.md |
| Context | Summarizes session history | Full task definition every time |
| Files created | Creates new .md in prime-prompts/ | No new files created |
| Use case | General session continuation | Ralph Loop iterations only |

## Output

After completion, inform the user:
1. New Claude session starting in split terminal
2. Using RALPH_PROMPT.md from: `{RALPH_LOOP_PATH}`
3. They can switch to the new terminal pane to interact with the new session
