# Ralph Loop Phase 1 - Current Issues

## Overview

Phase 1 testing revealed several issues that need resolution before the Ralph Loop system is production-ready. This document tracks each issue, proposed solutions, and investigation requirements.

---

## Issue 1: Permission Prompts Blocking Automation

### Problem
Each Ralph session must ask for permission on every single command, including simple operations:
- `Edit(UberEats-Image-Extractor/src/pages/Dashboard.jsx)`
- `Edit file .claude/data/ralph-loops/city-breakdown-dashboard/feature_list.json`
- `Edit file .claude/data/ralph-loops/city-breakdown-dashboard/progress.txt`

This breaks the autonomous nature of the loop and requires constant human intervention.

### Proposed Solutions

**Option A: --dangerously-skip-permissions flag**
- Add flag when `/continue-ralph` spawns new sessions
- Requires implementing PreToolUse hooks for safety guardrails
- Documentation: https://code.claude.com/docs/en/hooks

**Option B: Better permissions configuration**
- Configure tool-specific permission rules in Claude config
- Target specific tools: Bash, Read, Edit, WebFetch, MCP, Task
- Documentation: https://code.claude.com/docs/en/iam

### Investigation Required
- Review hooks documentation for PreToolUse safety patterns
- Review IAM documentation for permission configuration options
- Determine which approach provides better balance of automation vs safety
- Identify minimum permissions needed for Ralph Loop operations

---

## Issue 2: Session Spawn Reliability

### Problem
The `/continue-ralph` script has intermittent failures:

**90% success rate** - Sessions spawn correctly

**~8% partial failure** - Terminal opens but command waits for manual Enter key press

**~2% silent failure** - Script fails completely (often due to user activity during execution), no retry attempted

### Current Implementation
```bash
claude "$(cat .claude/data/ralph-loops/city-breakdown-dashboard/RALPH_PROMPT.md)"
```

Uses AppleScript to split Cursor terminal and execute command.

### Proposed Solutions

**Quick Fix: Improve AppleScript method**
- Add delays/retries to existing script
- Better error detection and reporting
- Fallback mechanisms

**Medium Effort: Alternative terminal interaction**
- Use iTerm2 or native Terminal.app instead of Cursor terminal
- Direct terminal API interaction
- Background process management

**High Effort: Deterministic orchestration**
- mprocs - Terminal multiplexer for parallel processes
- Claude Agents SDK - Programmatic session management
- External bash loop - Original Ralph implementation pattern
- Open source orchestrators (ralph-orchestrator, etc.)

### Investigation Required
- Analyze current AppleScript for failure points
- Test alternative terminal spawning methods
- Evaluate mprocs for multi-session coordination
- Review Claude Agents SDK capabilities
- Compare reliability vs complexity tradeoffs

---

## Issue 3: Model Speed for Browser Testing

### Problem
All sessions use Claude Opus (smartest but slowest model). Browser testing with Claude in Chrome doesn't require Opus-level reasoning and could be faster with Sonnet or Haiku.

### Current Behavior
- Every iteration spawns with default Opus model
- Browser verification steps are slow
- No ability to select model per task type

### Proposed Solution

**Add model selection to Ralph Loop workflow:**

1. **Update feature_list.json schema** - Add `model` field to each feature
   ```json
   {
     "id": 1,
     "category": "ui",
     "model": "sonnet",  // NEW: sonnet, haiku, or opus
     "description": "...",
     "passes": false
   }
   ```

2. **Update /continue-ralph skill** - Pre-select next task before spawning, use appropriate model flag
   - CLI Reference: https://code.claude.com/docs/en/cli-reference

3. **Build specialized browser testing subagent** - Optimized for Claude in Chrome operations

### Investigation Required
- Review CLI model selection options
- Determine which task types benefit from which models
- Design model selection logic in /continue-ralph
- Evaluate specialized subagent approach vs inline model switching

---

## Priority Order

| Priority | Issue | Impact | Effort |
|----------|-------|--------|--------|
| 1 | Permission Prompts | High - Blocks automation | Medium |
| 2 | Session Spawn Reliability | High - Causes failures | Medium-High |
| 3 | Model Speed | Medium - Slows iterations | Low-Medium |

---

## Next Steps

Use `/plan-parallel-investigation` to create investigation tasks for each issue. Each issue should have dedicated subagent investigation to:
1. Research documentation and options
2. Prototype solutions
3. Document findings and recommendations
