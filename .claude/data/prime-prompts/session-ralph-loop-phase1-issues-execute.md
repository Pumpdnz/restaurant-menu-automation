/prime .claude/data/ralph-loop-investigations/phase-1-issues/

## Context: Ralph Loop Phase 1 Issues - Execute Investigation

Executing parallel investigation for three critical issues blocking Ralph Loop production readiness:
1. **Permission Prompts** - Tool calls require manual approval, breaking automation
2. **Session Spawn Reliability** - AppleScript spawning has ~10% failure rate
3. **Model Speed** - All tasks use Opus when faster models would suffice

### Previous Sessions Summary
- Built Ralph Loop system with /plan-parallel-investigation-ralph, /plan-ralph-loop, and /continue-ralph
- Phase 1 testing with city breakdown dashboard revealed 3 blocking issues
- Planning session: Created investigation plan with 3 parallel investigation tasks

---

## Tasks for This Session

### Task 1: Execute Parallel Investigation

**Instructions:**
1. Read the investigation plan at `.claude/data/ralph-loop-investigations/phase-1-issues/INVESTIGATION_PLAN.md`
2. Spin up **3 general-purpose subagents in parallel** using the Task tool
3. Each subagent investigates ONE area and creates a deliverable document:
   - Subagent 1: Permissions (hooks, IAM) → `INVESTIGATION_PERMISSIONS.md`
   - Subagent 2: Session Spawn (AppleScript, alternatives) → `INVESTIGATION_SESSION_SPAWN.md`
   - Subagent 3: Model Routing (CLI options, task mapping) → `INVESTIGATION_MODEL_ROUTING.md`
4. Wait for all subagents to complete
5. Read all investigation documents and compile findings

**CRITICAL**: Use `subagent_type="general-purpose"` for all subagents.

### Task 2: Report Findings

**Instructions:**
1. Summarize key findings from all 3 investigation documents
2. Identify recommended solutions for each issue
3. Report to user with:
   - Priority order for implementation
   - Estimated effort for each solution
   - Any additional questions or blockers

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/data/ralph-loop-investigations/phase-1-issues/INVESTIGATION_PLAN.md` | Main investigation plan with subagent instructions |
| `.claude/data/ralph-loop-investigations/phase-1-issues/PHASE_1_CURRENT_ISSUES.md` | Original issue descriptions |
| `.claude/skills/continue-ralph/scripts/open-split-ralph.sh` | Current AppleScript implementation (Issue 2) |
| `.claude/skills/continue-ralph/SKILL.md` | Continue-ralph skill definition |

---

## Documentation URLs for Subagents

| Topic | URL |
|-------|-----|
| Hooks (PreToolUse) | https://code.claude.com/docs/en/hooks |
| IAM/Permissions | https://code.claude.com/docs/en/iam |
| CLI Reference | https://code.claude.com/docs/en/cli-reference |

---

## Notes
- Execute the investigation plan immediately upon reading
- Spawn all 3 subagents in a SINGLE Task tool call (parallel execution)
- Do not modify any code - investigation only
- Each subagent creates its own INVESTIGATION_*.md deliverable
