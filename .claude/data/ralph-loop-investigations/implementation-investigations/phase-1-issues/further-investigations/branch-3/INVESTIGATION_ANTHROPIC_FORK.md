# Investigation: Forking Anthropic Autonomous Coding Quickstart for Ralph Loop

**Date:** 2026-01-16
**Branch:** 3 (Fork Assessment)
**Status:** Complete

---

## Executive Summary

The Anthropic `autonomous-coding` quickstart shares significant architectural overlap with Ralph Loop, using the same two-agent pattern (Initializer + Coding Agent), feature_list.json tracking, and multi-session orchestration. However, **critical blockers** exist that make forking impractical:

1. **OAuth Token Restriction (CRITICAL):** The Claude Agent SDK does not support Max Plan OAuth tokens - only API keys. As of January 2026, Anthropic has blocked OAuth tokens from working outside Claude Code itself.

2. **No Claude in Chrome Support:** The repo uses no browser automation at all. Our requirement for real-time Chrome visibility is not addressable without major rewrites.

3. **Tightly Coupled Architecture:** The SDK client, session spawning, and progress display are interwoven - extracting components requires understanding the full system.

**Recommendation:** Do NOT fork. Build a lightweight custom orchestrator that shells out to `claude` CLI with our existing skills.

---

## 1. Repo Architecture Analysis

### File Structure

```
autonomous-coding/
├── autonomous_agent_demo.py  # Main entry point - args parsing + loop control
├── agent.py                  # Session execution logic
├── client.py                 # Claude SDK client configuration
├── security.py               # Bash command allowlist validation
├── progress.py               # Progress tracking/display utilities
├── prompts.py                # Prompt loading utilities
├── prompts/
│   ├── app_spec.txt          # Application specification (user editable)
│   ├── initializer_prompt.md # First session - creates 200 features
│   └── coding_prompt.md      # Continuation sessions
└── requirements.txt          # Dependencies: claude-code-sdk>=0.1.58
```

### Execution Flow

```
1. autonomous_agent_demo.py parses args (--project-dir, --max-iterations, --model)
2. Creates/resumes session via agent.py
3. agent.py uses client.py to configure Claude SDK with:
   - Security hooks (bash allowlist)
   - Sandbox settings
   - Model selection
4. Session 1 (Initializer): Reads app_spec.txt, generates feature_list.json with 200 tests
5. Sessions 2+: Reads progress, picks next failing feature, implements, marks passing
6. Loop continues until all features pass OR max iterations reached
7. Progress displayed continuously via progress.py
```

### Key Design Patterns

| Pattern | Implementation | Ralph Loop Equivalent |
|---------|----------------|----------------------|
| Two-Agent Architecture | initializer_prompt.md + coding_prompt.md | /plan-ralph-loop (Layer 1) + /continue-ralph (Layer 3) |
| Feature Tracking | feature_list.json (200 items) | feature_list.json (Anthropic schema - already adopted) |
| Progress Persistence | feature_list.json + git commits | progress.txt + feature_list.json + git |
| Session Isolation | Fresh SDK sessions per iteration | Fresh Claude CLI sessions per iteration |
| Safety Guardrails | security.py bash allowlist hooks | Not yet implemented (Issue 1) |
| Model Selection | --model CLI arg | Not yet implemented (Issue 3) |

---

## 2. Reusable Components List

### Potentially Reusable (with modifications)

| Component | File | What It Does | Reuse Effort |
|-----------|------|--------------|--------------|
| Bash Allowlist | security.py | Validates bash commands against whitelist | **Medium** - Pattern useful, implementation Python-specific |
| Progress Display | progress.py | Terminal progress tracking across sessions | **Low** - Heavy SDK coupling, would need complete rewrite |
| Session Loop Control | autonomous_agent_demo.py | Max iterations, delay between sessions | **Medium** - Logic portable, implementation SDK-specific |

### Not Reusable

| Component | File | Why Not Reusable |
|-----------|------|------------------|
| Client Config | client.py | Hardcoded to use ANTHROPIC_API_KEY |
| Prompts | prompts/*.md | Uses 200-feature pattern, no browser testing |
| SDK Integration | All files | Depends on claude-code-sdk Python package |

### Reusable Concepts (not code)

These patterns from the repo align with our architecture and validate our approach:

1. **Session Start Procedure** - pwd, read progress, git log, run init, E2E test, pick feature
2. **One Feature Per Iteration** - Critical constraint we've already adopted
3. **Clean State on Exit** - Code ready for merge, no half-implemented features
4. **init.sh Pattern** - Environment setup script (we have this)
5. **JSON Feature Schema** - `{category, description, steps, passes}` (we use this)
6. **Strong Wording for Feature Protection** - "It is unacceptable to remove or edit tests"

---

## 3. Required Modifications Assessment

### Modification A: OAuth Token Support (BLOCKED)

**Current Implementation:**
```python
# client.py (inferred from docs)
export ANTHROPIC_API_KEY='your-api-key-here'
```

**Required for Ralph Loop:**
```python
# Would need to support
export CLAUDE_CODE_OAUTH_TOKEN='oauth-token-here'
```

**Status: BLOCKED**

Per January 2026 reports ([GitHub Issue #9887](https://github.com/anthropics/claude-code/issues/9887), [byteiota article](https://byteiota.com/anthropic-blocks-claude-max-in-opencode-devs-cancel-200-month-plans/)):

- Anthropic has locked OAuth tokens to specific whitelisted clients
- Claude Max subscriptions no longer work in third-party tools via SDK
- The restriction is server-side client identity validation, not header/token issues
- Community workarounds (claude-max-access-sdk) exist but are unsupported

**Official SDK Guidance:**
> "For basic authentication, retrieve a Claude API key from the Claude Console and set the ANTHROPIC_API_KEY environment variable."

No OAuth option documented in the SDK.

### Modification B: Claude in Chrome Integration

**Current Implementation:**
- No browser automation
- Verification via unit tests only
- `npm run dev` starts server, no browser interaction

**Required for Ralph Loop:**
- Real-time Chrome browser visibility
- Claude in Chrome extension for browser testing
- Tab group management per worktree
- Screenshot/interaction logging

**Effort Assessment: HIGH**

Would require:
1. Adding MCP server connection to Claude in Chrome
2. Implementing browser verification steps in prompts
3. Managing Chrome tab groups per session
4. Completely new browser testing infrastructure

The repo has no browser hooks - this is a ground-up addition.

### Modification C: Planning Pattern Integration

**Current Implementation:**
- Initializer creates 200 features from app_spec.txt
- Static feature generation at start
- No human-in-the-loop planning

**Required for Ralph Loop:**
- Human-in-the-loop planning via /plan-ralph-loop
- Dynamic feature list based on investigation findings
- AskUserQuestion() for scope clarification
- Testing method selection (Claude in Chrome vs Playwright)

**Effort Assessment: MEDIUM**

Would require:
1. Replacing initializer_prompt.md with our planning skill output
2. Adding investigation phase before loop starts
3. Integrating with existing /plan-parallel-investigation-ralph

### Modification D: Per-Feature Model Selection

**Current Implementation:**
```python
# CLI arg for entire session
--model claude-sonnet-4-5-20250929
```

**Required for Ralph Loop:**
```json
// Per-feature model selection
{
  "id": 1,
  "model": "sonnet",  // Feature-specific
  "passes": false
}
```

**Effort Assessment: MEDIUM**

Would require:
1. Extending feature_list.json schema (minor)
2. Modifying session spawning to read next feature's model (medium)
3. SDK supports model param, so technically feasible

---

## 4. Integration Effort Assessment

### Effort Breakdown

| Task | Effort | Blocked? |
|------|--------|----------|
| Fork and clone repo | Trivial | No |
| Install dependencies | Trivial | No |
| Replace API key auth with OAuth | N/A | **YES - SDK doesn't support OAuth** |
| Add Claude in Chrome | High (40+ hours) | No, but major rewrite |
| Integrate planning phase | Medium (8-16 hours) | No |
| Add per-feature model selection | Medium (4-8 hours) | No |
| Terminal output in single window | Already implemented | No |
| Session progress display | Already implemented | No |

### Learning Curve

| Aspect | Complexity |
|--------|------------|
| Python async patterns | Medium - uses asyncio |
| Claude SDK API | Medium - some docs available |
| Hook system | Low - documented pattern |
| Client configuration | Low - env vars |
| Security module | Low - simple allowlist |

### Would We Fight The Framework?

**Yes, significantly.**

1. **Authentication:** The SDK's core assumption is API key auth. Bypassing this requires either:
   - Forking the SDK itself
   - Wrapping with a process spawn (defeats purpose of SDK)

2. **Browser Testing:** The framework assumes CLI-based verification. Adding browser:
   - Requires MCP server integration
   - No existing hooks for browser actions
   - Would need new tool implementations

3. **Planning Phase:** The framework's initializer creates features automatically. Our human-in-the-loop approach means replacing the initializer entirely.

---

## 5. Comparison: Fork vs Build From Scratch

### What Forking Would Give Us

| Benefit | Value | Reality Check |
|---------|-------|---------------|
| Session loop control | High | We can replicate with bash in ~50 lines |
| Progress display | Medium | Our progress.txt + CLI output serves same purpose |
| Security hooks | Medium | Pattern is useful, but Python implementation not directly usable |
| Multi-session orchestration | High | **This is the main value** |
| Pre-built permissions | Medium | Still need to configure for our tools |
| Model selection support | Low | Already exists in Claude CLI |

### What Building From Scratch Would Give Us

| Benefit | Value |
|---------|-------|
| OAuth token support via Claude CLI | **Critical** - CLI supports current auth |
| Claude in Chrome integration | **Critical** - Native to our workflow |
| Existing skills compatibility | High - /continue-ralph, /plan-ralph-loop already work |
| Simpler architecture | High - No Python/SDK learning curve |
| Faster iteration | Medium - Modify bash scripts vs Python SDK |
| Full control | High - No framework constraints |

### Build Cost Comparison

**Fork Approach:**
- Clone repo: 1 hour
- Understand codebase: 4-8 hours
- Discover OAuth blocked: Wasted effort
- Add browser testing: 40+ hours
- Integrate planning: 8-16 hours
- Debug SDK issues: Unknown
- **Total: 50+ hours, with OAuth blocker unresolved**

**Build From Scratch:**
- Session loop script: 2-4 hours (bash while loop)
- Progress display: 2-4 hours (parse progress.txt)
- Permission handling: 4-8 hours (--dangerously-skip-permissions + hooks)
- Integrate with existing skills: Already done
- **Total: 8-16 hours, no blockers**

---

## 6. Repository Maintenance Assessment

| Factor | Assessment |
|--------|------------|
| Last commit | November 25, 2025 (2 months ago) |
| Commit frequency | Single commit (initial release) |
| Issues/PRs | Part of larger claude-quickstarts repo |
| Stars | 13.5k (for entire quickstarts repo) |
| Contributors | 2 (PedramNavid, justinyoung127) |
| Documentation | README only, no API docs |
| Test coverage | test_security.py only |

**Assessment:** This is a demonstration/quickstart, not an actively maintained framework. It's meant to show what's possible, not to be forked and extended.

---

## 7. Recommendation

### Decision: DO NOT FORK

**Primary Reason:** OAuth token authentication is blocked at the SDK level. The Max Plan subscription cannot be used with the Claude Agent SDK.

**Secondary Reasons:**
1. No browser automation - would require 40+ hours to add
2. Tightly coupled architecture - extracting components is complex
3. Demo, not framework - not designed for extension
4. We already have most patterns implemented via skills

### Recommended Approach

Build a lightweight custom orchestrator using bash/Node that:

1. **Shells out to `claude` CLI** (uses current auth, OAuth works)
2. **Runs in single terminal** (mprocs or simple bash loop)
3. **Uses existing skills** (/continue-ralph, /plan-ralph-loop)
4. **Leverages Claude in Chrome** (already integrated)
5. **Adds permission bypass** (--dangerously-skip-permissions + hooks)

### Implementation Path

```bash
# Simple orchestrator concept (ralph-loop.sh)
#!/bin/bash
MAX_ITERATIONS=20
RALPH_DIR="$1"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Ralph Loop Iteration $i ==="

  # Check if complete
  if grep -q '"passes": false' "$RALPH_DIR/feature_list.json"; then
    claude --dangerously-skip-permissions "$(cat $RALPH_DIR/RALPH_PROMPT.md)"
  else
    echo "All features pass! Loop complete."
    exit 0
  fi
done

echo "Max iterations reached."
```

This approach:
- Uses Claude CLI (OAuth works)
- Single terminal window
- Deterministic iteration (bash loop guarantees next iteration)
- 10 lines of code vs forking entire SDK repo

---

## 8. Alternative Investigation Recommendations

If fork approach is still desired, investigate:

1. **Claude Agent SDK OAuth Support**
   - Monitor GitHub issue: https://github.com/anthropics/claude-code/issues/6536
   - Check for SDK updates that add OAuth

2. **Community Forks**
   - claude-max-access-sdk: https://github.com/parkertoddbrooks/claude-max-access-sdk
   - May have workarounds for OAuth restriction

3. **TypeScript SDK**
   - Alternative to Python SDK
   - May have different auth options
   - Documentation: https://platform.claude.com/docs/en/agent-sdk/overview

---

## References

### Investigated Resources
- [Anthropic Autonomous Coding Quickstart](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Claude Agent SDK Python Reference](https://platform.claude.com/docs/en/agent-sdk/python)
- [Claude Agent SDK Hooks](https://platform.claude.com/docs/en/agent-sdk/hooks)

### OAuth Restriction Sources
- [GitHub Issue #6536: OAuth Token Support](https://github.com/anthropics/claude-code/issues/6536)
- [GitHub Issue #9887: OAuth Authentication Error](https://github.com/anthropics/claude-code/issues/9887)
- [Byteiota: Anthropic Blocks Claude Max in OpenCode](https://byteiota.com/anthropic-blocks-claude-max-in-opencode-devs-cancel-200-month-plans/)
- [claude-max-access-sdk README](https://github.com/parkertoddbrooks/claude-max-access-sdk/blob/main/README-claude.md)

### Existing Ralph Loop Implementation
- `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/skills/continue-ralph/SKILL.md`
- `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/skills/plan-ralph-loop/SKILL.md`
- `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/data/ralph-loop-investigations/custom-implementation-v2-and-v3/RALPH_LOOP_IMPLEMENTATION_ROADMAP.md`
