---
description: Create a Ralph Loop optimized plan for investigating a specific feature with parallel subagents
argument-hint: [path-to-project-docs]
---

# Plan Parallel Investigation (Ralph Loop)

Follow the `Workflow` to create a Ralph Loop optimized investigation plan within the `PATH_TO_PROJECT_DOCS` folder, then generate a prime prompt and spawn the investigation session.

## Variables

PATH_TO_PROJECT_DOCS: $ARGUMENTS
USER_PROMPT: $ARGUMENTS

## Workflow

### Phase 1: Initial Assessment

- If no `PATH_TO_PROJECT_DOCS` is provided, STOP immediately and ask the user to provide it.
- If no `USER_PROMPT` is provided, STOP immediately and ask the user to provide it.
- IMPORTANT: If the `USER_PROMPT` includes any specific instructions, follow these instructions before writing the plan
- Consider the purpose of the investigation that the `USER_PROMPT` specifies and consider any known information provided.
- Ultrathink about what additional information about the current codebase would be required to gather before having the necessary context to be able to write an implementation plan.
- Consider the available tools in your system prompt which would be able to be used to investigate each piece of missing information.
- If the `USER_PROMPT` does not contain sufficient information about what has already been implemented, complete an initial investigation of the current codebase or STOP and ask questions before continuing.

### Phase 2: Refine Requirements with User

Use `AskUserQuestion()` to gather Ralph Loop specific requirements:

**Question Set 1: Testing & Validation**
```
- "What testing approach is required?"
  Options:
  - Browser verification (Claude in Chrome) - For frontend/UI changes
  - Playwright scripting - For automated UI testing
  - API testing - For backend endpoints
  - Database verification - For data layer changes
  - Combined approach - Multiple testing methods
```

**Question Set 2: Success Criteria**
```
- "What are the key acceptance criteria?"
  Options:
  - Build must pass (TypeScript, lint)
  - Specific UI elements must render correctly
  - Specific behaviors must work end-to-end
  - No console errors
  - All of the above
```

**Question Set 3: Feature Flags (if applicable)**
```
- "Are there feature flags involved?"
  Options:
  - Yes, need to test with flags enabled/disabled
  - No feature flags
  - Unknown, needs investigation
```

**Question Set 4: Browser Verification (if frontend)**
```
- "What browser verification is needed?"
  Options:
  - Visual confirmation of UI changes
  - Interactive testing of user flows
  - Both visual and interactive
  - Not applicable (backend only)
```

### Phase 3: Create Investigation Plan

Once you have a clear understanding of the current situation and desired end result, create an investigation plan document within the `PATH_TO_PROJECT_DOCS` folder, following the `plan_structure_template` guide below. If no folder currently exists at this path, create it first.

Use your own initiative to include as many relevant `subagent_n_instructions` sections as necessary.

When writing the investigation plan, consider all aspects of the current system which need to be investigated further and break these up into distinct tasks for subagents to be able to complete in parallel.

IMPORTANT: The next session of Claude will read the document you create and actually execute the investigation, so make sure you include context on the purpose of the current investigation and clear instructions to spin up multiple subagents in parallel to complete each investigation task.

<plan_structure_template>
# Investigation Plan Overview
Details of the purpose of the current investigation

## Known Information
Any known information about the current system, provided from one or more of the following sources:
- In the `USER_PROMPT`
- From your optional initial investigation of the current codebase
- From user provided answers to your optional clarification questions

## Testing & Validation Requirements
Document the testing approach confirmed with the user:
- **Testing Method:** {Browser verification / Playwright / API / Database / Combined}
- **Browser Verification Steps:** {If applicable}
- **Feature Flag Testing:** {If applicable}

## Success Criteria
Specific, verifiable acceptance criteria:
- [ ] Build passes (no TypeScript/lint errors)
- [ ] {Specific UI element renders correctly}
- [ ] {Specific behavior works end-to-end}
- [ ] {No console errors}
- [ ] {Additional criteria from user}

## Feature Categories
Categorize investigation areas for feature_list.json generation:

### Functional Features
- Feature that affects core functionality
- User-facing behavior changes

### UI Features
- Visual/layout changes
- Component modifications

### Integration Features
- API integrations
- Data flow changes
- Cross-system interactions

## Instructions
Detailed instructions for the next instance of Claude Code to follow.
- Include specific instructions to use the Task tool to spin up n number of subagents to investigate each `subagent_n_instructions` section in parallel.
- **CRITICAL: Always use `subagent_type="general-purpose"` for investigation subagents.** Do NOT use "Explore" or "Plan" subagent types as they lack Write tool access and cannot create their investigation document deliverables.
- Include specific instructions to prompt each subagent to only investigate, not change code, and to create an investigation document in the `PATH_TO_PROJECT_DOCS` folder as its deliverable.
- Include instructions to read all files once the subagents have completed their work and then report the findings to the user
- IMPORTANT: After investigation completes, run `/plan-ralph-loop` to generate Ralph Loop configuration from findings

## subagent_1_instructions
- Context
- Instructions
- Deliverable (INVESTIGATION_TASK_1.md)
- Report

## subagent_2_instructions
- Context
- Instructions
- Deliverable (INVESTIGATION_TASK_2.md)
- Report

## subagent_3_instructions
- Context
- Instructions
- Deliverable (INVESTIGATION_TASK_3.md)
- Report

...etc
</plan_structure_template>

### Phase 4: Generate Prime Prompt

After creating the investigation plan, generate a prime prompt for the next session:

**Prime Prompt Template:**
```markdown
/prime {PATH_TO_PROJECT_DOCS}

## Context: {Feature Name} - Investigation Phase

{Brief description of what is being investigated}

### Previous Sessions Summary
- Planning session: Created investigation plan with {N} parallel investigation tasks

---

## Tasks for This Session

### Task 1: Execute Parallel Investigation
**Instructions:**
1. Read the investigation plan at `{PATH_TO_PROJECT_DOCS}/INVESTIGATION_PLAN.md`
2. Spin up {N} general-purpose subagents in parallel using the Task tool
3. Each subagent investigates ONE area and creates a deliverable document
4. Wait for all subagents to complete
5. Read all investigation documents and compile findings

### Task 2: Report and Continue
**Instructions:**
1. Summarize key findings from all investigation documents
2. Identify any blockers or additional questions
3. Run `/plan-ralph-loop` to generate Ralph Loop configuration from findings

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `{PATH_TO_PROJECT_DOCS}/INVESTIGATION_PLAN.md` | Main investigation plan |
| `{PATH_TO_PROJECT_DOCS}/INVESTIGATION_*.md` | Subagent deliverables (created during investigation) |

---

## Notes
- Testing Method: {Selected testing method}
- Success Criteria documented in investigation plan
- After investigation, proceed to Ralph Loop setup via `/plan-ralph-loop`
```

### Phase 5: Save Prime Prompt and Spawn Session

1. Generate a descriptive filename: `session-{feature-name}-investigation.md`
2. Ensure directory exists: `.claude/data/prime-prompts/`
3. Write the prime prompt from Phase 4 to `.claude/data/prime-prompts/{filename}`
4. Execute the split terminal script directly (skip to Step 5 of `/continue-t` since prime prompt is already generated):

```bash
bash .claude/skills/continue-t/scripts/open-split-claude.sh "{filename}"
```

Where `{filename}` is the name of the file created (without path, e.g., `session-dashboard-update-investigation.md`).

## Report

- Provide a concise report to user:
- Summarize your understanding of the overview of the current project and purpose of the investigation.
- Report the testing and validation requirements confirmed with the user.
- Report the purpose of each subagent investigation task.
- Confirm the prime prompt has been saved and `/continue-t` is spawning the investigation session.
