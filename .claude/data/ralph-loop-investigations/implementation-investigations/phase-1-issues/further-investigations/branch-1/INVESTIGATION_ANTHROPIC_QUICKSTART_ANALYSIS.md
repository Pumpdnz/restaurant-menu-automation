# Investigation: Anthropic Autonomous Coding Quickstart Analysis

**Date:** 2026-01-16
**Branch:** 1 (Quickstart Assessment)
**Status:** Complete

---

## Executive Summary

This investigation evaluates whether to fork/adapt the official Anthropic autonomous-coding quickstart or build a custom solution for the Ralph Loop system. After analyzing both the official repo and coleam00's fork, the recommendation is to **build from scratch using the quickstart as reference only**.

**Key Findings:**
1. **OAuth Blocker (CRITICAL):** Neither the official repo nor the SDK support Claude Max OAuth tokens
2. **coleam00's Fork:** Uses same SDK, same OAuth limitation - OAuth token is set via env var, not built into SDK
3. **No Browser Automation:** Both repos use no browser testing, only unit tests
4. **Architectural Overlap:** Our existing Ralph Loop implementation already mirrors Anthropic's validated patterns

**Recommendation:** Use existing Ralph Loop skills + custom bash orchestrator. Do not fork.

---

## 1. Official Anthropic Repo Structure Analysis

### Repository Location
- **URL:** https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding

### File Structure

```
autonomous-coding/
├── autonomous_agent_demo.py  # Main entry point - CLI args, loop control
├── agent.py                  # Session execution logic
├── client.py                 # Claude SDK client configuration
├── security.py               # Bash command allowlist validation
├── progress.py               # Progress tracking/display utilities
├── prompts.py                # Prompt loading utilities
├── test_security.py          # Security validation tests
├── requirements.txt          # Dependencies: claude-code-sdk>=0.1.58
└── prompts/
    ├── app_spec.txt          # Application specification (user editable)
    ├── initializer_prompt.md # First session - creates 200 features
    └── coding_prompt.md      # Continuation sessions
```

### Session Management Architecture

**Two-Agent Pattern:**

| Session | Agent | Purpose | Duration |
|---------|-------|---------|----------|
| 1 | Initializer | Read app_spec.txt, generate feature_list.json (200 items) | 5-10 minutes |
| 2+ | Coding Agent | Pick failing feature, implement, mark passing, commit | 5-15 minutes each |

**Session Flow:**
```
1. Parse args (--project-dir, --max-iterations, --model)
2. Check if feature_list.json exists
3. If not: Run initializer agent to create it
4. If yes: Run coding agent to implement next feature
5. Auto-continue with 3-second delay between sessions
6. Progress persisted via JSON + git commits
7. Resume with same command after Ctrl+C
```

### Permission System (security.py)

**Allowlist-Based Security:**
```python
ALLOWED_COMMANDS = {
    'ls', 'cat', 'head', 'tail', 'wc', 'grep',  # File inspection
    'npm', 'node',                               # Node.js
    'git',                                       # Version control
    'ps', 'lsof', 'sleep', 'pkill'              # Process management
}
```

**Validation Pattern:**
- Extract command name from bash input
- Check against ALLOWED_COMMANDS whitelist
- Block if not found
- Filesystem operations restricted to project directory
- Symlink traversal blocked

### Progress Tracking

**Files Used:**
- `feature_list.json` - Source of truth for feature completion
- `claude-progress.txt` - Session notes
- `.claude_settings.json` - Security settings
- Git commits - Persist work across sessions

**JSON Schema:**
```json
{
  "features": [
    {
      "id": 1,
      "name": "Feature name",
      "description": "Detailed description",
      "passing": false
    }
  ]
}
```

### Terminal UX

**CLI Options:**
```bash
python autonomous_agent_demo.py --project-dir ./my_project
python autonomous_agent_demo.py --project-dir ./my_project --max-iterations 3
python autonomous_agent_demo.py --project-dir ./my_project --model claude-sonnet-4-5-20250929
```

**User Experience:**
- Single terminal window shows all output
- `[Tool: ...]` messages indicate active work
- Ctrl+C to pause, same command to resume
- Progress displayed continuously

---

## 2. coleam00's Fork Analysis

### Repository Location
- **URL:** https://github.com/coleam00/Linear-Coding-Agent-Harness

### Key Differences from Official Repo

| Aspect | Official Repo | coleam00's Fork |
|--------|---------------|-----------------|
| Task Management | Local feature_list.json | Linear issues (cloud) |
| State Persistence | JSON + git | Linear issue status |
| Feature Count | 200 by default | 50 by default |
| Authentication | ANTHROPIC_API_KEY | CLAUDE_CODE_OAUTH_TOKEN |
| Browser Automation | None | Puppeteer MCP |

### OAuth Token Implementation

**Not built into SDK - Environment Variable:**
```bash
# User must generate token via Claude Code CLI
claude setup-token

# Then set environment variable
export CLAUDE_CODE_OAUTH_TOKEN='your-oauth-token-here'
```

**Critical Finding:** The fork does not modify the SDK to support OAuth. It simply uses the environment variable that Claude Code CLI supports. The SDK itself still requires API key authentication.

### Linear Integration Architecture

```yaml
# Replaces local JSON with Linear API
procs:
  initializer:
    - Creates Linear project
    - Generates 50 issues with test steps
    - Creates META issue for session summaries

  coding:
    - Queries Linear for Todo issues
    - Implements feature
    - Updates issue status (Todo -> Done)
    - Adds implementation details as comments
```

### MCP Server Configuration

```yaml
servers:
  linear:
    transport: http
    purpose: Issue management

  puppeteer:
    transport: stdio
    purpose: Browser automation (UI testing)
```

### What We Could Extract

| Component | Reusable? | Effort |
|-----------|-----------|--------|
| OAuth env var pattern | Yes - trivial | Already in our CLI |
| Linear integration | No - different architecture | Not needed |
| Puppeteer MCP config | Possibly | We prefer Claude in Chrome |
| Session loop | Pattern only | Already have /continue-ralph |

---

## 3. Claude Agent SDK Technical Details

### Session Management

**Python SDK API:**
```python
from claude_agent_sdk import ClaudeSDKClient

# Create client
client = ClaudeSDKClient()

# Simple text query (no tools)
response = client.query("What is 2+2?")

# Agentic session with tools
session = client.create_session(
    tools=[...],
    permissions={...}
)

# Resume session
resumed = client.resume_session(session_id)

# Fork session
forked = client.fork_session(session_id)
```

### Subprocess Architecture

The SDK spawns Claude Code CLI as a subprocess:
```
Python SDK
    └── SubprocessCLITransport
        └── claude CLI (bundled v2.0.76)
            └── Anthropic API
```

**Transport Features:**
- JSON reassembly state machine for stdout
- Write lock for stdin serialization
- Version checking for compatibility
- CLI discovery (bundled -> cli_path -> PATH -> common locations)

### Authentication Limitation

**Supported:**
```bash
export ANTHROPIC_API_KEY='sk-ant-...'
```

**NOT Supported by SDK:**
```bash
export CLAUDE_CODE_OAUTH_TOKEN='...'  # Only works with raw CLI
```

The SDK validates authentication at initialization and does not support OAuth tokens.

---

## 4. Puppeteer MCP vs Claude in Chrome

### Puppeteer MCP

**Status:** Official @modelcontextprotocol/server-puppeteer is **DEPRECATED**

**Alternative:** Playwright MCP (recommended)

**Characteristics:**
- Headless browser automation
- Separate browser instance from user
- No access to authenticated sessions
- May trigger bot detection
- Traditional automation patterns

**Community Options:**
- puppeteer-mcp-claude - Comprehensive but external
- puppeteer-real-browser-mcp-server - Stealth mode
- Most use stdio transport

### Claude in Chrome

**Characteristics:**
- Operates in user's active browser
- Access to authenticated sessions (Gmail, GitHub, etc.)
- Real-time visibility
- No bot detection (real browser)
- On-device processing
- Tab group management

**Advantages:**
- Data stays local
- No session re-login
- User can observe actions
- Near-instantaneous execution
- Retains cookies/storage

**Limitations:**
- Chrome/Chromium only (currently)
- Early development
- Requires extension installation

### Recommendation for Ralph Loop

**Use Claude in Chrome** because:
1. Already integrated in our workflow
2. Real-time browser visibility is a core requirement
3. Authenticated session access needed
4. No bot detection concerns
5. User can observe and intervene

---

## 5. Requirements Mapping

### Ralph Loop Requirements vs Available Solutions

| Requirement | Official Repo | coleam00's Fork | Custom Build |
|-------------|---------------|-----------------|--------------|
| Human-in-the-loop planning | No (auto 200 features) | No | Yes (/plan-ralph-loop) |
| Fully autonomous sessions | Yes | Yes | Yes (/continue-ralph) |
| Single terminal log streaming | Yes | Yes | Yes (bash loop) |
| Real-time browser visibility | No | No (headless Puppeteer) | Yes (Claude in Chrome) |
| Per-feature model selection | No (session-level only) | No | Can implement |
| Custom hooks/permissions | Yes (security.py) | Yes | Yes (--dangerously-skip-permissions) |
| OAuth token support | **NO** | **NO (env var only)** | **YES (CLI supports)** |

### Gap Analysis

**Already Have:**
- Two-agent architecture (/plan-ralph-loop + /continue-ralph)
- feature_list.json with Anthropic schema
- progress.txt tracking
- init.sh environment setup
- Session start procedure (Anthropic pattern)
- One-feature-per-iteration constraint
- Claude in Chrome integration

**Missing (from Phase 1 Issues):**
1. Reliable session spawning (90% -> 99% target)
2. Permission automation (--dangerously-skip-permissions + hooks)
3. Per-feature model selection

**Not Addressable by Forking:**
- OAuth authentication (SDK limitation)
- Claude in Chrome (neither repo has browser integration)

---

## 6. Component Inventory

### Extractable Patterns (Reference Only)

| Pattern | Source | How to Use |
|---------|--------|------------|
| Bash allowlist | security.py | Reference for hook implementation |
| Session loop control | autonomous_agent_demo.py | Pattern for bash orchestrator |
| Progress display format | progress.py | Reference for CLI output |
| Feature JSON schema | prompts/ | Already adopted |
| Session start procedure | coding_prompt.md | Already in RALPH_PROMPT.md |

### Not Extractable (Too Coupled)

| Component | Why Not |
|-----------|---------|
| client.py | Hardcoded API key auth |
| agent.py | Heavy SDK dependencies |
| prompts/*.md | 200-feature pattern, no browser |
| Full SDK integration | OAuth blocked |

### Already Implemented in Ralph Loop

| Component | Our Implementation |
|-----------|-------------------|
| Two-agent pattern | /plan-ralph-loop + /continue-ralph |
| Feature tracking | feature_list.json (Anthropic schema) |
| Progress persistence | progress.txt + feature_list.json |
| Session isolation | Fresh CLI sessions |
| Environment setup | init.sh |
| Browser testing | Claude in Chrome (MCP) |

---

## 7. Implementation Effort Estimates

### Option A: Full Fork and Modify

| Task | Hours | Blocker? |
|------|-------|----------|
| Clone and setup | 1 | No |
| Understand codebase | 4-8 | No |
| OAuth support | N/A | **YES - SDK doesn't support** |
| Add Claude in Chrome | 40-60 | No |
| Integrate planning | 8-16 | No |
| Per-feature models | 4-8 | No |
| Debug SDK issues | 20+ | Likely |
| **Total** | **77-93+** | **Blocked** |

### Option B: Extract Components Only

| Task | Hours | Blocker? |
|------|-------|----------|
| Extract security patterns | 2-4 | No |
| Adapt for bash hooks | 4-8 | No |
| Implement progress display | 4-8 | No |
| **Total** | **10-20** | **No** |

### Option C: Build From Scratch Using as Reference

| Task | Hours | Blocker? |
|------|-------|----------|
| Bash orchestrator loop | 2-4 | No |
| Permission configuration | 4-8 | No |
| Progress display | 2-4 | No |
| Model selection per feature | 4-8 | No |
| Test with existing skills | 4-8 | No |
| **Total** | **16-32** | **No** |

---

## 8. Recommendation

### Decision: BUILD FROM SCRATCH (Option C)

**Primary Reasons:**

1. **OAuth Authentication is Blocked**
   - SDK requires API key, not OAuth token
   - Max Plan subscription only works with Claude CLI
   - Cannot use SDK without paying for API usage

2. **Browser Automation Missing**
   - Neither repo has browser testing
   - Would require 40-60 hours to add
   - We already have Claude in Chrome working

3. **Existing Implementation is Sufficient**
   - Ralph Loop skills already follow Anthropic patterns
   - Only need to fix Phase 1 issues
   - No need to adopt new framework

4. **Lower Risk and Faster**
   - 16-32 hours vs 77+ hours (blocked)
   - No SDK learning curve
   - Uses proven CLI approach

### Recommended Implementation

**Simple Bash Orchestrator:**
```bash
#!/bin/bash
# ralph-orchestrator.sh
MAX_ITERATIONS=${2:-20}
RALPH_DIR="$1"

for i in $(seq 1 $MAX_ITERATIONS); do
  echo "=== Ralph Loop Iteration $i/$MAX_ITERATIONS ==="

  # Check completion
  if ! grep -q '"passes": false' "$RALPH_DIR/feature_list.json"; then
    echo "All features pass! Loop complete."
    exit 0
  fi

  # Determine model for next feature (optional enhancement)
  # MODEL=$(jq -r '[.features[] | select(.passes==false)][0].model // "opus"' "$RALPH_DIR/feature_list.json")

  # Run Claude session
  claude --dangerously-skip-permissions \
    "$(cat $RALPH_DIR/RALPH_PROMPT.md)"

  # Brief pause between iterations
  sleep 3
done

echo "Max iterations reached."
```

**Benefits:**
- Uses Claude CLI (OAuth works)
- Single terminal window
- Deterministic iteration (bash guarantees continuation)
- Easy to understand and debug
- 20 lines vs forking entire repo

### What to Extract from Repos

**From Official Repo (patterns only):**
- Security.py allowlist pattern -> Reference for PreToolUse hooks
- Session start procedure -> Already in RALPH_PROMPT.md
- One-feature-per-iteration constraint -> Already enforced

**From coleam00's Fork:**
- Nothing code-wise (same SDK limitations)
- Concept: Linear as external task tracker (future enhancement)

---

## 9. Next Steps

1. **Implement bash orchestrator** (2-4 hours)
   - Create ralph-orchestrator.sh
   - Test with city-breakdown-dashboard task

2. **Add permission configuration** (4-8 hours)
   - Configure .claude/settings.local.json with allowlists
   - Add PreToolUse hooks for safety

3. **Test per-feature model selection** (4-8 hours)
   - Extend feature_list.json schema
   - Modify orchestrator to read model field

4. **Consider mprocs for parallel** (Phase 2)
   - Investigate for multi-worktree execution
   - Alternative to bash loop for parallel sessions

---

## References

### Primary Sources
- [Anthropic Autonomous Coding Quickstart](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)
- [coleam00's Linear-Coding-Agent-Harness](https://github.com/coleam00/Linear-Coding-Agent-Harness)
- [Claude Agent SDK Overview](https://platform.claude.com/docs/en/agent-sdk/overview)

### OAuth Restriction Documentation
- [GitHub Issue #9887: OAuth Authentication Error](https://github.com/anthropics/claude-code/issues/9887)
- [Claude Code Action with OAuth - GitHub Marketplace](https://github.com/marketplace/actions/claude-code-action-with-oauth)

### Browser Automation
- [puppeteer-mcp-claude](https://github.com/jaenster/puppeteer-mcp-claude)
- [Browser MCP Chrome Extension](https://www.blog.brightcoding.dev/2025/07/01/mcp-server-chrome-extension-empowering-ai-apps-to-control-your-browser/)

### Existing Ralph Loop Implementation
- `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/skills/continue-ralph/SKILL.md`
- `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/skills/plan-ralph-loop/SKILL.md`
- `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/data/ralph-loop-investigations/phase-1-issues/PHASE_1_CURRENT_ISSUES.md`
