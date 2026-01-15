# Investigation: Permission Prompts for Ralph Loop Autonomous Operation

## Executive Summary

This investigation documents two primary approaches for enabling autonomous operation of the Ralph Loop system in Claude Code:

1. **Hooks + `--dangerously-skip-permissions`** - Use PreToolUse hooks for programmatic permission control
2. **Settings-based Permissions** - Configure `permissions.allow` rules in settings.json

**Recommended Approach**: Combine both methods - use settings.json for static allowlists and PreToolUse hooks for dynamic safety validation.

---

## Part 1: Hooks Capabilities

### Overview

Claude Code hooks are custom commands that run before/after tool executions. They're configured in settings files and provide programmatic control over permissions.

### Key Hook Events for Permission Control

| Hook Event | Purpose | Use Case |
|------------|---------|----------|
| `PreToolUse` | Runs before tool execution | Auto-approve, deny, or modify tool calls |
| `PermissionRequest` | Runs when permission dialog shown | Allow or deny on behalf of user |
| `PostToolUse` | Runs after tool execution | Validate results, trigger cleanup |

### PreToolUse Hook Decision Control

PreToolUse hooks can return JSON to control permissions:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow",  // "allow", "deny", or "ask"
    "permissionDecisionReason": "Auto-approved for Ralph Loop operation"
  }
}
```

**Decision Options**:
- `"allow"` - Bypasses permission system entirely, tool executes immediately
- `"deny"` - Prevents tool call, reason shown to Claude
- `"ask"` - Prompts user for confirmation (default behavior)

### PermissionRequest Hook Control

Similar to PreToolUse but runs when the user would see a permission dialog:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PermissionRequest",
    "decision": {
      "behavior": "allow",
      "updatedInput": { /* optional modifications */ }
    }
  }
}
```

### Hook Configuration Structure

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Edit|Write|Bash|Read",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/permission-validator.sh",
            "timeout": 30
          }
        ]
      }
    ]
  }
}
```

### Matchers for Tools

| Matcher | Description |
|---------|-------------|
| `Bash` | Shell commands |
| `Edit` | File editing |
| `Write` | File creation/overwriting |
| `Read` | File reading |
| `Glob` | File pattern matching |
| `Grep` | Content search |
| `WebFetch` | URL fetching |
| `Task` | Subagent operations |
| `mcp__*` | MCP server tools (e.g., `mcp__supabase__*`) |

### Hook Input Schema (PreToolUse)

Hooks receive JSON via stdin:

```json
{
  "session_id": "abc123",
  "transcript_path": "/path/to/transcript.jsonl",
  "cwd": "/project/directory",
  "permission_mode": "default",
  "hook_event_name": "PreToolUse",
  "tool_name": "Edit",
  "tool_input": {
    "file_path": "/path/to/file.js",
    "old_string": "...",
    "new_string": "..."
  },
  "tool_use_id": "toolu_01ABC123..."
}
```

---

## Part 2: Settings-Based Permission Configuration

### Permission Settings Structure

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run:*)",
      "Edit(/src/**)",
      "Read(~/.zshrc)"
    ],
    "ask": [
      "Bash(git push:*)"
    ],
    "deny": [
      "WebFetch",
      "Read(./.env)"
    ],
    "additionalDirectories": ["../docs/"],
    "defaultMode": "default"
  }
}
```

### Permission Modes

| Mode | Description | Ralph Loop Suitability |
|------|-------------|------------------------|
| `default` | Prompts for permission on first use | Not suitable - blocks automation |
| `acceptEdits` | Auto-accepts file edits for session | Partial - helps with edits only |
| `plan` | Read-only, no modifications | Not suitable |
| `dontAsk` | Auto-denies unless pre-approved | Suitable with proper allowlist |
| `bypassPermissions` | Skips ALL permission prompts | Suitable for trusted environments |

### Tool-Specific Permission Patterns

**Bash Commands**:
- `Bash(npm run build)` - Exact match
- `Bash(npm run test:*)` - Prefix match
- `Bash(git *)` - Wildcard match
- `Bash(* install)` - Suffix match

**File Operations**:
- `Edit(/src/**)` - Relative to settings file
- `Edit(src/**)` - Relative to current directory
- `Read(~/.config/*)` - Home directory
- `Read(//*.txt)` - Absolute path (note double slash)

**MCP Tools**:
- `mcp__supabase__*` - All Supabase tools
- `mcp__supabase__execute_sql` - Specific tool
- `mcp__firecrawl__*` - All Firecrawl tools

### Settings File Locations

| File | Scope | Precedence |
|------|-------|------------|
| `managed-settings.json` | System-wide (IT managed) | Highest |
| `~/.claude/settings.json` | User-level | Medium |
| `.claude/settings.json` | Project-level (shared) | Medium |
| `.claude/settings.local.json` | Project-local (not committed) | Medium-High |

---

## Part 3: Tools Required by Ralph Loop

### Core Operations

| Tool | Purpose | Permission Risk |
|------|---------|-----------------|
| `Read` | Read source files, configs | Low |
| `Edit` | Modify existing files | Medium |
| `Write` | Create new files | Medium |
| `Bash` | Run npm, git commands | High (depends on command) |
| `Glob` | Find files | Low |
| `Grep` | Search content | Low |
| `WebFetch` | Fetch documentation | Low |
| `Task` | Spawn subagents | Medium |

### MCP Tools (Project-Specific)

| Tool | Purpose | Permission Risk |
|------|---------|-----------------|
| `mcp__supabase__execute_sql` | Database queries | High |
| `mcp__supabase__list_tables` | Schema inspection | Low |
| `mcp__firecrawl__*` | Web scraping | Medium |
| `mcp__claude-in-chrome__*` | Browser automation | Medium |

### Bash Commands Needed

| Command Pattern | Purpose |
|-----------------|---------|
| `npm run *` | Build, test, dev scripts |
| `git *` | Version control |
| `ls`, `cat`, `pwd` | File system inspection |
| `node *` | Script execution |

---

## Part 4: Solution Comparison

### Option A: `--dangerously-skip-permissions` + Hooks

**How it works**:
1. Launch Claude with `claude --dangerously-skip-permissions "prompt"`
2. ALL permission prompts are bypassed
3. PreToolUse hooks provide safety guardrails

**Pros**:
- Complete automation - no prompts at all
- Hooks provide fine-grained control
- Can implement complex safety logic

**Cons**:
- "Dangerous" flag makes intent clear but risky
- Requires custom hook scripts
- Hook failures could leave system unprotected

**Implementation**:
```bash
# In /continue-ralph skill
claude --dangerously-skip-permissions "$(cat RALPH_PROMPT.md)"
```

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/validate-bash.sh"
          }
        ]
      }
    ]
  }
}
```

### Option B: Settings-Based Allowlist (`permissions.allow`)

**How it works**:
1. Configure explicit allow rules for known-safe operations
2. Set `defaultMode: "dontAsk"` to auto-deny unknown operations
3. Claude operates autonomously within allowed boundaries

**Pros**:
- Declarative configuration
- No custom code required
- Can be committed to repository
- Safer - only explicitly allowed operations proceed

**Cons**:
- Must anticipate all needed operations
- New operations require config updates
- Less flexible than hooks

**Implementation**:
```json
// .claude/settings.json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Edit(/UberEats-Image-Extractor/**)",
      "Edit(/.claude/**)",
      "Write(/UberEats-Image-Extractor/**)",
      "Write(/.claude/**)",
      "Bash(npm run:*)",
      "Bash(git status)",
      "Bash(git add:*)",
      "Bash(git commit:*)",
      "Bash(ls:*)",
      "Bash(pwd)",
      "Task",
      "WebFetch",
      "mcp__supabase__*",
      "mcp__firecrawl__*",
      "mcp__claude-in-chrome__*"
    ],
    "deny": [
      "Bash(rm -rf:*)",
      "Bash(sudo:*)",
      "Bash(curl:*)",
      "Read(.env)",
      "Read(.env.*)"
    ],
    "defaultMode": "dontAsk"
  }
}
```

### Option C: Hybrid Approach (RECOMMENDED)

**How it works**:
1. Use settings.json for static allowlist of common operations
2. Use `--dangerously-skip-permissions` when spawning Ralph sessions
3. Use PreToolUse hooks for dynamic validation of edge cases

**Pros**:
- Best of both worlds
- Static config handles 90% of cases
- Hooks handle complex/dynamic cases
- Multiple layers of safety

**Implementation**:

1. **Static allowlist** in `.claude/settings.local.json`:
```json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Edit",
      "Write",
      "Task",
      "WebFetch",
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(ls:*)",
      "Bash(pwd)",
      "Bash(node:*)",
      "mcp__supabase__*",
      "mcp__firecrawl__*",
      "mcp__claude-in-chrome__*"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(sudo:*)",
      "Read(.env)",
      "Read(.env.*)"
    ]
  }
}
```

2. **Launch script** in `/continue-ralph`:
```bash
claude --dangerously-skip-permissions "$(cat RALPH_PROMPT.md)"
```

3. **Safety hook** (optional, for additional validation):
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/ralph-bash-guard.sh"
          }
        ]
      }
    ]
  }
}
```

---

## Part 5: Implementation Guide

### Step 1: Create Settings Configuration

Create or update `.claude/settings.local.json`:

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Glob",
      "Grep",
      "Edit",
      "Write",
      "Task",
      "WebFetch",
      "Bash(npm:*)",
      "Bash(git:*)",
      "Bash(ls:*)",
      "Bash(pwd)",
      "Bash(cat:*)",
      "Bash(node:*)",
      "Bash(npx:*)",
      "mcp__supabase__*",
      "mcp__firecrawl__*",
      "mcp__claude-in-chrome__*"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(sudo:*)",
      "Bash(curl * | bash)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)"
    ]
  }
}
```

### Step 2: Update /continue-ralph Skill

Modify the spawn command to use `--dangerously-skip-permissions`:

```bash
# Before
claude "$(cat .claude/data/ralph-loops/city-breakdown-dashboard/RALPH_PROMPT.md)"

# After
claude --dangerously-skip-permissions "$(cat .claude/data/ralph-loops/city-breakdown-dashboard/RALPH_PROMPT.md)"
```

### Step 3: Create Safety Hook (Optional)

Create `.claude/hooks/ralph-bash-guard.sh`:

```bash
#!/bin/bash
# Ralph Loop Bash Safety Guard
# Blocks dangerous commands even in bypass mode

set -e

# Read input from stdin
INPUT=$(cat)

# Extract command
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0  # Not a Bash command, allow
fi

# Blocked patterns
BLOCKED_PATTERNS=(
  "^rm -rf /$"
  "^rm -rf /[^.]"
  "sudo "
  "chmod 777"
  "curl.*|.*bash"
  "wget.*|.*sh"
  "> /dev/sd"
  "mkfs"
  "dd if="
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo '{"decision": "block", "reason": "Command blocked by Ralph safety guard: '"$pattern"'"}' >&2
    exit 2
  fi
done

# Allow the command
exit 0
```

Make it executable:
```bash
chmod +x .claude/hooks/ralph-bash-guard.sh
```

### Step 4: Register Hook in Settings

Add to `.claude/settings.local.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "$CLAUDE_PROJECT_DIR/.claude/hooks/ralph-bash-guard.sh"
          }
        ]
      }
    ]
  }
}
```

### Step 5: Test Configuration

1. Start a new Claude session
2. Run `/permissions` to verify rules are loaded
3. Test allowed operations execute without prompts
4. Test denied operations are blocked

---

## Part 6: Security Considerations

### Risks of `--dangerously-skip-permissions`

1. **No human oversight** - All tool calls execute automatically
2. **Prompt injection** - Malicious instructions in web content could execute
3. **Cascading errors** - One bad operation can lead to many
4. **Data exposure** - Could accidentally read/send sensitive files

### Mitigation Strategies

1. **Use in isolated environments** - Container, VM, or separate user
2. **Implement file guards** - Deny rules for sensitive paths
3. **Command allowlists** - Only permit known-safe bash patterns
4. **Output monitoring** - Review logs after each iteration
5. **Automatic backups** - Git commits before each iteration

### Recommended Deny Rules for Safety

```json
{
  "permissions": {
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf /)",
      "Bash(sudo:*)",
      "Bash(:> /)",
      "Bash(chmod 777:*)",
      "Bash(curl * | *)",
      "Bash(wget * | *)",
      "Bash(eval:*)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Read(**/credentials*)",
      "Edit(.env)",
      "Edit(.env.*)",
      "Write(.env)",
      "Write(.env.*)"
    ]
  }
}
```

---

## Conclusion

For the Ralph Loop autonomous operation:

1. **Use `--dangerously-skip-permissions`** when spawning Ralph sessions
2. **Configure comprehensive allowlists** in `.claude/settings.local.json`
3. **Add deny rules** for dangerous operations and sensitive files
4. **Optionally implement PreToolUse hooks** for complex safety logic
5. **Run in controlled environment** with git backup before each iteration

This approach enables fully autonomous operation while maintaining reasonable safety guardrails.

---

## References

- [Claude Code Hooks Reference](https://code.claude.com/docs/en/hooks)
- [Claude Code Settings](https://code.claude.com/docs/en/settings)
- [Claude Code IAM](https://code.claude.com/docs/en/iam)
- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
