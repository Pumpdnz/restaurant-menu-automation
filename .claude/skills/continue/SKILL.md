---
name: continue
description: "Generate a prime prompt for continuing this project in a new session, prime a new Claude session with it, and copy the resume command to clipboard for easy continuation."
---

# Continue Session

Generate a prime prompt to continue this project in a new Claude session. The skill primes a new session with the context and copies a resume command to clipboard - just open a new terminal and paste to continue.

## Arguments

The user provides context about what the next session should focus on. This is passed as the `USER_PROMPT` argument.

Example invocations:
- `/continue Session 8 will investigate the pending leads limit issue`
- `/continue Focus on implementing the new dashboard feature`

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

### Step 5: Prime Session and Copy Resume Command

After writing the file, execute the script to:
1. Run Claude in print mode with the prime prompt to initialize a new session
2. Capture the session ID from the JSON response
3. Copy the resume command (`claude --resume {session_id}`) to clipboard

Run:
```bash
bash .claude/skills/continue/scripts/prime-session.sh "{filename}"
```

Where `{filename}` is the name of the file created in Step 4 (without path).

The script will output the session ID and confirm the resume command has been copied to clipboard.

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
2. The session ID of the primed session
3. That the resume command has been copied to clipboard
4. To open a new terminal and paste (Cmd+V) to continue the session
