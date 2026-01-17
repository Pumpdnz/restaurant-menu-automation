/prime .claude/data/ralph-loop-investigations/phase-1-issues/

## Context: Ralph Loop v2.0 - Implementation Session

Implementing the unified CLI-based orchestrator for Ralph Loop to fix three Phase 1 blocking issues:
1. **Permission Prompts** - Tool calls require manual approval, breaking automation
2. **Session Spawn Reliability** - AppleScript spawning has ~10% failure rate
3. **Model Speed** - All tasks use Opus when faster models would suffice

### Previous Sessions Summary
- **Investigation Session**: Created parallel investigation plan for 3 issues
- **Debate Session**: 3 branches debated approaches (CLI vs SDK vs Stop Hook)
  - Branch-2 conceded: SDK cannot access Claude in Chrome (Native Messaging incompatibility)
  - Branch-1 and Branch-3 reached consensus on CLI-based approach
- **Planning Session**: Created `UNIFIED_IMPLEMENTATION_PLAN.md` with complete code skeletons

### Key Debate Outcomes
- **CLI wins**: `claude` CLI is proven path for OAuth + Claude in Chrome
- **SDK rejected**: Cannot access Claude in Chrome (uses Native Messaging, not HTTP)
- **Layered security**: `--dangerously-skip-permissions` + PreToolUse hooks for Bash commands
- **Simplified scope**: No Stop hooks, no session ID tracking, process check for browser

---

## Tasks for This Session

### Task 1: Implement Core Infrastructure

**Instructions:**
1. Read `UNIFIED_IMPLEMENTATION_PLAN.md` thoroughly (especially Section 4: Code Skeletons)
2. Create the directory structure:
   ```
   .claude/scripts/ralph-loop/
   ```
3. Implement in order:
   - `validate-environment.sh` (~50 lines)
   - `browser-health-check.sh` (~25 lines)
   - `notify.sh` (~15 lines)
   - `ralph-orchestrator.sh` (~150 lines)
   - `ralph-loop-wrapper.sh` (~30 lines)

4. Test each component individually before moving to next

### Task 2: Implement Security Layer

**Instructions:**
1. Create `.claude/hooks/ralph-pre-tool.js` (~60 lines)
2. **IMPORTANT**: Only validate Bash commands (per user clarification)
   - Remove or comment out file access validation code
   - Keep ALLOWED_COMMANDS and BLOCKED_PATTERNS
3. Create/update `.claude/settings.local.json` with:
   - Permission allow/deny rules
   - PreToolUse hook configuration (Bash matcher only)

### Task 3: Update Existing Skills

**Instructions:**
1. Update `/continue-ralph` skill to use new orchestrator
2. Update `/plan-ralph-loop` skill templates if needed
3. Note: RALPH_PROMPT.md.template has been updated to include `/get-session-id` step

### Task 4: Testing

**Instructions:**
1. Run unit tests from Section 6 of the plan
2. Run integration test with mock feature
3. Run E2E test with `city-breakdown-dashboard` if time permits

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/data/ralph-loop-investigations/phase-1-issues/UNIFIED_IMPLEMENTATION_PLAN.md` | **PRIMARY REFERENCE** - Complete code skeletons and architecture |
| `.claude/data/ralph-loop-investigations/phase-1-issues/further-investigations/orchestrator-debate/debate-log.md` | Full debate context (3000+ lines) |
| `.claude/skills/continue-ralph/SKILL.md` | Existing skill to update |
| `.claude/skills/continue-ralph/scripts/open-split-ralph.sh` | Old AppleScript approach (to be replaced) |

---

## Architecture Summary (6 Layers)

```
LAYER 0: Pre-Loop Validation     → validate-environment.sh
LAYER 1: Terminal Management     → ralph-loop-wrapper.sh (tmux)
LAYER 2: Orchestration           → ralph-orchestrator.sh (CLI + retry)
LAYER 3: Security                → ralph-pre-tool.js + settings.local.json
LAYER 4: Observability           → notify.sh + per-iteration logs
LAYER 5: Exit Conditions         → Handled in ralph-orchestrator.sh
```

---

## Simplifications (Per User Clarification)

These items were discussed but **excluded** from implementation scope:
- Stop hooks for cleanup/logging (skip for now)
- Session ID tracking (skip - use iteration/attempt logs instead)
- MCP ping test in browser health check (process check sufficient)
- File access validation in PreToolUse hook (rely on deny rules instead)

---

## Notes
- Estimated effort: 13-15 hours total
- Start with Phase 1 (Core Infrastructure) - 4-5 hours
- Code skeletons in the plan are complete - can be copied and adapted
- Test incrementally rather than all at once
- The `/get-session-id` skill already exists and is integrated into RALPH_PROMPT.md.template
