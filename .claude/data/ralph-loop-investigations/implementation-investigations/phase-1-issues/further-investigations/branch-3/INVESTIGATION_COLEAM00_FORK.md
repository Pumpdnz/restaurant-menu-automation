# Investigation: coleam00's Linear-Coding-Agent-Harness Fork

**Investigation Date:** 2026-01-16
**Repository:** https://github.com/coleam00/Linear-Coding-Agent-Harness
**Purpose:** Analyze OAuth implementation patterns for Ralph Loop integration

---

## Executive Summary

coleam00's fork demonstrates a clean implementation of OAuth token authentication using the Claude Code SDK (`claude-code-sdk`). The OAuth pattern is **simple and extractable** - it's essentially a single environment variable swap. The Linear integration is **moderately coupled** but can be removed with targeted file deletions and modifications. The fork provides valuable patterns for session management, security hooks, and autonomous agent loops.

**Key Finding:** The OAuth authentication is trivially simple - Claude Code SDK handles it transparently when you use `CLAUDE_CODE_OAUTH_TOKEN` instead of `ANTHROPIC_API_KEY`.

---

## 1. OAuth Implementation Analysis

### How OAuth Works in This Fork

The OAuth implementation is remarkably straightforward. The entire authentication mechanism is handled by the Claude Code SDK itself.

**Key Code Location:** `client.py` (lines 70-75)

```python
def create_client(project_dir: Path, model: str) -> ClaudeSDKClient:
    api_key = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if not api_key:
        raise ValueError(
            "CLAUDE_CODE_OAUTH_TOKEN environment variable not set.\n"
            "Run 'claude setup-token after installing the Claude Code CLI."
        )
```

### Token Generation Process

```bash
# 1. Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 2. Generate OAuth token (authenticates via claude.ai web)
claude setup-token

# 3. Set environment variable
export CLAUDE_CODE_OAUTH_TOKEN='your-oauth-token-here'
```

### What the SDK Does

The `claude-code-sdk` Python package handles:
- Token-based authentication with Claude's OAuth infrastructure
- Automatic token refresh/validation
- All API communication

**Dependency:** `claude-code-sdk>=0.0.25` (single requirement)

### Files Involved in OAuth

| File | OAuth-Related Code | Description |
|------|-------------------|-------------|
| `client.py` | `os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")` | Token retrieval |
| `autonomous_agent_demo.py` | `os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")` | Validation check |
| `requirements.txt` | `claude-code-sdk>=0.0.25` | SDK dependency |

---

## 2. Linear Integration Assessment

### Coupling Analysis

Linear is integrated at **medium coupling** - it's used for project management but is separable.

**Linear-Specific Files (can be deleted):**
- `linear_config.py` - Configuration constants for Linear
- `prompts/initializer_prompt.md` - Creates Linear issues
- `prompts/coding_prompt.md` - Works Linear issues

**Files with Linear Code (need modification):**

| File | Linear Code | Removal Effort |
|------|-------------|----------------|
| `client.py` | LINEAR_TOOLS list, MCP server config | Remove ~40 lines |
| `agent.py` | `is_linear_initialized()` check | Replace with local file check |
| `progress.py` | `load_linear_project_state()` | Replace with local JSON |
| `autonomous_agent_demo.py` | LINEAR_API_KEY check | Remove check |

### MCP Server Configuration for Linear

```python
# In client.py - Linear MCP configuration
"linear": {
    "type": "http",
    "url": "https://mcp.linear.app/mcp",
    "headers": {
        "Authorization": f"Bearer {linear_api_key}"
    }
}
```

### What Linear Provides

1. **Issue Tracking:** Progress tracked via Linear issues instead of local files
2. **Session Handoff:** Agents communicate via Linear comments
3. **Visual Progress:** Watch progress in Linear workspace

For Ralph Loop, we can replace this with:
- `feature_list.json` for issue tracking
- `progress.txt` for session handoff
- Terminal output for visual progress

---

## 3. Extraction Guide: OAuth Without Linear

### Minimal OAuth Implementation

To extract just the OAuth pattern for Ralph Loop:

**Step 1: Use the Claude Code SDK**

```python
# requirements.txt
claude-code-sdk>=0.0.25
```

**Step 2: Create Client with OAuth Token**

```python
import os
from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient

def create_client(project_dir: Path, model: str) -> ClaudeSDKClient:
    api_key = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if not api_key:
        raise ValueError("CLAUDE_CODE_OAUTH_TOKEN not set. Run 'claude setup-token'")

    return ClaudeSDKClient(
        options=ClaudeCodeOptions(
            model=model,
            system_prompt="Your custom system prompt here",
            allowed_tools=["Read", "Write", "Edit", "Glob", "Grep", "Bash"],
            max_turns=1000,
            cwd=str(project_dir.resolve()),
        )
    )
```

**Step 3: Run Sessions**

```python
async def run_agent_session(client: ClaudeSDKClient, message: str):
    async with client:
        await client.query(message)
        async for msg in client.receive_response():
            # Process messages
            pass
```

### Files to Extract from coleam00's Fork

For a clean OAuth-only implementation, extract:

1. **client.py** (with Linear removed):
   - Keep: `create_client()`, `BUILTIN_TOOLS`
   - Remove: `LINEAR_TOOLS`, Linear MCP config

2. **agent.py** (with Linear removed):
   - Keep: `run_agent_session()`, `run_autonomous_agent()`
   - Replace: `is_linear_initialized()` with local file check

3. **security.py** (fully reusable):
   - Complete bash command allowlist system
   - Pre-tool-use hooks for security

4. **autonomous_agent_demo.py** (with Linear removed):
   - Keep: CLI argument parsing, main loop
   - Remove: LINEAR_API_KEY check

---

## 4. Additional Features Found

### 4.1 Security Hooks System

Excellent security implementation using pre-tool-use hooks:

```python
# ALLOWED_COMMANDS allowlist
ALLOWED_COMMANDS = {
    "ls", "cat", "head", "tail", "wc", "grep",  # File inspection
    "cp", "mkdir", "chmod",                       # File operations
    "npm", "node",                                # Development
    "git",                                        # Version control
    "ps", "lsof", "sleep", "pkill",              # Process management
}

# Hook implementation
async def bash_security_hook(input_data, tool_use_id=None, context=None):
    if input_data.get("tool_name") != "Bash":
        return {}
    command = input_data.get("tool_input", {}).get("command", "")
    commands = extract_commands(command)
    for cmd in commands:
        if cmd not in ALLOWED_COMMANDS:
            return {"decision": "block", "reason": f"Command '{cmd}' not allowed"}
    return {}
```

**Value for Ralph Loop:** Prevents dangerous commands in autonomous mode.

### 4.2 Session Management Pattern

Clean async context manager for sessions:

```python
async def run_autonomous_agent(project_dir, model, max_iterations=None):
    iteration = 0
    while True:
        iteration += 1
        if max_iterations and iteration > max_iterations:
            break

        # Fresh client each iteration (new context)
        client = create_client(project_dir, model)

        async with client:
            status, response = await run_agent_session(client, prompt)

        await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)
```

**Value for Ralph Loop:** Exact pattern needed for spawning fresh sessions.

### 4.3 Progress Display

Console-based progress tracking:

```python
def print_session_header(session_num: int, is_initializer: bool):
    session_type = "INITIALIZER" if is_initializer else "CODING AGENT"
    print("\n" + "=" * 70)
    print(f"  SESSION {session_num}: {session_type}")
    print("=" * 70)
```

### 4.4 Tool Output Streaming

Real-time tool use display:

```python
async for msg in client.receive_response():
    if msg_type == "AssistantMessage":
        for block in msg.content:
            if block_type == "ToolUseBlock":
                print(f"\n[Tool: {block.name}]", flush=True)
```

---

## 5. Comparison of Approaches

### Option A: Use coleam00's Fork Directly (with Linear removed)

**Pros:**
- Working implementation
- Security hooks ready
- Session management patterns proven
- MIT licensed

**Cons:**
- Need to remove Linear code (~100 lines)
- Python-based (our current Ralph Loop is bash/node)
- Need to adapt prompts

**Effort:** 2-4 hours

### Option B: Extract OAuth Changes to Official Repo

The official `anthropic-quickstarts` repo doesn't use the Claude Code SDK - it uses direct API calls with `ANTHROPIC_API_KEY`.

**Pros:**
- More features (computer use, browser tools)
- Official support

**Cons:**
- No OAuth support out of box
- Would need significant modification
- Different architecture (Docker-based)

**Effort:** 8-16 hours

### Option C: Build OAuth Integration from coleam00's Patterns

**Pros:**
- Custom fit for Ralph Loop
- Can use TypeScript/Node.js to match existing code
- Cherry-pick only needed patterns

**Cons:**
- More initial work
- Need to implement SDK equivalent in JS/TS

**Effort:** 6-12 hours

---

## 6. Recommendation

### Best Approach: Option A (Use coleam00's Fork with Linear Removed)

**Rationale:**

1. **OAuth is trivial** - The entire OAuth mechanism is: use `CLAUDE_CODE_OAUTH_TOKEN` instead of `ANTHROPIC_API_KEY`. The Claude Code SDK handles everything.

2. **Linear removal is clean** - Linear is used but not deeply integrated. Remove 4 files, modify 3 others.

3. **Valuable patterns** - The security hooks, session management, and progress tracking are exactly what Ralph Loop needs.

4. **Immediate start** - Can have a working OAuth-enabled autonomous loop in 2-4 hours.

### Implementation Plan

1. **Clone coleam00's fork**
2. **Remove Linear:**
   - Delete: `linear_config.py`, `prompts/initializer_prompt.md`, `prompts/coding_prompt.md`
   - Remove from `client.py`: `LINEAR_TOOLS`, Linear MCP config
   - Remove from `autonomous_agent_demo.py`: LINEAR_API_KEY check
   - Modify `progress.py`: Use local JSON instead of Linear state

3. **Adapt for Ralph Loop:**
   - Replace Linear-based progress with `feature_list.json`
   - Replace Linear comments with `progress.txt`
   - Add RALPH_PROMPT.md loading

4. **Setup OAuth:**
   - Run `claude setup-token` (opens browser for OAuth)
   - Export `CLAUDE_CODE_OAUTH_TOKEN`

---

## 7. Key Takeaways

1. **OAuth Token is Simple:** Just use `CLAUDE_CODE_OAUTH_TOKEN` env var with claude-code-sdk
2. **Token comes from:** `claude setup-token` CLI command (authenticates via browser)
3. **Claude Max Plan:** Using OAuth token automatically uses your Claude Max subscription
4. **Linear is Optional:** Can be completely removed without breaking core functionality
5. **Security Hooks:** Valuable pattern for restricting bash commands in autonomous mode
6. **Session Pattern:** Fresh `ClaudeSDKClient` each iteration enables clean context resets

---

## Appendix: Complete File Inventory

| File | Lines | Purpose | Linear-Dependent |
|------|-------|---------|------------------|
| `client.py` | ~95 | SDK client configuration | Partially |
| `agent.py` | ~130 | Session logic | Partially |
| `autonomous_agent_demo.py` | ~127 | Entry point | Partially |
| `security.py` | ~359 | Bash command security | No |
| `progress.py` | ~81 | Progress display | Yes |
| `prompts.py` | ~37 | Prompt loading | No |
| `linear_config.py` | ~37 | Linear constants | Yes (delete) |
| `requirements.txt` | 1 | Dependencies | No |

**Total effort to remove Linear:** ~150 lines of code to delete/modify
