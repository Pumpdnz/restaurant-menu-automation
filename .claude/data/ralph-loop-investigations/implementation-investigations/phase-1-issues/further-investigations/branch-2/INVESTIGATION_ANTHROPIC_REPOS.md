# Investigation: Anthropic Autonomous Coding Quickstart Analysis

## Executive Summary

This investigation analyzes two repositories for potential adoption/adaptation in our Ralph Loop system:

1. **Official Anthropic**: `anthropics/claude-quickstarts/autonomous-coding`
2. **coleam00's Fork**: `coleam00/Linear-Coding-Agent-Harness`

**Key Finding**: coleam00's fork provides the OAuth token implementation we need, while the official repo provides the foundational architecture. We should extract patterns from both and build a custom hybrid solution optimized for our requirements.

---

## Repository Architectures

### Official Anthropic Repository

**URL**: https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding

**Architecture Overview**:
```
autonomous-coding/
├── autonomous_agent_demo.py  # Main entry point
├── agent.py                  # Agent session logic (async loop)
├── client.py                 # Claude SDK client configuration
├── security.py               # Bash command allowlist/validation
├── progress.py               # Progress tracking (feature_list.json)
├── prompts.py                # Prompt loading utilities
├── prompts/
│   ├── app_spec.txt          # Application specification
│   ├── initializer_prompt.md # First session prompt
│   └── coding_prompt.md      # Continuation session prompt
└── requirements.txt
```

**Key Characteristics**:
- Uses `ANTHROPIC_API_KEY` environment variable (API key auth)
- Two-agent pattern: Initializer + Coding Agent
- Progress tracked via local `feature_list.json` file
- Session continuation via 3-second auto-delay
- Puppeteer MCP for browser automation
- Defense-in-depth security model (sandbox + filesystem restrictions + bash allowlist)
- Default model: `claude-sonnet-4-5-20250929`

### coleam00's Linear-Integrated Fork

**URL**: https://github.com/coleam00/Linear-Coding-Agent-Harness

**Architecture Overview**:
```
linear-agent-harness/
├── autonomous_agent_demo.py  # Main entry point
├── agent.py                  # Agent session logic (nearly identical)
├── client.py                 # OAuth token + Linear MCP configuration
├── security.py               # Same bash security model
├── progress.py               # Linear-aware progress tracking
├── prompts.py                # Prompt loading utilities
├── linear_config.py          # Linear configuration constants
├── prompts/
│   ├── app_spec.txt          # Application specification
│   ├── initializer_prompt.md # Creates Linear issues
│   └── coding_prompt.md      # Works Linear issues
└── requirements.txt
```

**Key Characteristics**:
- Uses `CLAUDE_CODE_OAUTH_TOKEN` environment variable (Max Plan OAuth)
- Uses `LINEAR_API_KEY` for project management integration
- Progress tracked via Linear issues (not local files)
- Session handoff via Linear comments and META issue
- Linear MCP server via HTTP transport (`https://mcp.linear.app/mcp`)
- Puppeteer MCP for browser automation
- Default model: `claude-opus-4-5-20251101`

---

## Feature-by-Feature Comparison

| Feature | Official Anthropic | coleam00's Fork | Our Requirement | Status |
|---------|-------------------|-----------------|-----------------|--------|
| **Authentication** | `ANTHROPIC_API_KEY` | `CLAUDE_CODE_OAUTH_TOKEN` | Max Plan OAuth Token | coleam00 |
| **Session Spawning** | Fresh ClaudeSDKClient per iteration | Same pattern | Sequential in same terminal | Both work |
| **Model Selection** | CLI arg `--model` | CLI arg `--model` | Per-session model selection | Needs extension |
| **Browser Testing** | Puppeteer MCP (headless) | Puppeteer MCP (headless) | Claude in Chrome (visible) | Custom build |
| **Progress Tracking** | `feature_list.json` (local) | Linear issues (cloud) | File-system based | Official |
| **Session Continuation** | 3s auto-delay + file check | 3s auto-delay + Linear check | Same pattern works | Both work |
| **Permissions Config** | `.claude_settings.json` | Same pattern | Custom permissions | Both work |
| **Security Hooks** | Bash allowlist validation | Same pattern | Custom allowlist | Both work |
| **State Management** | Local files | Linear API | File-system | Official |
| **Real-time Visibility** | Terminal output only | Linear + Terminal | Browser visible | Custom build |

---

## OAuth Token Implementation (coleam00)

### Key Code Extraction

From `client.py` in coleam00's fork:

```python
def create_client(project_dir: Path, model: str) -> ClaudeSDKClient:
    """
    Create a Claude Agent SDK client with multi-layered security.
    """
    # OAuth token authentication (Max Plan)
    api_key = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if not api_key:
        raise ValueError(
            "CLAUDE_CODE_OAUTH_TOKEN environment variable not set.\n"
            "Run 'claude setup-token after installing the Claude Code CLI."
        )

    # ... security settings creation ...

    return ClaudeSDKClient(
        options=ClaudeCodeOptions(
            model=model,
            system_prompt="...",
            allowed_tools=[...],
            mcp_servers={...},
            hooks={...},
            max_turns=1000,
            cwd=str(project_dir.resolve()),
            settings=str(settings_file.resolve()),
        )
    )
```

### OAuth Token Setup Process

```bash
# 1. Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 2. Generate OAuth token (requires Max Plan subscription)
claude setup-token

# 3. Export the token
export CLAUDE_CODE_OAUTH_TOKEN='sk-ant-oat01-...'
```

**Important**: The SDK automatically uses `CLAUDE_CODE_OAUTH_TOKEN` when present. No code changes needed to the ClaudeSDKClient - it reads the environment variable internally.

---

## Session Spawning Mechanism

Both repos use the same core pattern:

```python
async def run_autonomous_agent(
    project_dir: Path,
    model: str,
    max_iterations: Optional[int] = None,
) -> None:
    """Run the autonomous agent loop."""

    # Main loop - each iteration is a fresh session
    iteration = 0
    while True:
        iteration += 1

        # Check termination conditions
        if max_iterations and iteration > max_iterations:
            break

        # Create fresh client (new context window)
        client = create_client(project_dir, model)

        # Choose prompt based on session type
        if is_first_run:
            prompt = get_initializer_prompt()
            is_first_run = False
        else:
            prompt = get_coding_prompt()

        # Run session with async context manager
        async with client:
            status, response = await run_agent_session(client, prompt, project_dir)

        # Auto-continue with delay
        if status == "continue":
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)
```

**Key Points**:
- Fresh `ClaudeSDKClient` created for each iteration (clean context)
- Async context manager handles connection lifecycle
- 3-second delay between sessions
- Progress persisted externally (files or Linear)
- Ctrl+C pauses; re-run same command resumes

---

## What We Can Adopt vs Build

### Directly Adoptable

| Component | Source | Notes |
|-----------|--------|-------|
| OAuth token auth pattern | coleam00 | Just use `CLAUDE_CODE_OAUTH_TOKEN` env var |
| ClaudeSDKClient usage | Both | Async context manager pattern |
| Security hook architecture | Both | Bash allowlist validation |
| Permission settings JSON | Both | `.claude_settings.json` structure |
| Session loop structure | Both | While loop with fresh client per iteration |
| Progress file format | Official | `feature_list.json` structure |

### Needs Modification

| Component | Modification Needed |
|-----------|---------------------|
| Model selection | Add per-session model config (not just CLI arg) |
| MCP servers | Replace Puppeteer with Claude in Chrome tools |
| Progress tracking | Adapt for our `progress.txt` / `feature_list.json` format |
| Prompts | Custom prompts for Ralph Loop workflow |
| State markers | Use our `.linear_project.json` equivalent for state |

### Build From Scratch

| Component | Reason |
|-----------|--------|
| Claude in Chrome integration | Not MCP-based; different tool interface |
| Per-task model selection | Neither repo supports opus/sonnet/haiku per-feature |
| Real-time browser visibility | Puppeteer is headless; we need visible Chrome |
| Custom state machine | Our Ralph Loop has specific state transitions |

---

## Code Snippets to Copy

### 1. OAuth Client Creation (from coleam00)

```python
def create_client(project_dir: Path, model: str) -> ClaudeSDKClient:
    """Create Claude SDK client with OAuth token."""

    # Get OAuth token from environment
    oauth_token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if not oauth_token:
        raise ValueError(
            "CLAUDE_CODE_OAUTH_TOKEN not set.\n"
            "Run: claude setup-token"
        )

    # Security settings
    security_settings = {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                "Read(./**)",
                "Write(./**)",
                "Edit(./**)",
                "Glob(./**)",
                "Grep(./**)",
                "Bash(*)",
                # Add our custom tools here
            ],
        },
    }

    # Write settings file
    settings_file = project_dir / ".claude_settings.json"
    with open(settings_file, "w") as f:
        json.dump(security_settings, f, indent=2)

    return ClaudeSDKClient(
        options=ClaudeCodeOptions(
            model=model,
            system_prompt="...",
            allowed_tools=[...],
            hooks={"PreToolUse": [...]},
            max_turns=1000,
            cwd=str(project_dir.resolve()),
            settings=str(settings_file.resolve()),
        )
    )
```

### 2. Session Runner (from both)

```python
async def run_agent_session(
    client: ClaudeSDKClient,
    message: str,
    project_dir: Path,
) -> tuple[str, str]:
    """Run a single agent session."""

    try:
        await client.query(message)

        response_text = ""
        async for msg in client.receive_response():
            msg_type = type(msg).__name__

            if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    block_type = type(block).__name__

                    if block_type == "TextBlock":
                        response_text += block.text
                        print(block.text, end="", flush=True)
                    elif block_type == "ToolUseBlock":
                        print(f"\n[Tool: {block.name}]", flush=True)

            elif msg_type == "UserMessage" and hasattr(msg, "content"):
                for block in msg.content:
                    if type(block).__name__ == "ToolResultBlock":
                        is_error = getattr(block, "is_error", False)
                        if is_error:
                            print(f"   [Error]", flush=True)
                        else:
                            print("   [Done]", flush=True)

        return "continue", response_text

    except Exception as e:
        return "error", str(e)
```

### 3. Security Hook (from both)

```python
ALLOWED_COMMANDS = {
    "ls", "cat", "head", "tail", "wc", "grep",
    "cp", "mkdir", "chmod", "pwd",
    "npm", "node", "git",
    "ps", "lsof", "sleep", "pkill",
}

async def bash_security_hook(input_data, tool_use_id=None, context=None):
    """Validate bash commands against allowlist."""

    if input_data.get("tool_name") != "Bash":
        return {}

    command = input_data.get("tool_input", {}).get("command", "")
    commands = extract_commands(command)

    for cmd in commands:
        if cmd not in ALLOWED_COMMANDS:
            return {
                "decision": "block",
                "reason": f"Command '{cmd}' not in allowed list",
            }

    return {}
```

### 4. Progress Tracking (from official)

```python
def count_passing_tests(project_dir: Path) -> tuple[int, int]:
    """Count passing/total tests in feature_list.json."""

    tests_file = project_dir / "feature_list.json"
    if not tests_file.exists():
        return 0, 0

    try:
        with open(tests_file, "r") as f:
            tests = json.load(f)

        total = len(tests)
        passing = sum(1 for t in tests if t.get("passes", False))
        return passing, total
    except (json.JSONDecodeError, IOError):
        return 0, 0
```

---

## Recommended Extraction Strategy

### Phase 1: Core Infrastructure (Week 1)

1. **Copy from coleam00**:
   - OAuth token environment variable pattern
   - Client creation with security settings
   - Async context manager usage

2. **Copy from Official**:
   - Progress tracking via `feature_list.json`
   - Session loop structure
   - Security hook architecture

### Phase 2: Custom Extensions (Week 2)

1. **Build Custom**:
   - Per-session model selection logic
   - Claude in Chrome tool integration
   - Ralph Loop state machine
   - Custom prompt templates

2. **Adapt**:
   - Security allowlist for our tools
   - Progress file format for our needs

### Phase 3: Integration (Week 3)

1. **Wire Together**:
   - Connect to existing Ralph Loop prompts
   - Integrate with `init.sh` workflow
   - Test sequential session spawning

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| OAuth token expiration | Sessions fail mid-loop | Implement token refresh or long-lived tokens |
| Claude in Chrome not MCP-compatible | Can't use SDK tool system | Use existing Claude Code tool interface |
| Context window limits | Long sessions truncate | Chunk features into smaller batches |
| Rate limits | Sessions throttled | Add exponential backoff |
| Network issues | MCP connections drop | Implement retry logic with state persistence |
| Security hook bypass | Unsafe commands execute | Test allowlist thoroughly |

---

## Implementation Recommendation

**Recommended Approach**: Build a **hybrid solution** that:

1. Uses **coleam00's OAuth authentication pattern** directly
2. Uses **Official repo's file-based progress tracking** (not Linear)
3. Uses **Official repo's session loop architecture**
4. **Replaces Puppeteer MCP** with Claude in Chrome (our existing tools)
5. **Extends model selection** to support per-feature opus/sonnet/haiku
6. **Keeps security hook pattern** but with our custom allowlist

This gives us:
- Max Plan OAuth support (from coleam00)
- Simple file-based state (no external dependencies)
- Proven session management patterns
- Custom browser testing with real visibility
- Flexibility for our specific workflow

---

## References

- [Agent SDK Overview - Claude Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK Python Reference](https://platform.claude.com/docs/en/agent-sdk/python)
- [Claude Agent SDK GitHub](https://github.com/anthropics/claude-agent-sdk-python)
- [coleam00 OAuth Demo](https://github.com/weidwonder/claude_agent_sdk_oauth_demo)
- [Claude Code SDK Docker](https://github.com/cabinlab/claude-code-sdk-docker)

---

## Appendix: Full File Contents Retrieved

### Official Anthropic - client.py

```python
"""
Claude SDK Client Configuration
"""

import json
import os
from pathlib import Path

from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient
from claude_code_sdk.types import HookMatcher

from security import bash_security_hook

PUPPETEER_TOOLS = [
    "mcp__puppeteer__puppeteer_navigate",
    "mcp__puppeteer__puppeteer_screenshot",
    "mcp__puppeteer__puppeteer_click",
    "mcp__puppeteer__puppeteer_fill",
    "mcp__puppeteer__puppeteer_select",
    "mcp__puppeteer__puppeteer_hover",
    "mcp__puppeteer__puppeteer_evaluate",
]

BUILTIN_TOOLS = [
    "Read", "Write", "Edit", "Glob", "Grep", "Bash",
]

def create_client(project_dir: Path, model: str) -> ClaudeSDKClient:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    security_settings = {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                "Read(./**)", "Write(./**)", "Edit(./**)",
                "Glob(./**)", "Grep(./**)", "Bash(*)",
                *PUPPETEER_TOOLS,
            ],
        },
    }

    settings_file = project_dir / ".claude_settings.json"
    with open(settings_file, "w") as f:
        json.dump(security_settings, f, indent=2)

    return ClaudeSDKClient(
        options=ClaudeCodeOptions(
            model=model,
            system_prompt="You are an expert full-stack developer...",
            allowed_tools=[*BUILTIN_TOOLS, *PUPPETEER_TOOLS],
            mcp_servers={
                "puppeteer": {"command": "npx", "args": ["puppeteer-mcp-server"]}
            },
            hooks={
                "PreToolUse": [HookMatcher(matcher="Bash", hooks=[bash_security_hook])],
            },
            max_turns=1000,
            cwd=str(project_dir.resolve()),
            settings=str(settings_file.resolve()),
        )
    )
```

### coleam00 - client.py (OAuth Version)

```python
"""
Claude SDK Client Configuration (OAuth + Linear)
"""

import json
import os
from pathlib import Path

from claude_code_sdk import ClaudeCodeOptions, ClaudeSDKClient
from claude_code_sdk.types import HookMatcher

from security import bash_security_hook

PUPPETEER_TOOLS = [...]  # Same as official

LINEAR_TOOLS = [
    "mcp__linear__list_teams",
    "mcp__linear__create_project",
    "mcp__linear__create_issue",
    "mcp__linear__update_issue",
    "mcp__linear__create_comment",
    # ... more Linear tools
]

BUILTIN_TOOLS = ["Read", "Write", "Edit", "Glob", "Grep", "Bash"]

def create_client(project_dir: Path, model: str) -> ClaudeSDKClient:
    # OAuth token instead of API key
    api_key = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")
    if not api_key:
        raise ValueError(
            "CLAUDE_CODE_OAUTH_TOKEN not set.\n"
            "Run 'claude setup-token' after installing CLI."
        )

    linear_api_key = os.environ.get("LINEAR_API_KEY")
    if not linear_api_key:
        raise ValueError("LINEAR_API_KEY not set")

    security_settings = {
        "sandbox": {"enabled": True, "autoAllowBashIfSandboxed": True},
        "permissions": {
            "defaultMode": "acceptEdits",
            "allow": [
                "Read(./**)", "Write(./**)", "Edit(./**)",
                "Glob(./**)", "Grep(./**)", "Bash(*)",
                *PUPPETEER_TOOLS,
                *LINEAR_TOOLS,
            ],
        },
    }

    settings_file = project_dir / ".claude_settings.json"
    with open(settings_file, "w") as f:
        json.dump(security_settings, f, indent=2)

    return ClaudeSDKClient(
        options=ClaudeCodeOptions(
            model=model,
            system_prompt="You are an expert full-stack developer...",
            allowed_tools=[*BUILTIN_TOOLS, *PUPPETEER_TOOLS, *LINEAR_TOOLS],
            mcp_servers={
                "puppeteer": {"command": "npx", "args": ["puppeteer-mcp-server"]},
                "linear": {
                    "type": "http",
                    "url": "https://mcp.linear.app/mcp",
                    "headers": {"Authorization": f"Bearer {linear_api_key}"}
                }
            },
            hooks={
                "PreToolUse": [HookMatcher(matcher="Bash", hooks=[bash_security_hook])],
            },
            max_turns=1000,
            cwd=str(project_dir.resolve()),
            settings=str(settings_file.resolve()),
        )
    )
```

---

*Document generated: 2026-01-16*
*Investigation branch: branch-2*
