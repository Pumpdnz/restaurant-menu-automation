/prime .claude/data/ralph-loop-investigations/implementation-investigations/custom-implementation-v2-and-v3/

## Context: Ralph Loop v2.0 - Post-E2E Test Improvements

We've completed our first end-to-end test of the Ralph Loop system. The loop ran 12 iterations and completed, but two significant issues were identified that need to be addressed.

### First E2E Test Summary
- **Task:** Dashboard Update v2 (12 features)
- **Result:** Loop completed all iterations
- **Issues Found:** 2 blocking issues that prevented proper verification

---

## Issues to Address

### Issue 1: Browser Verification Not Performed

**Problem:** None of the 12 sessions used Claude in Chrome MCP tools to verify their work, despite having access to them.

**Evidence:**
- Session 3 stated: "Since I can't actually open a browser, I'll read the updated Dashboard file to make sure everything looks correct"
- When sessions were resumed and questioned, they acknowledged having the tools but not using them
- Example response from resumed session: "I had browser automation tools available (mcp__claude-in-chrome__*) and should have used tabs_context_mcp, navigated to http://localhost:5007, taken screenshots... Instead, I read the code and assumed it worked correctly"

**Root Cause Hypotheses:**
1. **RALPH_PROMPT.md template lacks explicit browser verification instructions**
   - `.claude/skills/plan-ralph-loop/templates/RALPH_PROMPT.md.template` has no testing method examples
   - The "Combined" testing method selection doesn't explicitly require browser verification
   - Compare with `.claude/data/ralph-loops/city-breakdown-dashboard.backup/RALPH_PROMPT.md` which has explicit Claude in Chrome steps

2. **Counter-evidence:** The skill references browser verification docs at `testing-methods/frontend/claude-in-chrome.md`

### Issue 2: Git Commit Path Confusion

**Problem:** Sessions had trouble with git commits due to working directory confusion between:
- `/Users/giannimunro/Desktop/cursor-projects/automation/` (project root)
- `/Users/giannimunro/Desktop/cursor-projects/automation/UberEats-Image-Extractor/` (app subdirectory)

**Evidence:**
```bash
# Session tried to commit from wrong relative path:
git add .claude/data/ralph-loops/dashboard-update-v2/progress.txt
# Error: pathspec did not match any files

# Had to use relative paths:
git add ../.claude/data/ralph-loops/dashboard-update-v2/progress.txt
```

---

## Key Files to Read

### Architecture Documentation
| File | Purpose |
|------|---------|
| `documentation/RALPH_LOOP_UNIFIED_WORKFLOW.md` | Complete workflow overview |
| `documentation/RALPH_LOOP_EXECUTION_PHASE.md` | Execution phase details |

### Files to Improve
| File | Purpose |
|------|---------|
| `.claude/skills/plan-ralph-loop/templates/RALPH_PROMPT.md.template` | Template that generates iteration prompts |
| `.claude/skills/plan-ralph-loop/SKILL.md` | Skill that generates Ralph Loop config |
| `.claude/skills/plan-ralph-loop/testing-methods/frontend/claude-in-chrome.md` | Browser verification reference |

### First E2E Test Files (for context)
| File | Purpose |
|------|---------|
| `.claude/data/ralph-loops/dashboard-update-v2/RALPH_PROMPT.md` | Generated prompt that lacked verification |
| `planning/ralph-loops/dashboard-update-v2/INVESTIGATION_PLAN.md` | Original investigation plan |
| `.claude/data/ralph-loop-investigations/user-written-files/initial-prompts/dashboard-update-v2.md` | Original user request |

### Working Example (for comparison)
| File | Purpose |
|------|---------|
| `.claude/data/ralph-loops/city-breakdown-dashboard.backup/RALPH_PROMPT.md` | Has explicit browser verification steps |

---

## Tasks for This Session

### Task 1: Investigate Issue 1 - Browser Verification

**Instructions:**
1. Read the RALPH_PROMPT.md that was generated for dashboard-update-v2
2. Compare with the city-breakdown-dashboard.backup version that has explicit browser steps
3. Read the `/plan-ralph-loop` skill and its templates
4. Read `testing-methods/frontend/claude-in-chrome.md`
5. Identify exactly why browser verification wasn't included/performed
6. Propose specific changes to ensure browser verification is mandatory for frontend features

### Task 2: Investigate Issue 2 - Git Path Confusion

**Instructions:**
1. Review the RALPH_PROMPT.md template's git commit instructions
2. Identify why sessions got confused about working directory
3. Propose explicit instructions to handle:
   - Commits in the app repository (UberEats-Image-Extractor)
   - Commits in the automation repository (ralph loop state files)

### Task 3: Implement Fixes

**Instructions:**
1. Update `RALPH_PROMPT.md.template` with:
   - Explicit browser verification steps for frontend features
   - Clear working directory instructions for git commits
2. Update `SKILL.md` if the testing method selection needs to be more explicit
3. Consider whether `claude-in-chrome.md` content should be directly embedded in generated prompts

### Task 4: Document Changes

**Instructions:**
1. Update the architecture documentation if needed
2. Document what was changed and why

---

## Success Criteria

- [ ] Browser verification is mandatory and explicit for UI/frontend features
- [ ] Git commit instructions clearly handle multi-repo scenarios
- [ ] Changes are tested (dry-run generate a new RALPH_PROMPT.md)
- [ ] Documentation updated to reflect improvements

---

## Notes

- The Ralph Loop orchestration (scripts, hooks, wrapper) worked correctly
- The issue is in the **prompt generation** phase, not the execution phase
- Focus on making the RALPH_PROMPT.md template more explicit and prescriptive
- Consider making browser verification a hard requirement that can't be skipped
