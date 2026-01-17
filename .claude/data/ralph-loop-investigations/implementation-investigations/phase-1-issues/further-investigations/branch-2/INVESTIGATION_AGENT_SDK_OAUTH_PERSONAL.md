# Claude Agent SDK OAuth Personal Use Investigation Report

**Investigation Date:** 2026-01-16
**Investigator:** Clarification Investigation Agent
**Purpose:** Clarify whether OAuth tokens can be used for PERSONAL automation (not third-party products)

---

## ANSWER: YES - OAuth Tokens CAN Be Used for Personal Automation

**The previous investigation was incorrect.** The SDK DOES support `CLAUDE_CODE_OAUTH_TOKEN` for personal use with Max/Pro subscriptions.

### Critical Distinction

The documentation statement that was misinterpreted:

> "Unless previously approved, we do not allow third party developers to offer Claude.ai login or rate limits for their products"

This means:
- **BLOCKED:** Building an app where OTHER users log in with their Claude accounts
- **ALLOWED:** Using YOUR OWN Max/Pro token for YOUR OWN automation scripts

---

## Evidence Supporting OAuth Token Usage

### 1. coleam00's PR Migration (commit a5dd510)

The PR simply migrated from `claude-code-sdk` to `claude-agent-sdk`:
- Changed import from `claude_code_sdk` to `claude_agent_sdk`
- Changed `ClaudeCodeOptions` to `ClaudeAgentOptions`
- **No changes to authentication method** - the underlying auth mechanism remains the same

The migration commit does NOT show any removal of OAuth support - it's a package rename, not an authentication change.

### 2. GitHub Issue #11 on claude-agent-sdk-typescript

**Confirmed working as of December 2025:**

> "@jordanholliday commented on Oct 7, 2025:
> Set env var `CLAUDE_CODE_OAUTH_TOKEN` rather than `ANTHROPIC_API_KEY`.
> This is working for me on `0.1.8`."

> "@callmephilip commented on Dec 4, 2025:
> `CLAUDE_CODE_OAUTH_TOKEN` still works on `0.1.58`. to get the token, run:
> `claude setup-token`"

### 3. weidwonder's claude_agent_sdk_oauth_demo Repository

A working demo repository explicitly titled "Claude agent sdk CAN ACCESS BY CLAUDE Pro ACCOUNT NOW!" with:

**Setup instructions:**
```bash
# 1. Install Claude CLI (if not already installed)
npm install -g @anthropic-ai/claude-code

# 2. Get OAuth Token
claude setup-token

# 3. Copy the generated token and add to .env file
CLAUDE_CODE_OAUTH_TOKEN=your-oauth-token-here
```

**Environment variables supported:**
| Variable | Description | Required |
|----------|-------------|----------|
| `CLAUDE_CODE_OAUTH_TOKEN` | OAuth Token (from `claude setup-token`) | Either/Or |
| `ANTHROPIC_API_KEY` | API Key (from Anthropic Console) | Either/Or |

### 4. Unofficial Go SDK (schlunsen/claude-agent-sdk-go)

The community Go SDK explicitly documents OAuth support:

> **Authentication** (choose one method):
> - **API Key** (Pay-as-you-go): Set `CLAUDE_API_KEY` environment variable
> - **OAuth Token** (Max subscription): Set `CLAUDE_CODE_OAUTH_TOKEN` environment variable

**Setup instructions from Go SDK:**
```bash
# Setup OAuth token with Claude Code CLI:
claude setup-token

# Export the token to your environment:
export CLAUDE_CODE_OAUTH_TOKEN=your-oauth-token-here
```

### 5. Python SDK Works with Local Claude Binary

From GitHub Issue #11:

> "@niels-hop commented on Oct 25, 2025:
> I can confirm the Python SDK works perfectly with Pro/Max subscriptions. The key difference is in how each SDK finds the Claude Code executable:
>
> The Python SDK automatically searches for a locally installed `claude` binary, which already has access to your stored Pro/Max credentials."

**This means:** If you've run `claude login`, the Python SDK can use those stored credentials automatically.

---

## How to Use OAuth Token with Agent SDK

### Method A: Explicit OAuth Token (TypeScript/Python)

```bash
# 1. Get your OAuth token
claude setup-token
# This opens browser for authentication and outputs token

# 2. Set the environment variable
export CLAUDE_CODE_OAUTH_TOKEN=your-token-here

# 3. Run your SDK code - DO NOT set ANTHROPIC_API_KEY
```

### Method B: Use Stored Credentials (Python SDK)

```bash
# 1. Login to Claude Code once
claude login

# 2. The Python SDK will automatically use stored credentials
# No environment variable needed - it finds the local claude binary
```

### Method C: Generate Long-Lived Token

```bash
# Generate a long-lived token for automation
claude setup-token

# This outputs a token that can be used in CI/CD or automation scripts
```

---

## Answers to Specific Questions

### Q1: Does the SDK automatically use credentials from `claude login`?

**YES** - The Python SDK automatically searches for a locally installed `claude` binary which has access to stored Pro/Max credentials. The TypeScript SDK requires explicit `CLAUDE_CODE_OAUTH_TOKEN` environment variable.

### Q2: Can we set `CLAUDE_CODE_OAUTH_TOKEN` for personal automation?

**YES** - This is confirmed working as of version 0.1.58 (December 2025). The environment variable is supported for personal use.

### Q3: What authentication method does coleam00's migrated code use?

The migration PR only changed package names (claude-code-sdk to claude-agent-sdk). The authentication method was not changed - it continues to support both:
- `ANTHROPIC_API_KEY` for API billing
- `CLAUDE_CODE_OAUTH_TOKEN` for Max/Pro subscription usage

### Q4: Is there a difference between "third-party OAuth" (blocked) and "personal OAuth token" (allowed)?

**YES, critical distinction:**

| Usage Type | Allowed? | Description |
|------------|----------|-------------|
| Third-party OAuth | NO | Building apps where OTHER users authenticate with their Claude accounts |
| Personal OAuth Token | YES | Using YOUR OWN Max/Pro token for YOUR OWN automation |

The documentation warning about "third party developers" refers to:
- Building products for distribution
- Allowing end users to log in with their Claude.ai accounts
- Sharing rate limits across multiple users

It does NOT prohibit:
- Personal automation scripts
- Internal tooling using your own subscription
- CI/CD pipelines with your own token

---

## Recommendation for Ralph Loop

### Use OAuth Token for Personal Automation

```python
# Python example for Ralph Loop
import asyncio
import os
from claude_agent_sdk import query, ClaudeAgentOptions

# Set OAuth token (or rely on stored credentials from claude login)
# os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = "your-token-here"

async def ralph_loop_iteration(prompt: str):
    async for message in query(
        prompt=prompt,
        options=ClaudeAgentOptions(
            allowed_tools=["Read", "Edit", "Bash", "Glob", "Grep"],
            mcp_servers={
                "claude-in-chrome": {
                    "type": "http",
                    "url": "http://localhost:YOUR_PORT"
                }
            }
        )
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(ralph_loop_iteration("Continue the Ralph Loop task"))
```

### Alternative: Use Claude CLI with Stored Auth

```bash
# After running claude login once, use CLI directly
claude --print "Continue the Ralph Loop task" --session-id $SESSION_ID
```

---

## Sources

1. **GitHub Issue - Claude Max Usage:** https://github.com/anthropics/claude-agent-sdk-typescript/issues/11
2. **OAuth Demo Repository:** https://github.com/weidwonder/claude_agent_sdk_oauth_demo
3. **Go SDK Documentation:** https://pkg.go.dev/github.com/schlunsen/claude-agent-sdk-go
4. **coleam00 Migration PR:** https://github.com/coleam00/Linear-Coding-Agent-Harness/pull/4/commits/a5dd510bb53485e047eb68976d95cb650719e53f
5. **Claude Code Action Setup:** https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md

---

## Conclusion

**YES - You CAN use your own OAuth token with the Agent SDK for personal automation.**

The previous investigation incorrectly interpreted the documentation. The prohibition on "third-party OAuth" refers to building products where OTHER users authenticate with their accounts, NOT to using your own Max/Pro subscription token for personal automation scripts.

**Recommended approach:**
1. Run `claude setup-token` to get your OAuth token
2. Set `CLAUDE_CODE_OAUTH_TOKEN` environment variable
3. Use the Agent SDK without setting `ANTHROPIC_API_KEY`
4. Your Max/Pro subscription will be used for all requests
