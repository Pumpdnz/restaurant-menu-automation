# Recommendations: Applying Anthropic's Long-Running Agent Patterns

## Overview

The Anthropic blog post "Effective harnesses for long-running agents" (Nov 2025) provides official guidance that directly validates and enhances our Ralph Loop implementation plan.

---

## Key Alignment with Our Plan

### 1. Two-Agent Architecture = Our Layer 1 + Layer 3

| Anthropic Pattern | Our Pattern | Alignment |
|-------------------|-------------|-----------|
| **Initializer Agent** | Layer 1: Planning Session + `/plan-ralph-loop` | ✅ Identical concept |
| **Coding Agent** | Layer 3: Worker Sessions | ✅ Identical concept |

**Recommendation:** Our architecture is validated. The initializer/coding split is proven effective.

### 2. Feature List in JSON = Our Task Schema

Anthropic uses this exact JSON structure:
```json
{
    "category": "functional",
    "description": "New chat button creates a fresh conversation",
    "steps": [
      "Navigate to main interface",
      "Click the 'New Chat' button",
      "Verify a new conversation is created",
      "Check that chat area shows welcome state",
      "Verify conversation appears in sidebar"
    ],
    "passes": false
}
```

**Recommendation:** Adopt this schema exactly in our `feature_list.json` template. Key insights:
- Use JSON not Markdown (Claude is less likely to inappropriately modify JSON)
- Include `steps` array for verification procedures
- Use `passes: boolean` not status strings
- Strongly word instructions: "It is unacceptable to remove or edit tests"

### 3. Progress File = Our progress.txt

Anthropic uses `claude-progress.txt` for the same purpose as our `progress.txt`.

**Recommendation:** Keep our progress.txt approach, but ensure it includes:
- Git commit references
- Per-iteration summaries
- Clear handoff instructions

### 4. Browser Automation for Testing

Anthropic validates browser testing: "Claude mostly did well at verifying features end-to-end once explicitly prompted to use browser automation tools."

They used Puppeteer MCP. We're using Claude for Chrome MCP.

**Recommendation:** Our approach is validated. Ensure explicit prompting for browser verification:
- "Test as a human user would"
- Run basic E2E test BEFORE implementing new features
- Screenshot capture for verification evidence

### 5. init.sh Script Pattern

Anthropic recommends an `init.sh` script for environment setup.

**Recommendation:** Add `init.sh` to our template structure:
```bash
#!/bin/bash
# init.sh - Environment setup for Ralph Loop

# Start development server
cd UberEats-Image-Extractor && npm run dev &

# Wait for server
sleep 5

# Run basic E2E test
echo "Server started on port $PORT"
```

---

## Critical Insights to Incorporate

### 1. "One Feature at a Time" is Critical

> "This incremental approach turned out to be critical to addressing the agent's tendency to do too much at once."

**Update to our RALPH_PROMPT.md template:**
```markdown
## CRITICAL: One Feature Per Iteration

Work on EXACTLY ONE feature per iteration. Do not:
- Attempt to implement multiple features
- "While I'm here" additional changes
- Premature optimization

After completing ONE feature:
1. Verify it works
2. Commit with descriptive message
3. Update progress
4. Exit iteration
```

### 2. "Clean State" After Each Session

> "By 'clean state' we mean the kind of code that would be appropriate for merging to a main branch"

**Update iteration exit procedure:**
```markdown
## Before Ending This Iteration

1. Ensure no half-implemented code remains
2. All changes are committed with descriptive messages
3. No major bugs introduced
4. Code is orderly and documented
5. Next session can immediately start on next feature
```

### 3. "Run Basic E2E Test BEFORE New Work"

> "This ensured that Claude could quickly identify if the app had been left in a broken state, and immediately fix any existing bugs."

**Update session start procedure:**
```markdown
## Session Start Procedure

1. pwd - confirm working directory
2. Read progress.txt
3. Read feature_list.json
4. git log --oneline -20
5. Run init.sh to start server
6. **CRITICAL: Run basic E2E test BEFORE any new work**
   - If test fails, FIX IT FIRST
   - Do not proceed to new features with broken baseline
7. Choose highest-priority failing feature
8. Begin implementation
```

### 4. JSON Over Markdown for Feature Lists

> "After some experimentation, we landed on using JSON for this, as the model is less likely to inappropriately change or overwrite JSON files compared to Markdown files."

**Update our template:**
- Rename `COMPLETION_CRITERIA.md` → `feature_list.json`
- Use structured JSON with the Anthropic schema
- Add strong instructions against modification

---

## Updated File Structure

Based on Anthropic's patterns:

```
ralph-loops/{task-name}/
├── RALPH_PROMPT.md          # Full task definition (existing)
├── feature_list.json        # JSON feature list (UPDATED)
├── progress.txt             # Progress tracking (existing)
├── init.sh                  # Environment setup (NEW)
└── test-config.md           # Testing method config (existing)
```

### feature_list.json Template

```json
{
  "task_name": "{TASK_NAME}",
  "created": "{TIMESTAMP}",
  "total_features": 0,
  "completed_features": 0,
  "features": [
    {
      "id": 1,
      "category": "functional",
      "priority": "high",
      "description": "Feature description here",
      "steps": [
        "Step 1 for verification",
        "Step 2 for verification",
        "Step 3 for verification"
      ],
      "passes": false,
      "completed_iteration": null,
      "notes": ""
    }
  ]
}
```

---

## Failure Modes to Guard Against

From Anthropic's table:

| Problem | Our Mitigation |
|---------|----------------|
| Declares victory too early | JSON feature list with explicit `passes` boolean |
| Leaves environment buggy | Git commits + basic E2E test at session start |
| Marks features done prematurely | Browser verification + "test as human would" |
| Spends time figuring out setup | init.sh script + documented procedures |

---

## Open Question Raised by Anthropic

> "It's still unclear whether a single, general-purpose coding agent performs best across contexts, or if better performance can be achieved through a multi-agent architecture."

This is exactly what our Phase 3 multi-layer system aims to explore.

**Recommendation:** After Phase 1 validation, consider:
- Testing agent (specialized for verification)
- Cleanup agent (specialized for code quality)
- QA agent (specialized for edge cases)

---

## Summary of Changes to Roadmap

### Phase 1 Updates

1. **Add init.sh to templates** - Environment setup script
2. **Use JSON for feature list** - Replace markdown criteria with `feature_list.json`
3. **Adopt Anthropic's JSON schema** - `category`, `description`, `steps`, `passes`
4. **Update session start procedure** - Always run basic E2E test first
5. **Enforce "one feature per iteration"** - Explicit in prompt
6. **Require "clean state" on exit** - No half-implemented code

### New Template Files to Create

1. `feature_list.json.template` - Anthropic schema
2. `init.sh.template` - Environment setup
3. Updated `RALPH_PROMPT.md.template` - With new procedures

---

## Confidence Assessment

| Aspect | Confidence | Reason |
|--------|------------|--------|
| Two-agent architecture | ✅ High | Anthropic validated |
| JSON feature list | ✅ High | Anthropic explicitly recommends |
| Browser verification | ✅ High | Anthropic used similar approach |
| Fresh sessions per iteration | ⚠️ Medium | Anthropic uses compaction but acknowledges issues |
| Parallel worktrees | ❓ Unknown | Anthropic doesn't address parallelization |

The parallel worktree approach remains our innovation beyond Anthropic's published patterns.
