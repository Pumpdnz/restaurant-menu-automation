# Investigation: Model Routing for Ralph Loop

## Overview

This investigation examines how to implement per-feature model selection in the Ralph Loop workflow to optimize iteration speed. Browser testing tasks can use faster models (Sonnet/Haiku) instead of Opus, significantly reducing iteration time.

---

## CLI Model Selection Options

Based on the [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference), the following model selection mechanisms are available:

### Primary Flag: `--model`

```bash
claude --model sonnet "your prompt"
claude --model opus "your prompt"
claude --model haiku "your prompt"
```

**Supported Values:**
| Value | Description |
|-------|-------------|
| `sonnet` | Alias for latest Sonnet model (fast, cost-effective) |
| `opus` | Alias for latest Opus model (most capable, slowest) |
| `haiku` | Alias for latest Haiku model (fastest, least expensive) |
| Full model ID | e.g., `claude-sonnet-4-5-20250929` for specific version |

### Fallback Model: `--fallback-model`

For print mode (`-p`) only, enables automatic fallback when primary model is overloaded:

```bash
claude -p --fallback-model sonnet "query"
```

### Subagent Model Selection

The `--agents` flag supports per-subagent model specification:

```json
{
  "browser-tester": {
    "description": "Browser verification specialist",
    "prompt": "You verify UI features in the browser",
    "tools": ["Read", "Bash"],
    "model": "sonnet"
  }
}
```

---

## Task-to-Model Mapping Recommendations

Based on analysis of Ralph Loop workflow phases:

### Task Categories

| Category | Recommended Model | Rationale |
|----------|------------------|-----------|
| **Implementation** | `opus` | Complex reasoning, architecture decisions, code generation |
| **Browser Verification** | `sonnet` | Visual checks, click sequences, simple validation |
| **File Updates** | `haiku` | Updating JSON/txt files, simple edits |
| **Bug Fixes** | `opus` | Debugging requires deep analysis |
| **Refactoring** | `opus` | Understanding codebase patterns |

### Feature Category Mapping

| Feature Category (feature_list.json) | Default Model |
|-------------------------------------|---------------|
| `setup` | `opus` |
| `functional` | `opus` |
| `ui` | `sonnet` |
| `verification` | `sonnet` |
| `documentation` | `haiku` |
| `testing` | `sonnet` |

### Complexity-Based Override

For features with explicit complexity indicators:

| Priority | Model Override |
|----------|---------------|
| `high` + complex steps | `opus` |
| `medium` | Use category default |
| `low` + simple steps | `haiku` |

---

## Schema Changes for feature_list.json

### Proposed Schema Addition

Add `model` field to each feature object:

```json
{
  "task_name": "city-breakdown-dashboard",
  "created": "2026-01-15",
  "total_features": 9,
  "completed_features": 0,
  "default_model": "opus",
  "instructions": "CRITICAL: Only modify the 'passes' field...",
  "features": [
    {
      "id": 1,
      "category": "setup",
      "priority": "high",
      "model": "opus",
      "description": "Add dialog state management to Dashboard",
      "steps": [...],
      "passes": false,
      "completed_iteration": null,
      "notes": ""
    },
    {
      "id": 9,
      "category": "ui",
      "priority": "medium",
      "model": "sonnet",
      "description": "Table styling matches existing Dashboard card patterns",
      "steps": [
        "Step 1: Navigate to Dashboard",
        "Step 2: Compare city breakdown card with existing Recent Restaurants card",
        "Step 3: Verify backdrop-blur-sm bg-background/95 border-border styling"
      ],
      "passes": false,
      "completed_iteration": null,
      "notes": ""
    }
  ]
}
```

### Schema Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `model` | string | No | One of: `opus`, `sonnet`, `haiku` |
| `default_model` | string | No | Task-level default if feature model not specified |

### Backward Compatibility

- If `model` field is missing, use `default_model` from task level
- If `default_model` is missing, default to `opus` (current behavior)

---

## Implementation Plan for /continue-ralph Updates

### Phase 1: Update Shell Script

Modify `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/skills/continue-ralph/scripts/open-split-ralph.sh`:

```bash
#!/bin/bash
# open-split-ralph.sh
# Opens a split terminal in Cursor and starts Claude with model selection

RALPH_LOOP_PATH="$1"
PROMPT_FILE="$RALPH_LOOP_PATH/RALPH_PROMPT.md"
FEATURE_LIST="$RALPH_LOOP_PATH/feature_list.json"

# Verify files exist
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: RALPH_PROMPT.md not found at: $PROMPT_FILE"
    exit 1
fi

# Determine model for next feature
MODEL="opus"  # Default
if [ -f "$FEATURE_LIST" ]; then
    # Get first incomplete feature's model
    NEXT_MODEL=$(jq -r '
      (.features[] | select(.passes == false) | .model) //
      .default_model //
      "opus"
    ' "$FEATURE_LIST" | head -1)

    if [ -n "$NEXT_MODEL" ] && [ "$NEXT_MODEL" != "null" ]; then
        MODEL="$NEXT_MODEL"
    fi
fi

echo "Selected model: $MODEL for next feature"

# Use AppleScript to spawn session with model flag
osascript <<EOF
tell application "Cursor"
    activate
end tell

delay 0.3

tell application "System Events"
    tell process "Cursor"
        key code 42 using {command down}
    end tell
end tell

delay 0.5

tell application "System Events"
    keystroke "claude --model $MODEL \"\$(cat $PROMPT_FILE)\""
    delay 0.1
    key code 36
end tell
EOF

echo "Ralph Loop session started with model: $MODEL"
```

### Phase 2: Update SKILL.md

Add model selection documentation to `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/skills/continue-ralph/SKILL.md`:

```markdown
## Model Selection

The script automatically selects the appropriate model based on `feature_list.json`:

1. Reads next incomplete feature (`passes: false`)
2. Uses feature's `model` field if specified
3. Falls back to task's `default_model` if present
4. Defaults to `opus` if neither specified

### Manual Override

To force a specific model:
```bash
claude --model sonnet "$(cat $RALPH_LOOP_PATH/RALPH_PROMPT.md)"
```
```

### Phase 3: Update Template

Modify `/Users/giannimunro/Desktop/cursor-projects/automation/.claude/skills/plan-ralph-loop/templates/feature_list.json.template`:

```json
{
  "task_name": "{TASK_NAME}",
  "created": "{TIMESTAMP}",
  "total_features": 0,
  "completed_features": 0,
  "default_model": "opus",
  "instructions": "CRITICAL: Only modify the 'passes' field...",
  "features": [
    {
      "id": 1,
      "category": "functional",
      "priority": "high",
      "model": null,
      "description": "Feature description here",
      "steps": [...],
      "passes": false,
      "completed_iteration": null,
      "notes": ""
    }
  ]
}
```

---

## Alternative: Specialized Browser Testing Subagent

### Approach

Instead of per-feature model switching, create a dedicated browser testing subagent that uses Sonnet by default.

### Implementation

Add to project's agents configuration:

```json
{
  "ralph-browser-verifier": {
    "description": "Browser verification specialist for Ralph Loop. Use for UI testing, visual checks, and interaction verification.",
    "prompt": "You are a browser testing agent for Ralph Loop iterations. Your role is to verify UI features work correctly using Claude in Chrome. Focus on: 1) Visual verification 2) User interaction testing 3) Error state checking. Report pass/fail status clearly.",
    "tools": ["Read", "Bash", "mcp__claude-in-chrome__computer", "mcp__claude-in-chrome__read_page"],
    "model": "sonnet"
  }
}
```

### Tradeoffs

| Factor | Per-Feature Model | Specialized Subagent |
|--------|-------------------|---------------------|
| **Complexity** | Low - just flag | Medium - agent definition |
| **Flexibility** | High - any model per feature | Low - fixed to Sonnet |
| **Maintenance** | Update feature_list.json | Update agent prompt |
| **Context Switching** | None - same session | Requires Task tool delegation |
| **Speed Gain** | Direct - immediate | Indirect - via delegation |

### Recommendation

**Use per-feature model selection** (inline model switching) because:
1. Simpler implementation - single `--model` flag
2. No context loss from Task tool delegation
3. More flexible - can tune per-feature
4. Maintains current Ralph Loop flow
5. No additional agent prompt maintenance

The specialized subagent approach is better suited for:
- Dedicated browser automation projects
- When browser testing requires specialized prompting
- Multi-agent architectures beyond Ralph Loop

---

## Speed Impact Estimates

Based on typical model response times:

| Model | Relative Speed | Cost Factor | Best For |
|-------|---------------|-------------|----------|
| `haiku` | ~10x faster than Opus | ~0.04x | Simple file updates |
| `sonnet` | ~3x faster than Opus | ~0.2x | Browser verification |
| `opus` | Baseline | 1x | Complex implementation |

### Projected Savings

For a 9-feature Ralph Loop like `city-breakdown-dashboard`:

| Current (all Opus) | Optimized (mixed models) |
|-------------------|-------------------------|
| 9 x Opus iterations | 4 Opus + 4 Sonnet + 1 Haiku |
| ~45 min total | ~25 min total |
| ~45% time savings | |

---

## Implementation Checklist

- [ ] Add `jq` dependency check to init.sh (for JSON parsing)
- [ ] Update open-split-ralph.sh with model selection logic
- [ ] Update feature_list.json.template with model fields
- [ ] Update SKILL.md documentation
- [ ] Add model recommendation guidance to plan-ralph-loop skill
- [ ] Test with existing city-breakdown-dashboard loop

---

## References

- [Claude Code CLI Reference](https://code.claude.com/docs/en/cli-reference)
- [Subagents Documentation](https://code.claude.com/docs/en/sub-agents)
- [Ralph Loop Phase 1 Issues](./PHASE_1_CURRENT_ISSUES.md)
