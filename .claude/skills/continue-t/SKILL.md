---
name: continue-t
description: "Generate a prime prompt for continuing this project in a new session, save it to a file, and automatically open a split terminal in Cursor with a new Claude session using that prompt."
---

# Continue Session

Generate a prime prompt to continue this project in a new Claude session, then automatically open a split terminal in Cursor and start the new session.

## Arguments

The user provides context about what the next session should focus on. This is passed as the `USER_PROMPT` argument.

Example invocations:
- `/continue-t Session 8 will investigate the pending leads limit issue`
- `/continue-t Focus on implementing the new dashboard feature`

## Workflow

### Step 1: Determine the Documentation Path

- If the current session was focused on implementation, use the same `path-to-project-docs` that was provided at the beginning of this session
- If the current session was focused on investigation/planning, use the path to the parent folder of documentation files created during this session
- Default to `planning/` if no clear path exists

### Step 2: Generate the Prime Prompt

Create a comprehensive prime prompt that includes:

1. **The /prime command** with the appropriate documentation path
2. **Context section** summarizing:
   - What the project/feature is about
   - Previous sessions and what was accomplished
3. **Tasks/Issues section** based on the user's arguments:
   - If specific problems were identified, include file paths to investigate
   - If continuing implementation, list remaining tasks
4. **Key Files Reference** table with relevant files and their purposes
5. **Notes** with any important context for the next session

### Step 3: Generate Filename

Create a descriptive filename based on the session content:
- Format: `session-{N}-{brief-description}.md`
- Example: `session-8-pending-leads-fixes.md`

### Step 4: Write the Prompt File

Write the generated prime prompt to:
```
.claude/data/prime-prompts/{filename}.md
```

Ensure the directory exists first.

### Step 5: Open Split Terminal and Start Claude

After writing the file, execute the script to:
1. Split the current terminal in Cursor
2. Start a new Claude session with the prime prompt

Run:
```bash
bash .claude/skills/continue-t/scripts/open-split-claude.sh "{filename}"
```

Where `{filename}` is the name of the file created in Step 4 (without path).

## Prime Prompt Template

```markdown
/prime {path-to-project-docs}

## Context: {Feature/Project Name} - {Session Description}

{Brief description of the project/feature being worked on}

### Previous Sessions Summary
- Session N: {What was accomplished}
- Session N+1: {What was accomplished}
...

---

## Tasks for Session {N}

### Task 1: {Task Title}
**Problem:** {Description of the problem or task}

**Files to investigate:**
- `path/to/file1.ts` - {Why this file is relevant}
- `path/to/file2.js` - {Why this file is relevant}

**What to check:**
- {Specific thing to look for}
- {Another specific thing}

### Task 2: {Task Title}
...

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `path/to/file.ts` | {Brief description} |
...

---

## Notes
- {Important context}
- {Relevant information for the next session}
```

## Output

After completion, inform the user:
1. The filename and path where the prompt was saved
2. That a new Claude session is starting in the split terminal
3. They can switch to the new terminal pane to interact with the new session
