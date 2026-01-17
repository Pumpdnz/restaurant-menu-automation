# Ralph Loop System Implementation Roadmap

## Project Goal

Create a highly effective and reliable Ralph Loop system that:
1. Eliminates context rot through fresh sessions per iteration
2. Supports browser-based frontend verification via Claude for Chrome
3. Enables parallel execution across multiple git worktrees
4. Uses file-based progress tracking (not conversation memory)

---

## Anthropic Validated Patterns (Nov 2025)

> Source: [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)

Anthropic's official guidance validates our architecture and provides key implementation patterns:

### Two-Agent Architecture ✅
| Anthropic Pattern | Our Pattern | Status |
|-------------------|-------------|--------|
| Initializer Agent | Layer 1: Planning + `/plan-ralph-loop` | Validated |
| Coding Agent | Layer 3: Worker Sessions | Validated |

### Critical Implementation Rules

1. **Use JSON for Feature List (not Markdown)**
   - Claude is less likely to inappropriately modify JSON files
   - Use strongly-worded instructions: "It is unacceptable to remove or edit tests"

2. **Feature List Schema (Anthropic Standard)**
   ```json
   {
       "category": "functional",
       "description": "New chat button creates a fresh conversation",
       "steps": [
         "Navigate to main interface",
         "Click the 'New Chat' button",
         "Verify a new conversation is created",
         "Check that chat area shows welcome state",
         "Verify conversation appears in sidebar"
       ],
       "passes": false
   }
   ```

3. **One Feature Per Iteration**
   > "This incremental approach turned out to be critical to addressing the agent's tendency to do too much at once."

4. **Clean State on Exit**
   - Code appropriate for merging to main branch
   - No major bugs
   - Orderly and well-documented
   - Developer could immediately start new feature

5. **Basic E2E Test BEFORE New Work**
   > "This ensured that Claude could quickly identify if the app had been left in a broken state"

6. **init.sh Script**
   - Environment setup for each session
   - Start development server
   - Run basic verification

### Session Start Procedure (Anthropic Standard)
```
1. pwd - confirm working directory
2. Read progress.txt and feature_list.json
3. git log --oneline -20
4. Run init.sh to start server
5. Run basic E2E test BEFORE any new work
6. Choose highest-priority failing feature
7. Begin implementation (ONE feature only)
```

---

## Key Design Decisions (Resolved)

| Decision | Resolution |
|----------|------------|
| Port Strategy | Separate FRONTEND_PORT (5007) and BACKEND_PORT (3007) |
| Browser Tab Management | Each worktree creates its own Chrome tab group |
| Iteration Trigger | Autonomous via `/continue-ralph` (uses RALPH_PROMPT.md directly) |
| Failure Handling | Continue until max iterations reached |
| Context Rot Mitigation | Fresh session per iteration (files are memory) |
| Server Management | init.sh only VERIFIES server running (does NOT start it) |
| Session Initialization | Pass RALPH_PROMPT.md directly (NOT via /prime command) |

---

## Remaining Questions Requiring Investigation

### Q1: Original Ralph Bash Loop Compatibility ✅ INVESTIGATED

**Question:** Can Geoffrey Huntley's original implementation be adapted to use the `/continue-t` pattern?

**Original Ralph Pattern (Confirmed):**
```bash
while :; do
  cat PROMPT.md | claude-code
done
```

- External bash loop FORCES iteration (Claude cannot stop it)
- Each iteration is a FRESH session (NO `--continue` flag used)
- Termination via promise detection (`<promise>COMPLETE</promise>`) or `--max-iterations`
- Files (PROMPT.md, progress.txt) are the ONLY memory between iterations

**Our /continue-t Pattern:**
```
Session reads progress.txt → makes changes → verifies → updates progress.txt → runs /continue-t → exits
New session (FRESH) reads progress.txt → continues...
```

- Session triggers next session autonomously via `/continue-t`
- Each iteration is a FRESH session (same as original)
- Termination via promise detection
- Files (progress.txt, feature_list.json) are the ONLY memory

**Key Finding:** Both approaches use FRESH sessions with file-based memory. The difference is:
- **Original Ralph:** External bash loop guarantees iteration (deterministic)
- **Our /continue-t:** Claude must choose to trigger next iteration (autonomous but less deterministic)

**Decision:** Proceed with `/continue-t` for v2 implementation because:
1. Aligns with Anthropic patterns
2. More autonomous and self-contained
3. Lower setup complexity
4. Can fall back to bash loop if /continue-t proves unreliable

**Future Exploration:**
- Original bash loop method (if /continue-t unreliable)
- Ralph Orchestrator framework: https://github.com/mikeyobrien/ralph-orchestrator

**Full Investigation:** See `single-instance-v2/resources/INVESTIGATION_BASH_LOOP_COMPATIBILITY.md`

### Q2: mprocs for Parallelization Control

**Question:** How can `mprocs` improve parallel worktree execution?

**Investigation Needed:**
- What is mprocs and how does it manage multiple processes?
- Can it coordinate multiple Claude sessions across worktrees?
- Does it provide better visibility than manual terminal management?

---

## Phase 1: Single Instance Ralph Loop

### Goal
Implement a working Ralph Loop using `/continue-t` for iteration handoff, with browser verification support.

---

### Step 1.1: Create `/plan-parallel-investigation-ralph` Command

**Source:** Adapt existing `/plan-parallel-investigation` command

**Changes Required:**

```markdown
# Additions to workflow:

## Current Workflow:
1. Initial investigation based on USER_PROMPT
2. Create investigation plan document
3. Report to user with copy-paste prompt

## New Workflow:
1. Initial investigation based on USER_PROMPT
2. **NEW: Use AskUserQuestion() to refine understanding of:**
   - Testing and validation requirements
   - Success criteria and acceptance tests
   - Browser verification needs
   - Feature flag considerations
3. Create investigation plan document (enhanced for Ralph Loop)
4. **NEW: Write prime prompt for next session**
5. Report to user
6. **NEW: Execute /continue-t to spawn investigation session**
```

**Enhanced Plan Template:**
```markdown
# Investigation Plan Overview

## Known Information
...

## Testing & Validation Requirements  <!-- NEW SECTION -->
- Unit test expectations
- Integration test requirements
- Browser verification steps
- Feature flag test matrix

## Success Criteria  <!-- NEW SECTION -->
- Build must pass
- Specific UI elements must render
- Specific behaviors must work
- No console errors

## Instructions
...

## subagent_n_instructions
...
```

**File Location:** `.claude/commands/plan-parallel-investigation-ralph.md`

**Deliverable:** Working command that produces Ralph-optimized investigation plans

---

### Step 1.2: Create `/plan-ralph-loop` Skill

**Purpose:** After investigations complete, orchestrate Ralph Loop setup

**Skill Structure:**
```
.claude/skills/plan-ralph-loop/
├── SKILL.md
├── templates/
│   ├── progress.txt.template
│   ├── RALPH_PROMPT.md.template
│   ├── feature_list.json.template    <!-- UPDATED: JSON per Anthropic -->
│   └── init.sh.template              <!-- NEW: Environment setup -->
├── testing-methods/
│   ├── frontend/
│   │   ├── claude_in_chrome.md
│   │   └── playwright_scripting.md
│   └── backend/
│       ├── api_testing.md
│       └── database_verification.md
└── scripts/
    └── ralph-loop.sh  <!-- Investigation needed: bash loop vs /continue-t -->
```

**SKILL.md Content:**
```markdown
---
name: plan-ralph-loop
description: "Create Ralph Loop configuration from investigation findings"
---

# Plan Ralph Loop

## Inputs Required
- Investigation documents from /plan-parallel-investigation-ralph
- User-confirmed success criteria
- Testing method selection

## Workflow

### Step 1: Read Investigation Findings
- Read all INVESTIGATION_*.md files in the project docs folder
- Compile key findings into context

### Step 2: Confirm Success Criteria
Use AskUserQuestion() to confirm:
- Acceptance criteria checklist
- Browser verification steps
- Feature flag test requirements

### Step 3: Select Testing Methods
Use AskUserQuestion() to select:
- Frontend: Claude in Chrome vs Playwright scripting
- Backend: API testing vs Database verification
- Both: Combined approach

### Step 4: Generate Ralph Loop Files
Create in ralph-loops/{TASK_NAME}/:
- RALPH_PROMPT.md (from template + investigation)
- progress.txt (initialized)
- feature_list.json (Anthropic schema, all passes: false)
- init.sh (environment setup script)
- test-config.md (selected testing methods)

### Step 5: Generate Prime Prompt
Create prime prompt for first Ralph iteration:
- Includes full PRD
- Includes initial progress state
- Includes testing configuration
- Includes browser port

### Step 6: Report and Offer Start
- Show user the generated Ralph Loop configuration
- Offer to start the loop via /continue-t
```

**progress.txt Template:**
```markdown
# Ralph Loop Progress: {TASK_NAME}

## Configuration
- Created: {TIMESTAMP}
- Max Iterations: {MAX_ITERATIONS}
- Port: {PORT}
- Testing Method: {TESTING_METHOD}

## Current State
- Iteration: 0
- Status: not_started
- Last Updated: {TIMESTAMP}

## Completion Criteria
{CRITERIA_FROM_TEMPLATE}

## Completed
(none yet)

## Remaining
{ALL_CRITERIA}

## Current Blocker
(none)

## Last Verification Result
(not run)

## Next Session Instructions
Begin implementation. Read RALPH_PROMPT.md for full context.

## Iteration History
| # | Changes Made | Result | Blocker |
|---|--------------|--------|---------|
```

**feature_list.json Template (Anthropic Standard):**
```json
{
  "task_name": "{TASK_NAME}",
  "created": "{TIMESTAMP}",
  "total_features": 0,
  "completed_features": 0,
  "instructions": "CRITICAL: Only modify the 'passes' field. It is unacceptable to remove or edit feature definitions as this could lead to missing or buggy functionality.",
  "features": [
    {
      "id": 1,
      "category": "functional",
      "priority": "high",
      "description": "Feature description here",
      "steps": [
        "Step 1: Navigate to relevant page",
        "Step 2: Perform action",
        "Step 3: Verify expected result"
      ],
      "passes": false,
      "completed_iteration": null,
      "notes": ""
    }
  ]
}
```

**init.sh Template:**
```bash
#!/bin/bash
# init.sh - Environment setup for Ralph Loop: {TASK_NAME}
# Generated: {TIMESTAMP}
#
# This script checks if the dev server is already running before starting.
# This prevents port conflicts across Ralph Loop iterations.

set -e

PORT={PORT}
PROJECT_PATH={PROJECT_PATH}

echo "=== Ralph Loop Environment Setup ==="
echo "Port: $PORT"

# Navigate to project directory
cd "$PROJECT_PATH"

# Check if server already running (prevents port conflicts across iterations)
if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
    echo "✅ Server already running on port $PORT"
else
    echo "Server not running. Starting development server..."
    npm run dev &
    DEV_PID=$!

    # Wait for server to be ready
    echo "Waiting for server to start..."
    sleep 5

    # Verify server started successfully
    if curl -s "http://localhost:$PORT" > /dev/null 2>&1; then
        echo "✅ Server started on port $PORT (PID: $DEV_PID)"
    else
        echo "❌ Failed to start server on port $PORT"
        exit 1
    fi
fi

echo "=== Environment Ready ==="
echo "URL: http://localhost:$PORT"
```

**RALPH_PROMPT.md Template:**
```markdown
# Ralph Loop: {TASK_NAME}

## Task Definition
{FROM_INVESTIGATION}

## Technical Context
{FROM_INVESTIGATION}

## Implementation Steps
{GENERATED_FROM_INVESTIGATION}

## Testing & Verification

### Method: {SELECTED_METHOD}

{INCLUDE_RELEVANT_TESTING_METHOD_FILE}

### Verification Steps
{FROM_SUCCESS_CRITERIA}

---

## Session Start Procedure (MANDATORY)

Every iteration MUST begin with these steps:

1. `pwd` - Confirm working directory
2. Read `progress.txt` - Understand current state
3. Read `feature_list.json` - See all features and their status
4. `git log --oneline -10` - Review recent work
5. Run `./init.sh` - Start development server
6. **CRITICAL: Run basic E2E test BEFORE any new work**
   - If baseline test fails, FIX IT FIRST
   - Do NOT proceed to new features with broken baseline
7. Choose highest-priority feature where `passes: false`
8. Begin implementation

---

## CRITICAL: One Feature Per Iteration

Work on EXACTLY ONE feature per iteration. Do not:
- ❌ Attempt to implement multiple features
- ❌ Make "while I'm here" additional changes
- ❌ Premature optimization
- ❌ Refactoring beyond the current feature

After completing ONE feature:
1. ✅ Verify it works (browser test)
2. ✅ Update feature_list.json: set `passes: true`
3. ✅ Commit with descriptive message
4. ✅ Update progress.txt
5. ✅ Exit iteration

---

## Clean State on Exit (MANDATORY)

Before ending this iteration, ensure:
- [ ] No half-implemented code remains
- [ ] All changes are committed with descriptive messages
- [ ] No major bugs introduced
- [ ] Code is orderly and documented
- [ ] Next session can immediately start on next feature

---

## Iteration Workflow

1. Follow Session Start Procedure above
2. Implement ONE feature
3. Run verification (build + browser test)
4. Update feature_list.json: change `passes: false` → `passes: true`
5. Update progress.txt with results
6. Git commit with descriptive message
7. If ALL features pass: output `<promise>{TASK_NAME} COMPLETE</promise>`
8. If NOT complete: run `/continue-t` to spawn next iteration

## Completion Signal
When ALL features in feature_list.json have `passes: true`, output:
<promise>{TASK_NAME} COMPLETE</promise>

## Constraints
- Do NOT skip verification steps
- Do NOT mark features as passing without browser verification
- Do NOT modify feature definitions in feature_list.json (only `passes` field)
- Do NOT exceed {MAX_ITERATIONS} iterations
- If stuck on same issue for 3+ iterations, document blocker clearly
```

**Deliverable:** Working skill that generates complete Ralph Loop configuration

---

### Step 1.3: Test Single Instance Ralph Loop

**Test Task:** Dashboard Update (already planned)

**Test Procedure:**
1. Run `/plan-ralph-loop` on Dashboard investigation findings
2. Review generated configuration
3. Start Ralph Loop via `/continue-t`
4. Monitor iterations
5. Document issues encountered

**Success Criteria:**
- Loop iterates autonomously
- Progress.txt updates correctly each iteration
- Browser verification executes
- Loop terminates when promise criteria met
- OR Loop terminates at max iterations with clear blocker documentation

**Deliverable:** Working Dashboard with documented iteration log

---

### Step 1.4: Iterate on Single Instance

**Based on Step 1.3 findings, refine:**
- Progress.txt format (is it sufficient for session handoff?)
- Prime prompt template (does next session have enough context?)
- Testing method documentation (are instructions clear enough?)
- Iteration trigger (is /continue-t reliable?)

**Deliverable:** Refined templates and updated SKILL.md

---

## Phase 2: Parallel Infrastructure

### Goal
Enable running multiple Ralph Loops simultaneously across git worktrees.

---

### Step 2.1: Create `/init-parallel-ralph` Command

**Source:** Adapt existing `/init-parallel` command

**Additions:**
```markdown
## Variables
TASK_NAME: $ARGUMENTS
NUMBER_OF_PARALLEL_WORKTREES: $ARGUMENTS
RALPH_LOOP_PATH: Path to Ralph Loop configuration created by /plan-ralph-loop

## Execute these commands

### Setup Phase (same as /init-parallel)
- Create trees/ directory
- For each worktree:
  - git worktree add
  - Copy .env files
  - Update ports in .env and vite.config.ts
  - npm install

### Ralph Loop Setup (NEW)
- For each worktree:
  - Copy {RALPH_LOOP_PATH}/* to trees/{TASK_NAME}-{i}/ralph-loop/
  - Update progress.txt with worktree-specific port
  - Update RALPH_PROMPT.md with worktree-specific port
  - Update feature_list.json (copy as-is, all passes: false)
  - Generate worktree-specific init.sh with correct PORT variable
  - Make init.sh executable: `chmod +x init.sh`
  - Create worktree-specific prime prompt in .claude/data/prime-prompts/

### Port Allocation (expanded)
| Worktree | Backend | Frontend | Chrome Tab Group |
|----------|---------|----------|------------------|
| Main     | 3007    | 5007     | main-ralph       |
| 1        | 3008    | 5008     | ralph-1          |
| 2        | 3009    | 5009     | ralph-2          |
| 3        | 3010    | 5010     | ralph-3          |
```

**Deliverable:** Command that creates Ralph-ready parallel worktrees

---

### Step 2.2: Create `/continue-t-ralph` Variant

**Source:** Adapt `/continue-t` skill

**Changes:**
```markdown
## Additional Context for Ralph Sessions

The prime prompt must include:

1. **Progress State**
   - Read ralph-loop/progress.txt
   - Read ralph-loop/feature_list.json
   - Include current iteration number
   - Include completed/remaining feature count
   - Include last blocker if any

2. **Port Awareness**
   - Include worktree-specific port in prompt
   - Browser verification must use correct port
   - init.sh configured for worktree port

3. **Anthropic Session Procedures**
   - Mandatory session start procedure
   - One feature per iteration enforcement
   - Clean state on exit requirements
   - Basic E2E test before new work

4. **Iteration Instructions**
   - Update feature_list.json passes field
   - Update progress.txt with results
   - Git commit with descriptive message
   - Output promise OR run /continue-t-ralph
```

**Prime Prompt Template (Ralph-specific):**
```markdown
/prime ralph-loop/

## Context: Ralph Loop Iteration {N}

This is iteration {N} of the Ralph Loop for {TASK_NAME}.
Worktree: {WORKTREE_NAME}

### Current State (from progress.txt)
- Completed: {COMPLETED_COUNT}/{TOTAL_COUNT} features
- Remaining: {REMAINING_LIST}
- Last Blocker: {BLOCKER_OR_NONE}

### Port Configuration
- Dev Server: localhost:{PORT}
- Browser verification target: http://localhost:{PORT}

---

## Session Start Procedure (MANDATORY)

1. `pwd` - Confirm working directory
2. Read `ralph-loop/progress.txt` - Current state
3. Read `ralph-loop/feature_list.json` - All features and status
4. `git log --oneline -10` - Recent work
5. Run `./ralph-loop/init.sh` - Ensure server running on port {PORT}
6. **CRITICAL: Run basic E2E test BEFORE any new work**
7. Choose highest-priority feature where `passes: false`

---

## CRITICAL: One Feature Per Iteration

Work on EXACTLY ONE feature. After completing:
1. ✅ Verify with browser test
2. ✅ Update feature_list.json: set `passes: true`
3. ✅ Git commit with descriptive message
4. ✅ Update progress.txt
5. ✅ Run /continue-t-ralph OR output promise

---

## Completion Check

If ALL features in feature_list.json have `passes: true`:

<promise>{TASK_NAME} COMPLETE</promise>

If NOT complete, run `/continue-t-ralph` to spawn next iteration.

---

## Key Files
| File | Purpose |
|------|---------|
| ralph-loop/RALPH_PROMPT.md | Full task definition |
| ralph-loop/progress.txt | Current state tracking |
| ralph-loop/feature_list.json | Features with passes status (Anthropic schema) |
| ralph-loop/init.sh | Environment setup (port {PORT}) |
```

**Deliverable:** Ralph-specific continuation skill

---

### Step 2.3: Test with 2 Worktrees

**Test Procedure:**
1. Create simple task (not Dashboard - something smaller)
2. Run `/plan-ralph-loop` to create configuration
3. Run `/init-parallel-ralph` with 2 worktrees
4. Start both Ralph Loops
5. Monitor parallel progress
6. Document any conflicts or issues

**Success Criteria:**
- Both worktrees iterate independently
- No port conflicts
- No Chrome tab group conflicts
- Both complete (or reach max iterations)
- Can compare results

**Deliverable:** Validated parallel infrastructure

---

### Step 2.4: Investigate mprocs Integration

**Investigation Tasks:**
1. Install and understand mprocs
2. Determine if it can manage multiple Claude sessions
3. Create mprocs configuration for Ralph parallel execution
4. Test coordination benefits

**Potential mprocs.yaml:**
```yaml
procs:
  ralph-1:
    shell: "cd trees/task-1 && claude '$(cat .claude/data/prime-prompts/ralph-iter-1.md)'"
  ralph-2:
    shell: "cd trees/task-2 && claude '$(cat .claude/data/prime-prompts/ralph-iter-1.md)'"
  ralph-3:
    shell: "cd trees/task-3 && claude '$(cat .claude/data/prime-prompts/ralph-iter-1.md)'"
```

**Deliverable:** mprocs integration assessment and configuration

---

## Phase 3: Full Multi-Layer System

### Goal
Add orchestration layer for progress monitoring and result aggregation.

---

### Step 3.1: Progress Monitoring

**Create `/ralph-status` command:**
```markdown
# Ralph Status

Read progress.txt from all active Ralph worktrees and aggregate status.

## Output
| Worktree | Iteration | Status | Completed | Remaining | Blocker |
|----------|-----------|--------|-----------|-----------|---------|
| task-1   | 5         | active | 3/7       | 4/7       | None    |
| task-2   | 3         | blocked| 2/7       | 5/7       | Import error |
| task-3   | 7         | complete| 7/7      | 0/7       | None    |
```

**Deliverable:** Aggregated progress visibility

---

### Step 3.2: Completion Aggregation

**Create `/ralph-compare` command:**
```markdown
# Ralph Compare

When multiple worktrees complete, compare results.

## Comparison Metrics
- Iterations to completion
- Code quality (lint score, type errors)
- Test coverage
- Implementation approach differences

## Output
| Worktree | Iterations | Lint Issues | Approach |
|----------|------------|-------------|----------|
| task-1   | 7          | 2           | Composed components |
| task-2   | 9          | 0           | Single component |
| task-3   | 5          | 1           | Hook-based |

## Recommendation
task-3 completed fastest with minimal issues. Recommend merging.
```

**Deliverable:** Automated result comparison

---

### Step 3.3: Merge Assistance

**Create `/ralph-merge` command:**
```markdown
# Ralph Merge

Merge selected worktree result back to main branch.

## Workflow
1. User specifies winning worktree
2. Show diff from main to worktree
3. Offer cherry-pick or full merge
4. Execute merge
5. Cleanup worktrees
```

**Deliverable:** Streamlined merge workflow

---

## File Structure Summary

```
.claude/
├── commands/
│   ├── plan-parallel-investigation-ralph.md  <!-- Phase 1.1 -->
│   ├── init-parallel-ralph.md                <!-- Phase 2.1 -->
│   ├── ralph-status.md                       <!-- Phase 3.1 -->
│   ├── ralph-compare.md                      <!-- Phase 3.2 -->
│   └── ralph-merge.md                        <!-- Phase 3.3 -->
├── skills/
│   ├── plan-ralph-loop/                      <!-- Phase 1.2 -->
│   │   ├── SKILL.md
│   │   ├── templates/
│   │   │   ├── progress.txt.template
│   │   │   ├── RALPH_PROMPT.md.template
│   │   │   ├── feature_list.json.template   <!-- Anthropic schema -->
│   │   │   └── init.sh.template             <!-- Environment setup -->
│   │   ├── testing-methods/
│   │   │   ├── frontend/
│   │   │   │   ├── claude_in_chrome.md
│   │   │   │   └── playwright_scripting.md
│   │   │   └── backend/
│   │   │       ├── api_testing.md
│   │   │       └── database_verification.md
│   │   └── scripts/
│   └── continue-t-ralph/                     <!-- Phase 2.2 -->
│       ├── SKILL.md
│       └── scripts/
└── data/
    └── ralph-loops/
        └── {task-name}/
            ├── RALPH_PROMPT.md              <!-- Full task definition -->
            ├── progress.txt                 <!-- Iteration tracking -->
            ├── feature_list.json            <!-- Anthropic schema features -->
            ├── init.sh                      <!-- Environment setup -->
            └── test-config.md               <!-- Testing method config -->
```

---

## Success Metrics

### Phase 1 Complete When:
- [x] `/plan-parallel-investigation-ralph` produces Ralph-optimized plans ✅ DONE
- [x] `/plan-ralph-loop` generates complete loop configuration including: ✅ DONE
  - [x] RALPH_PROMPT.md with session procedures
  - [x] feature_list.json (Anthropic schema)
  - [x] init.sh with server verification logic
  - [x] progress.txt initialized
- [ ] Single instance Ralph Loop completes Dashboard task (IN PROGRESS - city-breakdown-dashboard)
- [x] Iteration handoff via `/continue-ralph` works reliably ✅ TESTED
- [x] Session start procedure followed each iteration ✅ VALIDATED
- [ ] One feature per iteration pattern validated (IN PROGRESS)

### Phase 2 Complete When:
- [ ] `/init-parallel-ralph` creates working parallel worktrees
- [ ] Each worktree has correctly configured init.sh with unique port
- [ ] Each worktree has feature_list.json (all passes: false initially)
- [ ] `/continue-ralph` handles port-aware iteration (renamed from /continue-t-ralph)
- [ ] `/continue-ralph` includes session start procedure in prime prompt
- [ ] 2+ worktrees can run Ralph Loops simultaneously
- [ ] No port conflicts between parallel instances
- [ ] No Chrome tab group conflicts

### Phase 3 Complete When:
- [ ] `/ralph-status` aggregates progress across worktrees
- [ ] `/ralph-compare` enables result comparison
- [ ] `/ralph-merge` streamlines winning solution merge
- [ ] Full system documented and repeatable

---

## Implementation Progress (Updated 2026-01-15)

### Completed Items

#### Step 1.1: `/plan-parallel-investigation-ralph` Command ✅
- **File:** `.claude/commands/plan-parallel-investigation-ralph.md`
- **Features:**
  - 5-phase workflow (Initial Assessment → AskUserQuestion → Create Plan → Generate Prime Prompt → Spawn Session)
  - Testing & Validation Requirements section
  - Success Criteria section
  - Feature Categories (functional, UI, integration)
  - Auto-spawns investigation session via continue-t script
  - Critical instruction: Always use `subagent_type="general-purpose"`

#### Step 1.2: `/plan-ralph-loop` Skill ✅
- **Directory:** `.claude/skills/plan-ralph-loop/`
- **Files Created:**
  - `SKILL.md` - Main skill instructions
  - `templates/progress.txt.template`
  - `templates/RALPH_PROMPT.md.template` - With full path references
  - `templates/feature_list.json.template` - Anthropic schema
  - `templates/init.sh.template` - Server verification only
  - `testing-methods/frontend/claude-in-chrome.md`

#### NEW: `/continue-ralph` Skill ✅
- **Directory:** `.claude/skills/continue-ralph/`
- **Purpose:** Replace /continue-t for Ralph Loop iterations
- **Key Difference:** Uses RALPH_PROMPT.md directly instead of generating prime prompts
- **Files:**
  - `SKILL.md` - Accepts ralph loop directory as argument
  - `scripts/open-split-ralph.sh` - Spawns new session with RALPH_PROMPT.md

#### Updated: `/plan-parallel-investigation` Command ✅
- **File:** `.claude/commands/plan-parallel-investigation.md`
- **Now includes:** Same 5-phase workflow as ralph version
- **AskUserQuestion integration** for scope clarification

### Key Design Changes Made

| Original Plan | Actual Implementation | Reason |
|---------------|----------------------|--------|
| Use `/continue-t` for iterations | Created `/continue-ralph` | /continue-t generates prime prompts; ralph needs to use RALPH_PROMPT.md directly |
| init.sh starts server | init.sh only verifies server | Prevents port conflicts; server should run before loop starts |
| Single `{PORT}` variable | Separate `{FRONTEND_PORT}` and `{BACKEND_PORT}` | This project uses port 5007 (frontend) and 3007 (backend) |
| Prime prompt for each iteration | RALPH_PROMPT.md used directly | Simpler handoff; all context in one file |

### Port Configuration (This Project)
| Service | Port |
|---------|------|
| Backend API | 3007 |
| Frontend Client | 5007 |

### Active Test: city-breakdown-dashboard
- **Ralph Loop Directory:** `.claude/data/ralph-loops/city-breakdown-dashboard/`
- **Task:** Add CityBreakdownTab component from Lead Scraping Reports to Dashboard
- **Status:** Testing iteration workflow
- **Features:** 9 features in feature_list.json

---

## Next Actions

1. ~~**Investigate Q1:** Verify `/continue-t` pattern vs original bash loop~~ ✅ RESOLVED - Created /continue-ralph
2. **IN PROGRESS:** Complete city-breakdown-dashboard test task
3. **PENDING:** Validate one-feature-per-iteration pattern
4. **PENDING:** Document iteration log from test
5. **Phase 2:** Create `/init-parallel-ralph` for parallel worktrees

---

## References

### Anthropic Official Guidance
- **Blog Post:** [Effective harnesses for long-running agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents) (Nov 2025)
- **Code Examples:** [Claude Quickstarts - Autonomous Coding](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)
- **Prompting Guide:** [Claude 4 Best Practices - Multi-context window workflows](https://docs.claude.com/en/docs/build-with-claude/prompt-engineering/claude-4-best-practices#multi-context-window-workflows)

### Project Documents
- **Recommendations:** `.claude/data/ralph-loop-investigations/custom-implementation-v2-and-v3/single-instance-v2/resources/RECOMMENDATIONS_ANTHROPIC_PATTERNS.md`
- **Full Blog Post:** `.claude/data/ralph-loop-investigations/custom-implementation-v2-and-v3/single-instance-v2/resources/ANTHROPIC_BLOG_POST_LONG_RUNNING_AGENTS_GUIDE.md`

### Original Ralph Loop
- **Geoffrey Huntley's Ralph:** https://ghuntley.com/ralph/
- **Ralph Orchestrator:** https://github.com/mikeyobrien/ralph-orchestrator
