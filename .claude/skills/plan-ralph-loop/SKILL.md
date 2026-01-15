---
name: plan-ralph-loop
description: "Generate Ralph Loop configuration files from investigation findings. Use when parallel investigations are complete and you need to create autonomous iteration loop setup including RALPH_PROMPT.md, progress.txt, feature_list.json, and init.sh. Triggers on 'ralph loop', 'iteration loop', 'autonomous loop setup', or after /plan-parallel-investigation-ralph completes."
---

# Planning Ralph Loop

Generate all files needed to run an autonomous Ralph Loop iteration system from investigation findings.

## When to Use

Invoke this skill after:
- `/plan-parallel-investigation-ralph` has completed
- Investigation documents (INVESTIGATION_*.md) exist in the project docs folder
- You're ready to set up autonomous iteration for implementing features

## Inputs Required

- **PATH_TO_DOCS**: Directory containing INVESTIGATION_*.md files
- **TASK_NAME**: Short identifier for the task (used in filenames)

## Workflow

### Step 1: Read Investigation Findings

```bash
# Find and read all investigation documents
ls {PATH_TO_DOCS}/INVESTIGATION_*.md
```

Read each file and compile:
- Key technical findings
- Implementation requirements
- Testing needs identified

### Step 2: Confirm Success Criteria

Use `AskUserQuestion()` to confirm:

**Question 1: Acceptance Criteria**
- What specific behaviors must work?
- What UI elements must render correctly?
- What error conditions must be handled?

**Question 2: Browser Verification**
- What pages need visual verification?
- What user flows need testing?
- What elements need interaction testing?

**Question 3: Feature Flags (if applicable)**
- Are there feature flags to test?
- What flag combinations need verification?

### Step 3: Select Testing Method

Use `AskUserQuestion()` to select:

| Method | When to Use |
|--------|-------------|
| Claude in Chrome | Frontend/UI verification, visual checks |
| Playwright scripting | Automated UI testing, regression tests |
| API testing | Backend endpoints, data operations |
| Database verification | Data layer changes, migrations |
| Combined | Full-stack features |

See [testing-methods/frontend/claude-in-chrome.md](testing-methods/frontend/claude-in-chrome.md) for browser verification details.

### Step 4: Generate Ralph Loop Files

Create directory: `.claude/data/ralph-loops/{TASK_NAME}/`

Generate these files using templates:

| File | Template | Purpose |
|------|----------|---------|
| `RALPH_PROMPT.md` | [templates/RALPH_PROMPT.md.template](templates/RALPH_PROMPT.md.template) | Full task definition |
| `progress.txt` | [templates/progress.txt.template](templates/progress.txt.template) | Iteration tracking |
| `feature_list.json` | [templates/feature_list.json.template](templates/feature_list.json.template) | Feature status (Anthropic schema) |
| `init.sh` | [templates/init.sh.template](templates/init.sh.template) | Environment setup |

**Critical**: Populate templates with:
- Investigation findings
- User-confirmed success criteria
- Selected testing method
- Extracted features (all `passes: false` initially)

### Step 5: Report and Offer Start

Report to user:
- Location of generated Ralph Loop files
- Number of features identified
- Testing method configured
- Port assignment

**To start the Ralph Loop:**

The user should start a new Claude session and pass the RALPH_PROMPT.md directly as the initial prompt:

```bash
cat .claude/data/ralph-loops/{TASK_NAME}/RALPH_PROMPT.md | claude
```

Or copy the contents of RALPH_PROMPT.md and paste as the first message to a new Claude session.

**Important:** Do NOT use `/prime` or `/continue-t` for Ralph Loop iterations. The RALPH_PROMPT.md contains all necessary context and instructions for each session.

## Anthropic Pattern Compliance

This skill follows validated patterns from Anthropic's guidance:

| Pattern | Implementation |
|---------|----------------|
| JSON for feature list | `feature_list.json` with strict schema |
| One feature per iteration | Enforced in RALPH_PROMPT.md |
| E2E test before new work | Mandatory session start procedure |
| Clean state on exit | Exit checklist in prompt |
| init.sh script | Environment setup each session |

## Output Files Summary

```
.claude/data/ralph-loops/{TASK_NAME}/
├── RALPH_PROMPT.md       # Full task definition + procedures (USE AS INITIAL PROMPT)
├── progress.txt          # Iteration tracking state
├── feature_list.json     # Features with passes status
└── init.sh               # Environment setup script
```
