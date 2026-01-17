# Claude Agent SDK OAuth Investigation Report

**Investigation Date:** 2026-01-16
**Investigator:** Branch-2 Investigation Agent

---

## Executive Summary

**Does the Claude Agent SDK support OAuth tokens for Max Plan users?**

**NO** - The Claude Agent SDK does NOT support OAuth tokens. It uses **API key authentication only** (via `ANTHROPIC_API_KEY`) or cloud provider authentication (AWS Bedrock, Google Vertex AI, Azure AI Foundry).

### Key Findings

1. **No OAuth Support**: The SDK explicitly states that third-party developers are NOT allowed to offer claude.ai login or rate limits for their products
2. **API Key Only**: Authentication is via `ANTHROPIC_API_KEY` environment variable or cloud provider credentials
3. **No `CLAUDE_CODE_OAUTH_TOKEN`**: This environment variable is NOT mentioned in any SDK documentation
4. **MCP Support**: The SDK DOES support custom MCP servers, including potentially Claude in Chrome

---

## 1. SDK Naming Clarification

### Timeline of Renames

| Date | Old Name | New Name |
|------|----------|----------|
| Pre-2025 | `claude-code-sdk` | - |
| 2025 (SDK v0.1.0) | `claude-code-sdk` | `claude-agent-sdk` |

### Package Names

| Language | Old Package | New Package |
|----------|-------------|-------------|
| TypeScript/JavaScript | `@anthropic-ai/claude-code` | `@anthropic-ai/claude-agent-sdk` |
| Python | `claude-code-sdk` | `claude-agent-sdk` |

### Why the Rename?

The Claude Code SDK evolved beyond coding tasks into a framework for building all types of AI agents. The new name "Claude Agent SDK" better reflects capabilities like:
- Business agents (legal assistants, finance advisors, customer support)
- Specialized coding agents (SRE bots, security reviewers)
- Custom domain agents with tool use and MCP integration

---

## 2. Authentication Methods

### Supported Authentication Methods

| Method | Environment Variable | Description |
|--------|---------------------|-------------|
| **Anthropic API Key** | `ANTHROPIC_API_KEY` | Primary authentication method |
| **Amazon Bedrock** | `CLAUDE_CODE_USE_BEDROCK=1` | Plus AWS credentials |
| **Google Vertex AI** | `CLAUDE_CODE_USE_VERTEX=1` | Plus Google Cloud credentials |
| **Microsoft Azure AI Foundry** | `CLAUDE_CODE_USE_FOUNDRY=1` | Plus Azure credentials |

### Critical Notice from Documentation

> "Unless previously approved, we do not allow third party developers to offer Claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK. Please use the API key authentication methods described in this document instead."

This explicitly prohibits OAuth-based authentication using Claude.ai accounts.

### Code Examples

**TypeScript:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

// Set environment variable before running:
// export ANTHROPIC_API_KEY=your-api-key

for await (const message of query({
  prompt: "What files are in this directory?",
  options: { allowedTools: ["Bash", "Glob"] },
})) {
  if ("result" in message) console.log(message.result);
}
```

**Python:**
```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

# Set environment variable before running:
# export ANTHROPIC_API_KEY=your-api-key

async def main():
    async for message in query(
        prompt="What files are in this directory?",
        options=ClaudeAgentOptions(allowed_tools=["Bash", "Glob"])
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

---

## 3. Python vs TypeScript Comparison

### Feature Parity

| Feature | Python SDK | TypeScript SDK |
|---------|------------|----------------|
| `query()` function | Yes | Yes |
| `ClaudeSDKClient` class | Yes | No (use query with streaming input) |
| Sessions | Yes | Yes |
| MCP Servers | Yes | Yes |
| Custom Tools | Yes | Yes |
| Hooks | Yes | Yes |
| Subagents | Yes | Yes |
| OAuth Support | **NO** | **NO** |
| V2 Interface Preview | No | Yes |

### TypeScript V2 Preview

The TypeScript SDK has a new V2 interface (unstable preview) with simplified patterns:
- `unstable_v2_createSession()` / `unstable_v2_resumeSession()`
- `session.send()` / `session.stream()`
- No async generators required

**Still NO OAuth support in V2.**

---

## 4. MCP Tool Access

### Can SDK Sessions Access Claude in Chrome MCP Tools?

**YES** - The SDK supports MCP servers, including custom ones like Claude in Chrome.

### MCP Server Configuration Example

**TypeScript:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Open example.com and describe what you see",
  options: {
    mcpServers: {
      playwright: { command: "npx", args: ["@playwright/mcp@latest"] }
    }
  }
})) {
  if ("result" in message) console.log(message.result);
}
```

**Python:**
```python
import asyncio
from claude_agent_sdk import query, ClaudeAgentOptions

async def main():
    async for message in query(
        prompt="Open example.com and describe what you see",
        options=ClaudeAgentOptions(
            mcp_servers={
                "playwright": {"command": "npx", "args": ["@playwright/mcp@latest"]}
            }
        )
    ):
        if hasattr(message, "result"):
            print(message.result)

asyncio.run(main())
```

### Supported MCP Server Types

1. **Stdio** - Command-line based servers
2. **SSE** - Server-Sent Events over HTTP
3. **HTTP** - REST-based servers
4. **SDK** - In-process servers created with `createSdkMcpServer()`

### Claude in Chrome Integration

To use Claude in Chrome MCP tools:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Navigate to google.com and take a screenshot",
  options: {
    mcpServers: {
      "claude-in-chrome": {
        type: "http",  // or appropriate type
        url: "http://localhost:YOUR_PORT",
        headers: { /* auth headers if needed */ }
      }
    }
  }
})) {
  console.log(message);
}
```

---

## 5. Critical Questions Answered

### Q1: Can `CLAUDE_CODE_OAUTH_TOKEN` be used with the current Agent SDK?

**NO.** This environment variable is NOT documented anywhere in the Agent SDK documentation. The SDK uses `ANTHROPIC_API_KEY` for authentication.

### Q2: Is there a TypeScript equivalent for OAuth?

**NO.** Neither Python nor TypeScript SDK support OAuth tokens. Both use the same authentication methods:
- `ANTHROPIC_API_KEY`
- Cloud provider credentials (Bedrock, Vertex, Foundry)

### Q3: Does the SDK support custom MCP servers like Claude in Chrome?

**YES.** The SDK has full MCP support including:
- Custom MCP server configuration
- Multiple transport types (stdio, SSE, HTTP, SDK)
- Tool permissions and hooks for MCP tools

### Q4: What's the migration path from deprecated claude-code-sdk?

1. **Uninstall old package:**
   - TypeScript: `npm uninstall @anthropic-ai/claude-code`
   - Python: `pip uninstall claude-code-sdk`

2. **Install new package:**
   - TypeScript: `npm install @anthropic-ai/claude-agent-sdk`
   - Python: `pip install claude-agent-sdk`

3. **Update imports:**
   - TypeScript: `@anthropic-ai/claude-code` -> `@anthropic-ai/claude-agent-sdk`
   - Python: `claude_code_sdk` -> `claude_agent_sdk`

4. **Update type names (Python only):**
   - `ClaudeCodeOptions` -> `ClaudeAgentOptions`

---

## 6. Recommendation for Ralph Loop

### Should Ralph Loop Use the Agent SDK?

**Yes, but with API key authentication, not OAuth.**

### Recommended Approach

1. **Use API Key Authentication:**
   ```bash
   export ANTHROPIC_API_KEY=your-api-key-here
   ```

2. **For MCP Integration (Claude in Chrome):**
   Configure as an MCP server in the SDK options.

3. **For Multi-Turn Conversations:**
   Use sessions with resume capability for Ralph Loop iterations.

### Alternative: Claude CLI

If OAuth/Max Plan authentication is required, consider using the Claude CLI directly instead of the SDK:
```bash
claude --print-session-id "Your prompt here"
```

The CLI supports OAuth authentication when logged in via `claude login`.

---

## 7. Source Documentation Links

1. **Migration Guide:** https://platform.claude.com/docs/en/agent-sdk/migration-guide
2. **Agent SDK Overview:** https://platform.claude.com/docs/en/agent-sdk/overview
3. **Quickstart:** https://platform.claude.com/docs/en/agent-sdk/quickstart
4. **Python SDK Reference:** https://platform.claude.com/docs/en/agent-sdk/python
5. **TypeScript SDK Reference:** https://platform.claude.com/docs/en/agent-sdk/typescript
6. **TypeScript V2 Preview:** https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview

---

## Appendix: Breaking Changes in v0.1.0

### System Prompt Change
- **Before:** Used Claude Code's system prompt by default
- **After:** Uses minimal system prompt by default
- **Fix:** Use `systemPrompt: { type: "preset", preset: "claude_code" }`

### Settings Sources Change
- **Before:** Loaded filesystem settings automatically
- **After:** No settings loaded by default
- **Fix:** Use `settingSources: ["user", "project", "local"]`

### Python Type Rename
- **Before:** `ClaudeCodeOptions`
- **After:** `ClaudeAgentOptions`

---

## Conclusion

The Claude Agent SDK is a powerful tool for building AI agents, but it does **NOT** support OAuth authentication for Max Plan users. The SDK is designed for API key authentication only, with Anthropic explicitly prohibiting third-party OAuth implementations.

For Ralph Loop workflows that require Max Plan/OAuth authentication, consider:
1. Using the Claude CLI directly (supports OAuth)
2. Implementing a hybrid approach: CLI for auth, SDK for tool execution
3. Using API key authentication with the SDK (requires API credits)
