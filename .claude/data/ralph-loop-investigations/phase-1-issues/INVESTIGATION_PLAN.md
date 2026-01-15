# Investigation Plan: Ralph Loop Phase 1 Issues

## Overview

Investigate and document solutions for three critical issues blocking Ralph Loop production readiness:
1. **Permission Prompts** - Every tool call requires manual approval, breaking automation
2. **Session Spawn Reliability** - AppleScript-based spawning has ~10% failure rate
3. **Model Speed** - All tasks use Opus when faster models would suffice

## Known Information

### Issue 1: Permission Prompts Blocking Automation
- Every command (Edit, Bash, Read) requires permission
- Breaks autonomous iteration loop
- Two proposed solutions:
  - `--dangerously-skip-permissions` flag with PreToolUse hooks
  - IAM permission configuration
- Documentation: https://code.claude.com/docs/en/hooks, https://code.claude.com/docs/en/iam

### Issue 2: Session Spawn Reliability
- Current implementation: AppleScript in `open-split-ralph.sh`
- ~90% success, ~8% requires manual Enter, ~2% silent failure
- Alternatives to evaluate: mprocs, Claude Agents SDK, iTerm2, external bash loop
- Key file: `.claude/skills/continue-ralph/scripts/open-split-ralph.sh`

### Issue 3: Model Speed for Browser Testing
- All sessions default to Opus model
- Browser verification doesn't require Opus reasoning
- Need model selection per feature type
- Documentation: https://code.claude.com/docs/en/cli-reference

## Instructions

Execute this investigation by spinning up **3 general-purpose subagents in parallel** using the Task tool. Each subagent should:
1. Research their assigned area thoroughly
2. Create a deliverable document in this folder
3. NOT modify any code - investigation only
4. Return findings summary

**CRITICAL**: Use `subagent_type="general-purpose"` for all subagents. Do NOT use "Explore" or "Plan" types as they cannot write files.

After all subagents complete, read all `INVESTIGATION_*.md` files and compile a summary report for the user.

---

## subagent_1_instructions

### Context: Permission Prompts Investigation

The Ralph Loop requires autonomous operation but Claude Code prompts for permission on every tool call. We need to find a way to pre-authorize certain operations while maintaining safety.

### Instructions

1. **Research Hooks Documentation**
   - WebFetch https://code.claude.com/docs/en/hooks
   - Document PreToolUse hook capabilities
   - Identify how to auto-approve specific tools
   - Find safety patterns for dangerous operations

2. **Research IAM/Permissions Documentation**
   - WebFetch https://code.claude.com/docs/en/iam
   - Document permission configuration options
   - Identify tool-specific permission rules
   - Find project-level vs global permission settings

3. **Analyze Requirements**
   - List tools Ralph Loop needs: Bash, Read, Edit, Write, WebFetch, Task, MCP tools
   - Determine minimum permissions needed
   - Identify which operations should remain guarded

4. **Evaluate Solutions**
   - Compare `--dangerously-skip-permissions` + hooks vs IAM configuration
   - Document tradeoffs (safety vs automation)
   - Recommend approach with implementation steps

### Deliverable

Create `INVESTIGATION_PERMISSIONS.md` in `.claude/data/ralph-loop-investigations/phase-1-issues/` with:
- Summary of hooks capabilities
- Summary of IAM options
- Recommended solution with rationale
- Step-by-step implementation guide

### Report

Return a summary of findings and recommended approach.

---

## subagent_2_instructions

### Context: Session Spawn Reliability Investigation

The `/continue-ralph` skill uses AppleScript to spawn new Claude sessions in Cursor terminal splits. This has ~90% success rate with failures due to timing issues and user activity interference.

### Instructions

1. **Analyze Current Implementation**
   - Read `.claude/skills/continue-ralph/scripts/open-split-ralph.sh`
   - Identify failure points in AppleScript approach
   - Document timing-related issues

2. **Research Alternative Approaches**
   - **mprocs**: Terminal multiplexer for parallel processes
     - WebSearch for mprocs documentation and examples
     - Evaluate for multi-session coordination
   - **Claude Agents SDK**: Programmatic session management
     - WebSearch for Claude Agents SDK documentation
     - Evaluate for session spawning capabilities
   - **iTerm2/Terminal.app**: Alternative terminal APIs
     - Research iTerm2 AppleScript capabilities
     - Compare reliability to Cursor terminal
   - **External bash loop**: Original Ralph pattern
     - Document simple bash loop approach

3. **Evaluate Solutions**
   - Compare reliability vs complexity for each approach
   - Consider user experience (visibility, control)
   - Consider integration with existing skills

### Deliverable

Create `INVESTIGATION_SESSION_SPAWN.md` in `.claude/data/ralph-loop-investigations/phase-1-issues/` with:
- Analysis of current AppleScript failures
- Evaluation of each alternative approach
- Recommended solution with implementation plan
- Migration path from current approach

### Report

Return a summary of findings and recommended approach with reliability estimate.

---

## subagent_3_instructions

### Context: Model Speed Investigation

All Ralph Loop sessions use Claude Opus by default. Browser testing tasks don't require Opus-level reasoning and could use faster models (Sonnet/Haiku) to speed up iterations.

### Instructions

1. **Research CLI Model Selection**
   - WebFetch https://code.claude.com/docs/en/cli-reference
   - Document available model flags
   - Identify how to specify model when spawning sessions

2. **Analyze Task Types**
   - Review Ralph Loop workflow for task categories:
     - Implementation tasks (complex reasoning)
     - Browser verification (visual checks)
     - File updates (progress.txt, feature_list.json)
   - Map task types to appropriate model levels

3. **Design Model Routing**
   - Schema update for `feature_list.json`:
     ```json
     { "model": "sonnet" | "opus" | "haiku" }
     ```
   - Logic for `/continue-ralph` to read model from next feature
   - Fallback behavior when model not specified

4. **Evaluate Specialized Subagents**
   - Consider browser-testing-specific subagent vs inline model switching
   - Document tradeoffs (complexity vs flexibility)

### Deliverable

Create `INVESTIGATION_MODEL_ROUTING.md` in `.claude/data/ralph-loop-investigations/phase-1-issues/` with:
- CLI model selection options
- Task-to-model mapping recommendations
- Schema changes for feature_list.json
- Implementation plan for /continue-ralph updates

### Report

Return a summary of model selection options and recommended routing approach.

---

## Success Criteria

Investigation is complete when:
1. All three INVESTIGATION_*.md documents exist
2. Each document contains actionable recommendations
3. Implementation paths are clear for each solution
4. Tradeoffs are documented for decision-making
