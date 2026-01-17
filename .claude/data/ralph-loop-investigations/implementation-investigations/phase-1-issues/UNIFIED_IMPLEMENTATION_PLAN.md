# Ralph Loop v2.0 - Unified Implementation Plan

**Created:** 2025-01-16
**Status:** Ready for Implementation
**Estimated Effort:** 14-17 hours
**Contributors:** Branch-1, Branch-2, Branch-3 (via debate process)

---

## Executive Summary

This document provides the complete implementation plan for fixing the three Phase 1 blocking issues in Ralph Loop:

| Issue | Problem | Solution |
|-------|---------|----------|
| Permission Prompts | Every tool call requires approval | `--dangerously-skip-permissions` + PreToolUse hooks |
| Session Spawn Reliability | AppleScript has ~90% success rate | Bash loop with CLI spawning (~99% reliable) |
| Model Speed | All sessions use Opus | Per-feature model selection from `feature_list.json` |

**Architecture Decision:** CLI-based orchestration (SDK rejected due to Claude in Chrome incompatibility)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Component Implementation](#3-component-implementation)
4. [Code Skeletons](#4-code-skeletons)
5. [Configuration Files](#5-configuration-files)
6. [Test Cases](#6-test-cases)
7. [Rollout Checklist](#7-rollout-checklist)
8. [Troubleshooting Guide](#8-troubleshooting-guide)

---

## 1. Architecture Overview

### 1.1 Six-Layer Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        RALPH LOOP v2.0 ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 0: PRE-LOOP VALIDATION                                           │ │
│  │ ├── Check jq installed                                                 │ │
│  │ ├── Validate feature_list.json exists and has valid schema             │ │
│  │ ├── Validate RALPH_PROMPT.md exists                                    │ │
│  │ ├── Validate progress.txt exists                                       │ │
│  │ ├── Warn if Chrome not running (non-blocking)                          │ │
│  │ └── Verify Claude CLI authenticated                                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 1: TERMINAL MANAGEMENT                                           │ │
│  │ ├── tmux session for detach/reattach capability                        │ │
│  │ ├── All output logged to per-iteration files                           │ │
│  │ └── macOS notification on completion/failure                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 2: ORCHESTRATION (Bash Loop + CLI)                               │ │
│  │ ├── Fresh `claude` CLI session per feature                             │ │
│  │ ├── Per-feature model from feature_list.json                           │ │
│  │ ├── --dangerously-skip-permissions flag                                │ │
│  │ ├── Combined retry logic (exit code + log parsing)                     │ │
│  │ └── Exponential backoff (2s, 4s, 8s) for MCP errors                    │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 3: SECURITY                                                      │ │
│  │ ├── PreToolUse hook with ALLOWED_COMMANDS allowlist                    │ │
│  │ ├── Explicit deny rules (rm -rf /*, sudo, .env access)                 │ │
│  │ └── All tool calls logged for audit trail                              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 4: OBSERVABILITY                                                 │ │
│  │ ├── Per-iteration log files: logs/iteration-N-attempt-M.log            │ │
│  │ ├── Session tracking in progress.txt                                   │ │
│  │ ├── Browser health check before ui/verification features               │ │
│  │ └── GIF artifacts for browser verification (optional)                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│                                      ▼                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │ LAYER 5: EXIT CONDITIONS                                               │ │
│  │ ├── All features pass → Status: COMPLETE                               │ │
│  │ ├── Max iterations reached → Status: REACHED_LIMIT                     │ │
│  │ ├── Unrecoverable error → Status: ERROR (with log reference)           │ │
│  │ └── User interrupt (Ctrl+C) → Status: PAUSED                           │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow Diagram

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  User starts    │────►│  Pre-loop       │────►│  Main loop      │
│  ralph-loop     │     │  validation     │     │  begins         │
└─────────────────┘     └─────────────────┘     └────────┬────────┘
                                                         │
                        ┌────────────────────────────────┘
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           FOR EACH ITERATION                             │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │ Read state   │───►│ Check        │───►│ Browser      │               │
│  │ files        │    │ completion   │    │ health check │               │
│  └──────────────┘    └──────────────┘    └──────┬───────┘               │
│         │                   │                    │                       │
│         ▼                   ▼                    ▼                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐               │
│  │ Get next     │    │ If complete: │    │ If UI feat:  │               │
│  │ feature +    │    │ exit COMPLETE│    │ verify Chrome│               │
│  │ model        │    └──────────────┘    └──────┬───────┘               │
│  └──────┬───────┘                               │                       │
│         │                                       │                       │
│         └───────────────────┬───────────────────┘                       │
│                             ▼                                           │
│                  ┌──────────────────────┐                               │
│                  │ Spawn Claude session │                               │
│                  │ claude --model $M    │                               │
│                  │ --dangerously-skip.. │                               │
│                  │ "$(cat PROMPT.md)"   │                               │
│                  └──────────┬───────────┘                               │
│                             │                                           │
│              ┌──────────────┼──────────────┐                            │
│              ▼              ▼              ▼                            │
│       ┌──────────┐   ┌──────────┐   ┌──────────┐                        │
│       │ Success  │   │ MCP drop │   │ Error    │                        │
│       │ exit 0   │   │ detected │   │ exit !=0 │                        │
│       └────┬─────┘   └────┬─────┘   └────┬─────┘                        │
│            │              │              │                              │
│            ▼              ▼              ▼                              │
│       ┌──────────┐   ┌──────────┐   ┌──────────┐                        │
│       │ Update   │   │ Retry w/ │   │ Log error│                        │
│       │ progress │   │ backoff  │   │ continue │                        │
│       └──────────┘   └──────────┘   └──────────┘                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           EXIT CONDITIONS                                │
├─────────────────────────────────────────────────────────────────────────┤
│  • All features passes: true  →  Status: COMPLETE   →  Notify success   │
│  • Iteration >= max_iterations →  Status: REACHED_LIMIT → Notify limit  │
│  • Unrecoverable error        →  Status: ERROR      →  Notify failure   │
│  • Ctrl+C interrupt           →  Status: PAUSED     →  Resume possible  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Orchestration | Bash + CLI | SDK doesn't support Claude in Chrome (Native Messaging) |
| Authentication | OAuth via CLI | `claude login` credentials work automatically |
| Session spawning | New CLI process per feature | Fresh context prevents context rot |
| Permissions | `--dangerously-skip-permissions` + hooks | Autonomous operation with safety guardrails |
| Terminal | tmux | Detach/reattach for long-running loops |
| Error handling | Exit codes + log parsing | Detect specific error types, respond appropriately |

---

## 2. File Structure

```
.claude/
├── hooks/
│   └── ralph-pre-tool.js              # PreToolUse security hook
│
├── scripts/
│   └── ralph-loop/
│       ├── ralph-orchestrator.sh      # Main loop (~150 lines)
│       ├── validate-environment.sh    # Pre-loop checks (~50 lines)
│       ├── browser-health-check.sh    # Chrome connection check (~25 lines)
│       ├── notify.sh                  # macOS notifications (~15 lines)
│       └── ralph-loop-wrapper.sh      # tmux wrapper (~30 lines)
│
├── settings.local.json                # Permissions configuration
│
└── data/
    └── ralph-loops/
        └── {task-name}/
            ├── RALPH_PROMPT.md        # Session prompt (existing)
            ├── feature_list.json      # Feature tracking (existing, schema updated)
            ├── progress.txt           # Human-readable state (existing)
            └── logs/
                ├── iteration-1-attempt-1.log
                ├── iteration-2-attempt-1.log
                ├── iteration-2-attempt-2.log  # Retry log
                └── ...
```

### 2.1 New Files to Create

| File | Lines | Purpose |
|------|-------|---------|
| `ralph-orchestrator.sh` | ~150 | Main orchestration loop |
| `validate-environment.sh` | ~50 | Pre-loop validation |
| `browser-health-check.sh` | ~25 | Chrome connection verification |
| `notify.sh` | ~15 | macOS notification helper |
| `ralph-loop-wrapper.sh` | ~30 | tmux session wrapper |
| `ralph-pre-tool.js` | ~60 | PreToolUse security hook |
| `settings.local.json` | ~40 | Permission configuration |

**Total new code:** ~370 lines

### 2.2 Existing Files to Update

| File | Change |
|------|--------|
| `feature_list.json` | Add `model` field to schema |
| `progress.txt` | Add session ID tracking section |
| `RALPH_PROMPT.md.template` | Add step to run `/get-session-id` before updating progress.txt |

### 2.3 Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Claude Code | ≥2.1.9 | Required for `${CLAUDE_SESSION_ID}` substitution |
| `/get-session-id` skill | - | Already created at `.claude/skills/get-session-id/SKILL.md` |

---

## 3. Component Implementation

### 3.1 Implementation Order

```
Phase 1: Core Infrastructure (4-5 hours)
├── 1.1 validate-environment.sh
├── 1.2 ralph-orchestrator.sh (basic loop)
└── 1.3 settings.local.json

Phase 2: Security Layer (2-3 hours)
├── 2.1 ralph-pre-tool.js
└── 2.2 Test permission blocking

Phase 3: Resilience (2-3 hours)
├── 3.1 Add retry logic to orchestrator
├── 3.2 browser-health-check.sh
└── 3.3 Error-specific handling

Phase 4: Observability (1-2 hours)
├── 4.1 notify.sh
├── 4.2 Session ID tracking
└── 4.3 Log file organization

Phase 5: Terminal Management (1 hour)
└── 5.1 ralph-loop-wrapper.sh (tmux)

Phase 6: Testing & Validation (4-6 hours)
├── 6.1 Unit tests for each component
├── 6.2 E2E test with city-breakdown-dashboard
└── 6.3 Edge case testing
```

---

## 4. Code Skeletons

### 4.1 validate-environment.sh

```bash
#!/bin/bash
# validate-environment.sh
# Pre-loop validation to fail fast on missing dependencies
#
# Usage: source validate-environment.sh && validate_environment "$RALPH_DIR"
# Exit codes: 0 = success, 1 = validation failed

set -e

validate_environment() {
    local ralph_dir="$1"
    local errors=0
    local warnings=0

    echo "=== Ralph Loop Pre-Flight Validation ==="
    echo ""

    # ─────────────────────────────────────────────────────────────────────
    # REQUIRED: jq for JSON parsing
    # ─────────────────────────────────────────────────────────────────────
    if ! command -v jq &> /dev/null; then
        echo "❌ ERROR: jq is not installed"
        echo "   Install with: brew install jq"
        errors=$((errors + 1))
    else
        echo "✓ jq installed"
    fi

    # ─────────────────────────────────────────────────────────────────────
    # REQUIRED: feature_list.json exists and has valid schema
    # ─────────────────────────────────────────────────────────────────────
    local feature_list="$ralph_dir/feature_list.json"
    if [ ! -f "$feature_list" ]; then
        echo "❌ ERROR: feature_list.json not found at: $feature_list"
        errors=$((errors + 1))
    else
        echo "✓ feature_list.json exists"

        # Validate schema
        if ! jq -e '.features | type == "array"' "$feature_list" > /dev/null 2>&1; then
            echo "❌ ERROR: feature_list.json has invalid schema (missing .features array)"
            errors=$((errors + 1))
        else
            local feature_count=$(jq '.features | length' "$feature_list")
            local incomplete_count=$(jq '[.features[] | select(.passes != true)] | length' "$feature_list")
            echo "✓ feature_list.json schema valid ($incomplete_count/$feature_count features remaining)"
        fi
    fi

    # ─────────────────────────────────────────────────────────────────────
    # REQUIRED: RALPH_PROMPT.md exists
    # ─────────────────────────────────────────────────────────────────────
    local prompt_file="$ralph_dir/RALPH_PROMPT.md"
    if [ ! -f "$prompt_file" ]; then
        echo "❌ ERROR: RALPH_PROMPT.md not found at: $prompt_file"
        errors=$((errors + 1))
    else
        echo "✓ RALPH_PROMPT.md exists"
    fi

    # ─────────────────────────────────────────────────────────────────────
    # REQUIRED: progress.txt exists
    # ─────────────────────────────────────────────────────────────────────
    local progress_file="$ralph_dir/progress.txt"
    if [ ! -f "$progress_file" ]; then
        echo "❌ ERROR: progress.txt not found at: $progress_file"
        errors=$((errors + 1))
    else
        echo "✓ progress.txt exists"
    fi

    # ─────────────────────────────────────────────────────────────────────
    # REQUIRED: Claude CLI authenticated
    # ─────────────────────────────────────────────────────────────────────
    if ! command -v claude &> /dev/null; then
        echo "❌ ERROR: Claude CLI not found"
        echo "   Install from: https://claude.ai/download"
        errors=$((errors + 1))
    else
        # Check if authenticated (claude --version should work if authenticated)
        if ! claude --version &> /dev/null; then
            echo "❌ ERROR: Claude CLI not authenticated"
            echo "   Run: claude login"
            errors=$((errors + 1))
        else
            echo "✓ Claude CLI authenticated"
        fi
    fi

    # ─────────────────────────────────────────────────────────────────────
    # WARNING: Chrome running (non-blocking for non-browser features)
    # ─────────────────────────────────────────────────────────────────────
    if ! pgrep -x "Google Chrome" > /dev/null; then
        echo "⚠️  WARNING: Chrome is not running"
        echo "   Browser features may fail. Start Chrome and ensure Claude in Chrome extension is active."
        warnings=$((warnings + 1))
    else
        echo "✓ Chrome is running"
    fi

    # ─────────────────────────────────────────────────────────────────────
    # WARNING: Logs directory
    # ─────────────────────────────────────────────────────────────────────
    local log_dir="$ralph_dir/logs"
    if [ ! -d "$log_dir" ]; then
        mkdir -p "$log_dir"
        echo "✓ Created logs directory: $log_dir"
    else
        echo "✓ Logs directory exists"
    fi

    # ─────────────────────────────────────────────────────────────────────
    # SUMMARY
    # ─────────────────────────────────────────────────────────────────────
    echo ""
    if [ $errors -gt 0 ]; then
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "❌ VALIDATION FAILED: $errors error(s), $warnings warning(s)"
        echo "   Fix the errors above before starting Ralph Loop."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 1
    else
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "✅ VALIDATION PASSED: 0 errors, $warnings warning(s)"
        echo "   Ready to start Ralph Loop."
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        return 0
    fi
}

# Allow sourcing or direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    if [ -z "$1" ]; then
        echo "Usage: $0 <ralph-loop-directory>"
        exit 1
    fi
    validate_environment "$1"
fi
```

### 4.2 browser-health-check.sh

```bash
#!/bin/bash
# browser-health-check.sh
# Verify Chrome connection before browser-dependent features
#
# Usage: source browser-health-check.sh && check_browser_health
# Returns: 0 = healthy, 1 = unhealthy

check_browser_health() {
    local max_retries=2
    local retry_delay=5

    for attempt in $(seq 1 $max_retries); do
        # Check if Chrome is running
        if ! pgrep -x "Google Chrome" > /dev/null; then
            echo "⚠️  Chrome not running (attempt $attempt/$max_retries)"
            if [ $attempt -lt $max_retries ]; then
                echo "   Waiting ${retry_delay}s for Chrome to start..."
                sleep $retry_delay
                continue
            fi
            return 1
        fi

        # Chrome is running - assume extension is active
        # (We can't directly check extension status from bash)
        echo "✓ Chrome is running"
        return 0
    done

    echo "❌ Chrome health check failed after $max_retries attempts"
    return 1
}

# Check if a feature requires browser testing
is_browser_feature() {
    local feature_json="$1"
    local category=$(echo "$feature_json" | jq -r '.category // "unknown"')

    case "$category" in
        ui|verification|testing)
            return 0  # Is browser feature
            ;;
        *)
            return 1  # Not browser feature
            ;;
    esac
}

# Allow sourcing or direct execution
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    check_browser_health
fi
```

### 4.3 ralph-orchestrator.sh

```bash
#!/bin/bash
# ralph-orchestrator.sh
# Main Ralph Loop orchestration script
#
# Usage: ./ralph-orchestrator.sh <ralph-loop-directory> [max-iterations]
# Example: ./ralph-orchestrator.sh .claude/data/ralph-loops/city-breakdown 20

set -euo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RALPH_DIR="${1:-.}"
MAX_ITERATIONS="${2:-20}"
FEATURE_LIST="$RALPH_DIR/feature_list.json"
PROGRESS_TXT="$RALPH_DIR/progress.txt"
PROMPT_FILE="$RALPH_DIR/RALPH_PROMPT.md"
LOG_DIR="$RALPH_DIR/logs"

# Retry configuration
MAX_RETRIES=3
BASE_DELAY=2
RATE_LIMIT_DELAY=60

# ─────────────────────────────────────────────────────────────────────────────
# LOAD HELPER SCRIPTS
# ─────────────────────────────────────────────────────────────────────────────

source "$SCRIPT_DIR/validate-environment.sh"
source "$SCRIPT_DIR/browser-health-check.sh"
source "$SCRIPT_DIR/notify.sh"

# ─────────────────────────────────────────────────────────────────────────────
# HELPER FUNCTIONS
# ─────────────────────────────────────────────────────────────────────────────

get_incomplete_count() {
    jq '[.features[] | select(.passes != true)] | length' "$FEATURE_LIST"
}

get_next_feature() {
    jq -c '[.features[] | select(.passes != true)][0]' "$FEATURE_LIST"
}

get_feature_model() {
    local feature_json="$1"
    local model=$(echo "$feature_json" | jq -r '.model // empty')

    if [ -z "$model" ]; then
        # Fallback to category-based default
        local category=$(echo "$feature_json" | jq -r '.category // "functional"')
        case "$category" in
            setup|functional)
                model="opus"
                ;;
            ui|verification|testing)
                model="sonnet"
                ;;
            documentation)
                model="haiku"
                ;;
            *)
                model="opus"
                ;;
        esac
    fi

    echo "$model"
}

update_progress_status() {
    local status="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Update status line in progress.txt
    if grep -q "^- Status:" "$PROGRESS_TXT"; then
        sed -i '' "s/^- Status:.*$/- Status: $status ($timestamp)/" "$PROGRESS_TXT"
    else
        echo "- Status: $status ($timestamp)" >> "$PROGRESS_TXT"
    fi
}

update_iteration_count() {
    local iteration="$1"

    if grep -q "^- Iteration:" "$PROGRESS_TXT"; then
        sed -i '' "s/^- Iteration:.*$/- Iteration: $iteration \/ $MAX_ITERATIONS/" "$PROGRESS_TXT"
    else
        echo "- Iteration: $iteration / $MAX_ITERATIONS" >> "$PROGRESS_TXT"
    fi
}

log_session() {
    local iteration="$1"
    local attempt="$2"
    local result="$3"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Append to session history in progress.txt
    if ! grep -q "## Session History" "$PROGRESS_TXT"; then
        echo "" >> "$PROGRESS_TXT"
        echo "## Session History" >> "$PROGRESS_TXT"
        echo "| Iteration | Attempt | Timestamp | Result |" >> "$PROGRESS_TXT"
        echo "|-----------|---------|-----------|--------|" >> "$PROGRESS_TXT"
    fi

    echo "| $iteration | $attempt | $timestamp | $result |" >> "$PROGRESS_TXT"
}

# ─────────────────────────────────────────────────────────────────────────────
# RETRY LOGIC
# ─────────────────────────────────────────────────────────────────────────────

run_iteration_with_retry() {
    local iteration="$1"
    local model="$2"
    local feature_json="$3"
    local attempt=0

    while [ $attempt -lt $MAX_RETRIES ]; do
        attempt=$((attempt + 1))
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Iteration $iteration, Attempt $attempt/$MAX_RETRIES"
        echo "Model: $model"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Browser health check for UI features
        if is_browser_feature "$feature_json"; then
            echo "Browser feature detected - checking Chrome connection..."
            if ! check_browser_health; then
                echo "⚠️  Skipping iteration due to Chrome connection failure"
                log_session "$iteration" "$attempt" "chrome_failed"
                return 1
            fi
        fi

        # Prepare log file
        local logfile="$LOG_DIR/iteration-$iteration-attempt-$attempt.log"
        echo "=== Iteration $iteration, Attempt $attempt started at $(date) ===" > "$logfile"

        # Run Claude session
        local exit_code=0
        claude --model "$model" \
               --dangerously-skip-permissions \
               "$(cat "$PROMPT_FILE")" 2>&1 | tee -a "$logfile" || exit_code=$?

        echo "=== Completed at $(date) with exit code $exit_code ===" >> "$logfile"

        # Check for success
        if [ $exit_code -eq 0 ]; then
            log_session "$iteration" "$attempt" "success"
            return 0
        fi

        # Parse log for specific errors
        if grep -qi "MCP.*connection.*lost\|MCP.*error\|connection.*dropped\|MCP.*timeout" "$logfile"; then
            echo "⚠️  MCP connection error detected"
            log_session "$iteration" "$attempt" "mcp_error"

            if [ $attempt -lt $MAX_RETRIES ]; then
                local delay=$((BASE_DELAY * (2 ** (attempt - 1))))
                echo "   Retrying in ${delay}s..."
                sleep $delay
                continue
            fi
        fi

        if grep -qi "rate.*limit\|too.*many.*requests\|429" "$logfile"; then
            echo "⚠️  Rate limit detected"
            log_session "$iteration" "$attempt" "rate_limit"

            if [ $attempt -lt $MAX_RETRIES ]; then
                echo "   Waiting ${RATE_LIMIT_DELAY}s before retry..."
                sleep $RATE_LIMIT_DELAY
                continue
            fi
        fi

        # Unknown error - log and continue to next iteration
        echo "❌ Session failed with exit code $exit_code"
        echo "   Check log: $logfile"
        log_session "$iteration" "$attempt" "error_$exit_code"
        return 1
    done

    echo "❌ Max retries ($MAX_RETRIES) exceeded for iteration $iteration"
    return 1
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN LOOP
# ─────────────────────────────────────────────────────────────────────────────

main() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║                     RALPH LOOP v2.0                               ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Directory: $RALPH_DIR"
    echo "Max iterations: $MAX_ITERATIONS"
    echo ""

    # ─────────────────────────────────────────────────────────────────────
    # LAYER 0: Pre-loop validation
    # ─────────────────────────────────────────────────────────────────────
    if ! validate_environment "$RALPH_DIR"; then
        notify_failure "Ralph Loop" "Pre-flight validation failed"
        exit 1
    fi

    echo ""
    update_progress_status "IN_PROGRESS"

    # ─────────────────────────────────────────────────────────────────────
    # LAYER 2: Main orchestration loop
    # ─────────────────────────────────────────────────────────────────────
    for iteration in $(seq 1 $MAX_ITERATIONS); do
        # Check completion status
        local incomplete=$(get_incomplete_count)
        if [ "$incomplete" -eq 0 ]; then
            echo ""
            echo "╔═══════════════════════════════════════════════════════════════════╗"
            echo "║                    ✅ ALL FEATURES COMPLETE                       ║"
            echo "╚═══════════════════════════════════════════════════════════════════╝"
            update_progress_status "COMPLETE"
            notify_success "Ralph Loop" "All features passed!"
            exit 0
        fi

        # Get next feature and model
        local next_feature=$(get_next_feature)
        local feature_desc=$(echo "$next_feature" | jq -r '.description // "Unknown"')
        local feature_id=$(echo "$next_feature" | jq -r '.id // "?"')
        local model=$(get_feature_model "$next_feature")

        echo ""
        echo "┌───────────────────────────────────────────────────────────────────┐"
        echo "│ ITERATION $iteration/$MAX_ITERATIONS"
        echo "│ Feature #$feature_id: $feature_desc"
        echo "│ Model: $model"
        echo "│ Remaining: $incomplete features"
        echo "└───────────────────────────────────────────────────────────────────┘"

        update_iteration_count "$iteration"

        # Run iteration with retry logic
        if ! run_iteration_with_retry "$iteration" "$model" "$next_feature"; then
            echo "⚠️  Iteration $iteration failed, continuing to next..."
        fi

        # Brief pause between iterations
        echo ""
        echo "Pausing 3s before next iteration..."
        sleep 3
    done

    # ─────────────────────────────────────────────────────────────────────
    # LAYER 5: Exit condition - max iterations reached
    # ─────────────────────────────────────────────────────────────────────
    echo ""
    echo "╔═══════════════════════════════════════════════════════════════════╗"
    echo "║              ⚠️  MAX ITERATIONS REACHED ($MAX_ITERATIONS)                    ║"
    echo "╚═══════════════════════════════════════════════════════════════════╝"

    local remaining=$(get_incomplete_count)
    echo "Remaining features: $remaining"

    update_progress_status "REACHED_LIMIT"
    notify_warning "Ralph Loop" "Max iterations reached. $remaining features remaining."
    exit 1
}

# ─────────────────────────────────────────────────────────────────────────────
# SIGNAL HANDLING
# ─────────────────────────────────────────────────────────────────────────────

cleanup() {
    echo ""
    echo "⚠️  Interrupted by user (Ctrl+C)"
    update_progress_status "PAUSED"
    notify_warning "Ralph Loop" "Paused by user"
    exit 130
}

trap cleanup SIGINT SIGTERM

# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────

main "$@"
```

### 4.4 notify.sh

```bash
#!/bin/bash
# notify.sh
# macOS notification helpers for Ralph Loop
#
# Usage: source notify.sh && notify_success "Title" "Message"

notify_success() {
    local title="$1"
    local message="$2"
    osascript -e "display notification \"$message\" with title \"$title\" sound name \"Glass\""
}

notify_failure() {
    local title="$1"
    local message="$2"
    osascript -e "display notification \"$message\" with title \"$title\" sound name \"Basso\""
}

notify_warning() {
    local title="$1"
    local message="$2"
    osascript -e "display notification \"$message\" with title \"$title\" sound name \"Purr\""
}
```

### 4.5 ralph-loop-wrapper.sh

```bash
#!/bin/bash
# ralph-loop-wrapper.sh
# tmux wrapper for detachable Ralph Loop execution
#
# Usage: ./ralph-loop-wrapper.sh {start|attach|status|stop|logs} <ralph-dir> [max-iter]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND="${1:-help}"
RALPH_DIR="${2:-.}"
MAX_ITER="${3:-20}"
SESSION_NAME="ralph-loop"

case "$COMMAND" in
    start)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "❌ Ralph Loop already running"
            echo "   Use '$0 attach' to observe"
            echo "   Use '$0 stop' to terminate"
            exit 1
        fi

        echo "Starting Ralph Loop in tmux session '$SESSION_NAME'..."
        tmux new-session -d -s "$SESSION_NAME" \
            "$SCRIPT_DIR/ralph-orchestrator.sh \"$RALPH_DIR\" $MAX_ITER"

        echo "✅ Ralph Loop started"
        echo "   Use '$0 attach' to observe"
        echo "   Use '$0 status' to check progress"
        echo "   Use '$0 stop' to terminate"
        ;;

    attach)
        if ! tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "❌ Ralph Loop is not running"
            echo "   Use '$0 start <ralph-dir>' to begin"
            exit 1
        fi

        echo "Attaching to Ralph Loop session (Ctrl+B, D to detach)..."
        tmux attach -t "$SESSION_NAME"
        ;;

    status)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "✅ Ralph Loop is RUNNING"
            echo ""
            if [ -f "$RALPH_DIR/progress.txt" ]; then
                echo "Progress:"
                head -15 "$RALPH_DIR/progress.txt"
            fi
        else
            echo "⚪ Ralph Loop is NOT RUNNING"
            if [ -f "$RALPH_DIR/progress.txt" ]; then
                echo ""
                echo "Last known status:"
                grep "^- Status:" "$RALPH_DIR/progress.txt" || echo "   Unknown"
            fi
        fi
        ;;

    stop)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            tmux kill-session -t "$SESSION_NAME"
            echo "✅ Ralph Loop stopped"
        else
            echo "⚪ Ralph Loop was not running"
        fi
        ;;

    logs)
        if [ -d "$RALPH_DIR/logs" ]; then
            echo "Recent logs:"
            ls -lt "$RALPH_DIR/logs" | head -10
            echo ""
            echo "Tail latest log:"
            local latest=$(ls -t "$RALPH_DIR/logs"/*.log 2>/dev/null | head -1)
            if [ -n "$latest" ]; then
                tail -50 "$latest"
            else
                echo "   No logs found"
            fi
        else
            echo "❌ Logs directory not found: $RALPH_DIR/logs"
        fi
        ;;

    *)
        echo "Ralph Loop Wrapper - tmux session management"
        echo ""
        echo "Usage: $0 {command} <ralph-dir> [max-iterations]"
        echo ""
        echo "Commands:"
        echo "  start   - Start Ralph Loop in background tmux session"
        echo "  attach  - Attach to running session (Ctrl+B, D to detach)"
        echo "  status  - Check if Ralph Loop is running and show progress"
        echo "  stop    - Terminate Ralph Loop session"
        echo "  logs    - Show recent log files"
        echo ""
        echo "Examples:"
        echo "  $0 start .claude/data/ralph-loops/city-breakdown 20"
        echo "  $0 attach"
        echo "  $0 status .claude/data/ralph-loops/city-breakdown"
        echo "  $0 stop"
        ;;
esac
```

### 4.6 ralph-pre-tool.js

```javascript
#!/usr/bin/env node
/**
 * ralph-pre-tool.js
 * PreToolUse hook for Ralph Loop security
 *
 * Validates bash commands against an allowlist and blocks dangerous operations.
 *
 * Usage: Configure in .claude/settings.local.json hooks section
 */

const fs = require('fs');

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

const ALLOWED_COMMANDS = new Set([
    // Package managers
    'npm', 'npx', 'yarn', 'pnpm', 'bun',
    // Node/Python
    'node', 'python', 'python3', 'pip', 'pip3',
    // Git
    'git',
    // File operations (safe)
    'ls', 'cat', 'head', 'tail', 'wc', 'find', 'grep', 'mkdir', 'touch',
    // Text processing
    'jq', 'sed', 'awk', 'sort', 'uniq', 'tr', 'cut',
    // Network (read-only)
    'curl', 'wget',
    // System info
    'pwd', 'whoami', 'date', 'echo', 'printf',
    // Claude
    'claude',
    // Build tools
    'make', 'cargo', 'go',
]);

const BLOCKED_PATTERNS = [
    /^rm\s+(-rf?|--recursive)?\s*\/(?!Users)/i,  // rm -rf / (allow /Users paths)
    /^sudo\s/i,                                    // Any sudo command
    /^chmod\s+777/i,                               // chmod 777
    /^chown\s+root/i,                              // chown to root
    />\s*\/etc\//i,                                // Write to /etc
    />\s*\/usr\//i,                                // Write to /usr
    /\|\s*sh\s*$/i,                                // Pipe to sh
    /\|\s*bash\s*$/i,                              // Pipe to bash
    /eval\s*\(/i,                                  // eval()
    /`.*`/,                                        // Command substitution (backticks)
];

const SENSITIVE_FILE_PATTERNS = [
    /\.env$/i,
    /\.env\..*/i,
    /credentials/i,
    /secrets?/i,
    /\.pem$/i,
    /\.key$/i,
    /id_rsa/i,
    /id_ed25519/i,
];

// ─────────────────────────────────────────────────────────────────────────────
// VALIDATION FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

function extractBaseCommand(command) {
    // Handle common prefixes
    const trimmed = command.trim();

    // Skip environment variables at the start
    const envVarPattern = /^([A-Z_][A-Z0-9_]*=\S+\s+)*/;
    const withoutEnvVars = trimmed.replace(envVarPattern, '');

    // Get first word
    const match = withoutEnvVars.match(/^(\S+)/);
    return match ? match[1] : '';
}

function validateBashCommand(command) {
    const baseCommand = extractBaseCommand(command);

    // Check if base command is allowed
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
        return {
            allowed: false,
            reason: `Command '${baseCommand}' is not in the allowlist`
        };
    }

    // Check for blocked patterns
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(command)) {
            return {
                allowed: false,
                reason: `Command matches blocked pattern: ${pattern}`
            };
        }
    }

    return { allowed: true };
}

function validateFileAccess(filePath, operation) {
    for (const pattern of SENSITIVE_FILE_PATTERNS) {
        if (pattern.test(filePath)) {
            return {
                allowed: false,
                reason: `Access to sensitive file blocked: ${filePath}`
            };
        }
    }

    return { allowed: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN HOOK HANDLER
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
    // Read input from stdin
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
    }

    let hookData;
    try {
        hookData = JSON.parse(input);
    } catch (e) {
        // If we can't parse input, allow the operation
        console.log(JSON.stringify({ decision: null }));
        return;
    }

    const { tool_name, tool_input } = hookData;

    // ─────────────────────────────────────────────────────────────────────
    // Validate Bash commands
    // ─────────────────────────────────────────────────────────────────────
    if (tool_name === 'Bash' && tool_input?.command) {
        const result = validateBashCommand(tool_input.command);

        if (!result.allowed) {
            console.error(`[ralph-pre-tool] BLOCKED: ${result.reason}`);
            console.log(JSON.stringify({
                decision: 'block',
                reason: result.reason
            }));
            return;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Validate file access
    // ─────────────────────────────────────────────────────────────────────
    if (['Read', 'Edit', 'Write'].includes(tool_name) && tool_input?.file_path) {
        const result = validateFileAccess(tool_input.file_path, tool_name);

        if (!result.allowed) {
            console.error(`[ralph-pre-tool] BLOCKED: ${result.reason}`);
            console.log(JSON.stringify({
                decision: 'block',
                reason: result.reason
            }));
            return;
        }
    }

    // ─────────────────────────────────────────────────────────────────────
    // Allow all other operations
    // ─────────────────────────────────────────────────────────────────────
    console.log(JSON.stringify({ decision: null }));
}

main().catch(err => {
    console.error(`[ralph-pre-tool] Error: ${err.message}`);
    // On error, allow the operation (fail-open for usability)
    console.log(JSON.stringify({ decision: null }));
});
```

---

## 5. Configuration Files

### 5.1 settings.local.json

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
      "TodoWrite",
      "Bash(npm:*)",
      "Bash(npx:*)",
      "Bash(node:*)",
      "Bash(git:*)",
      "Bash(ls:*)",
      "Bash(pwd)",
      "Bash(cat:*)",
      "Bash(head:*)",
      "Bash(tail:*)",
      "Bash(mkdir:*)",
      "Bash(jq:*)",
      "Bash(grep:*)",
      "Bash(curl:*)",
      "Bash(echo:*)",
      "Bash(date)",
      "Bash(sleep:*)",
      "mcp__supabase__*",
      "mcp__firecrawl__*",
      "mcp__claude-in-chrome__*"
    ],
    "deny": [
      "Bash(rm -rf /*)",
      "Bash(rm -rf /)",
      "Bash(sudo:*)",
      "Bash(chmod 777:*)",
      "Read(.env)",
      "Read(.env.*)",
      "Read(**/secrets/**)",
      "Read(**/*.pem)",
      "Read(**/*.key)",
      "Edit(.env)",
      "Edit(.env.*)",
      "Write(.env)",
      "Write(.env.*)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node $CLAUDE_PROJECT_DIR/.claude/hooks/ralph-pre-tool.js"
          }
        ]
      }
    ]
  }
}
```

### 5.2 Updated feature_list.json Schema

```json
{
  "task_name": "example-task",
  "created": "2025-01-16",
  "total_features": 9,
  "completed_features": 0,
  "default_model": "opus",
  "instructions": "CRITICAL: Only modify the 'passes' field when a feature is verified...",
  "features": [
    {
      "id": 1,
      "category": "setup",
      "priority": "high",
      "model": "opus",
      "description": "Feature description here",
      "steps": [
        "Step 1: ...",
        "Step 2: ..."
      ],
      "passes": false,
      "completed_iteration": null,
      "notes": ""
    },
    {
      "id": 2,
      "category": "ui",
      "priority": "medium",
      "model": "sonnet",
      "description": "UI verification feature",
      "steps": [
        "Step 1: Navigate to page",
        "Step 2: Verify element exists"
      ],
      "passes": false,
      "completed_iteration": null,
      "notes": ""
    }
  ]
}
```

**Schema additions:**
- `default_model` (task-level): Fallback model if feature doesn't specify
- `model` (feature-level): Per-feature model override (opus/sonnet/haiku)

**Category-to-model defaults:**
| Category | Default Model |
|----------|---------------|
| setup | opus |
| functional | opus |
| ui | sonnet |
| verification | sonnet |
| testing | sonnet |
| documentation | haiku |

### 5.3 Session ID Capture

Session IDs are captured using the `/get-session-id` skill, which leverages Claude Code 2.1.9's `${CLAUDE_SESSION_ID}` string substitution.

**Skill location:** `.claude/skills/get-session-id/SKILL.md`

```yaml
---
name: get-session-id
description: "Use this skill to get the current session id"
model: haiku
context: fork
---

# Get session ID

Respond to the main agent with exactly this: "SESSION_ID: ${CLAUDE_SESSION_ID}"
```

**RALPH_PROMPT.md.template update:**

Add this step before the progress.txt update section:

```markdown
## Step 7: Log Session ID

Before updating progress.txt, capture the session ID for debugging:

1. Run `/get-session-id` skill
2. Parse the returned `SESSION_ID: <id>` value
3. Include the session ID when updating progress.txt

Example progress.txt update:
```
## Session History
| Iteration | Session ID | Timestamp | Feature | Result |
|-----------|------------|-----------|---------|--------|
| 1 | abc123def | 2025-01-16 10:15 | Feature 1 | passed |
```
```

**Why this approach:**
- Uses native Claude Code feature (`${CLAUDE_SESSION_ID}`)
- Lightweight skill (runs with haiku model)
- Fork context prevents polluting main session
- No CLI output parsing required
- Reliable and deterministic

---

## 6. Test Cases

### 6.1 Unit Tests

#### Test: validate-environment.sh

```bash
#!/bin/bash
# test-validate-environment.sh

source ./validate-environment.sh

echo "=== Testing validate-environment.sh ==="

# Test 1: Missing jq
echo "Test 1: Missing jq simulation"
# (Manually rename jq to test, or mock the command check)

# Test 2: Missing feature_list.json
echo "Test 2: Missing feature_list.json"
TEMP_DIR=$(mktemp -d)
validate_environment "$TEMP_DIR" && echo "FAIL: Should have failed" || echo "PASS: Correctly failed"
rm -rf "$TEMP_DIR"

# Test 3: Invalid JSON schema
echo "Test 3: Invalid feature_list.json schema"
TEMP_DIR=$(mktemp -d)
echo '{"invalid": "schema"}' > "$TEMP_DIR/feature_list.json"
touch "$TEMP_DIR/RALPH_PROMPT.md"
touch "$TEMP_DIR/progress.txt"
validate_environment "$TEMP_DIR" && echo "FAIL: Should have failed" || echo "PASS: Correctly failed"
rm -rf "$TEMP_DIR"

# Test 4: Valid setup
echo "Test 4: Valid setup"
TEMP_DIR=$(mktemp -d)
echo '{"features": [{"id": 1, "passes": false}]}' > "$TEMP_DIR/feature_list.json"
touch "$TEMP_DIR/RALPH_PROMPT.md"
touch "$TEMP_DIR/progress.txt"
validate_environment "$TEMP_DIR" && echo "PASS: Correctly passed" || echo "FAIL: Should have passed"
rm -rf "$TEMP_DIR"

echo "=== Tests complete ==="
```

#### Test: ralph-pre-tool.js

```bash
#!/bin/bash
# test-ralph-pre-tool.sh

echo "=== Testing ralph-pre-tool.js ==="

# Test 1: Allowed command (npm)
echo "Test 1: npm install (should allow)"
echo '{"tool_name": "Bash", "tool_input": {"command": "npm install"}}' | node ralph-pre-tool.js
echo ""

# Test 2: Blocked command (sudo)
echo "Test 2: sudo rm (should block)"
echo '{"tool_name": "Bash", "tool_input": {"command": "sudo rm -rf /tmp"}}' | node ralph-pre-tool.js
echo ""

# Test 3: Blocked command (rm -rf /)
echo "Test 3: rm -rf / (should block)"
echo '{"tool_name": "Bash", "tool_input": {"command": "rm -rf /"}}' | node ralph-pre-tool.js
echo ""

# Test 4: Sensitive file (should block)
echo "Test 4: Read .env (should block)"
echo '{"tool_name": "Read", "tool_input": {"file_path": "/app/.env"}}' | node ralph-pre-tool.js
echo ""

# Test 5: Normal file (should allow)
echo "Test 5: Read package.json (should allow)"
echo '{"tool_name": "Read", "tool_input": {"file_path": "/app/package.json"}}' | node ralph-pre-tool.js
echo ""

echo "=== Tests complete ==="
```

### 6.2 Integration Test

```bash
#!/bin/bash
# test-integration.sh
# Run a short Ralph Loop to verify end-to-end functionality

echo "=== Integration Test ==="

# Create test directory
TEST_DIR=$(mktemp -d)
echo "Test directory: $TEST_DIR"

# Create minimal feature_list.json
cat > "$TEST_DIR/feature_list.json" << 'EOF'
{
  "task_name": "integration-test",
  "features": [
    {
      "id": 1,
      "category": "setup",
      "model": "haiku",
      "description": "Test feature - just echo success",
      "passes": false
    }
  ]
}
EOF

# Create minimal RALPH_PROMPT.md
cat > "$TEST_DIR/RALPH_PROMPT.md" << 'EOF'
# Integration Test Prompt

You are running an integration test. Simply:
1. Read feature_list.json
2. Mark feature 1 as passes: true
3. Exit

This tests the Ralph Loop orchestrator.
EOF

# Create progress.txt
cat > "$TEST_DIR/progress.txt" << 'EOF'
# Integration Test Progress
- Status: PENDING
- Iteration: 0 / 1
EOF

# Run orchestrator with max 1 iteration
echo ""
echo "Running orchestrator..."
./ralph-orchestrator.sh "$TEST_DIR" 1

# Check result
echo ""
echo "Checking results..."
if grep -q '"passes": true' "$TEST_DIR/feature_list.json"; then
    echo "✅ PASS: Feature was marked as passing"
else
    echo "❌ FAIL: Feature was not marked as passing"
fi

if grep -q "COMPLETE" "$TEST_DIR/progress.txt"; then
    echo "✅ PASS: Status updated to COMPLETE"
else
    echo "⚠️  WARN: Status not COMPLETE (may be expected if feature didn't pass)"
fi

# Cleanup
echo ""
echo "Test directory preserved at: $TEST_DIR"
echo "Run 'rm -rf $TEST_DIR' to clean up"
```

### 6.3 E2E Test with city-breakdown-dashboard

```bash
#!/bin/bash
# test-e2e-city-breakdown.sh
# Full end-to-end test with existing Ralph Loop

RALPH_DIR=".claude/data/ralph-loops/dashboard-city-table"

echo "=== E2E Test: city-breakdown-dashboard ==="
echo "Directory: $RALPH_DIR"
echo ""

# Check if directory exists
if [ ! -d "$RALPH_DIR" ]; then
    echo "❌ ERROR: Ralph Loop directory not found"
    echo "   Expected: $RALPH_DIR"
    exit 1
fi

# Backup current state
cp "$RALPH_DIR/feature_list.json" "$RALPH_DIR/feature_list.json.backup"
cp "$RALPH_DIR/progress.txt" "$RALPH_DIR/progress.txt.backup"

echo "Backed up current state"
echo ""

# Run with limited iterations
echo "Running Ralph Loop with max 3 iterations..."
./ralph-loop-wrapper.sh start "$RALPH_DIR" 3

echo ""
echo "Use './ralph-loop-wrapper.sh attach' to observe"
echo "Use './ralph-loop-wrapper.sh status $RALPH_DIR' to check progress"
echo ""
echo "To restore original state:"
echo "  mv $RALPH_DIR/feature_list.json.backup $RALPH_DIR/feature_list.json"
echo "  mv $RALPH_DIR/progress.txt.backup $RALPH_DIR/progress.txt"
```

---

## 7. Rollout Checklist

### 7.1 Pre-Implementation

- [ ] Review this implementation plan
- [ ] Confirm estimated effort (14-17 hours) is acceptable
- [ ] Identify any missing requirements
- [ ] Set up test environment

### 7.2 Phase 1: Core Infrastructure (4-5 hours)

- [ ] Create `.claude/scripts/ralph-loop/` directory
- [ ] Implement `validate-environment.sh`
- [ ] Test `validate-environment.sh` with unit tests
- [ ] Implement basic `ralph-orchestrator.sh` (without retry logic)
- [ ] Test basic loop with mock feature
- [ ] Create `settings.local.json`
- [ ] Test permission configuration

### 7.3 Phase 2: Security Layer (2-3 hours)

- [ ] Implement `ralph-pre-tool.js`
- [ ] Test allowed commands pass
- [ ] Test blocked commands fail
- [ ] Test sensitive file access blocked
- [ ] Configure hook in `settings.local.json`
- [ ] Verify hook is triggered during Claude sessions

### 7.4 Phase 3: Resilience (2-3 hours)

- [ ] Add retry logic to `ralph-orchestrator.sh`
- [ ] Implement `browser-health-check.sh`
- [ ] Test MCP error detection (simulate with bad config)
- [ ] Test rate limit handling
- [ ] Test exponential backoff timing
- [ ] Verify browser health check before UI features

### 7.5 Phase 4: Observability (1-2 hours)

- [ ] Implement `notify.sh`
- [ ] Test macOS notifications
- [ ] Verify `/get-session-id` skill exists and works (Claude Code ≥2.1.9 required)
- [ ] Update `RALPH_PROMPT.md.template` to include session ID capture step
- [ ] Test session ID capture in a sample Ralph session
- [ ] Verify session ID appears in progress.txt after iteration
- [ ] Verify per-iteration log files are created
- [ ] Verify attempt number in log filenames

### 7.6 Phase 5: Terminal Management (1 hour)

- [ ] Implement `ralph-loop-wrapper.sh`
- [ ] Test `start` command
- [ ] Test `attach` command
- [ ] Test `detach` (Ctrl+B, D)
- [ ] Test `status` command
- [ ] Test `stop` command
- [ ] Test `logs` command

### 7.7 Phase 6: Testing & Validation (4-6 hours)

- [ ] Run unit tests for all components
- [ ] Run integration test
- [ ] Run E2E test with `city-breakdown-dashboard`
- [ ] Test Ctrl+C interrupt handling
- [ ] Test Chrome not running warning
- [ ] Test max iterations exit condition
- [ ] Test all features complete exit condition
- [ ] Document any issues found

### 7.8 Post-Implementation

- [ ] Update `/continue-ralph` skill to use new orchestrator
- [ ] Update `/plan-ralph-loop` skill templates
- [ ] Archive old AppleScript-based implementation
- [ ] Create user documentation
- [ ] Train team on new workflow

---

## 8. Troubleshooting Guide

### 8.1 Common Issues

#### Issue: "jq is not installed"

**Solution:**
```bash
brew install jq
```

#### Issue: "Claude CLI not authenticated"

**Solution:**
```bash
claude login
```

#### Issue: Chrome warning but browser features fail

**Symptoms:** Warning shows "Chrome is not running" but Chrome is actually running.

**Solution:** Ensure Chrome is running as "Google Chrome" (not Chromium or another variant):
```bash
pgrep -x "Google Chrome"
```

If using Chromium, update `validate-environment.sh` to check for your browser name.

#### Issue: Permission prompts still appearing

**Symptoms:** Despite `--dangerously-skip-permissions`, some operations prompt.

**Solution:**
1. Verify `settings.local.json` is in the correct location (`.claude/settings.local.json`)
2. Check the permission pattern matches exactly
3. Add missing patterns to the `allow` list

#### Issue: MCP connection drops frequently

**Symptoms:** Multiple retry attempts per iteration, "MCP connection error" in logs.

**Solution:**
1. Ensure Claude in Chrome extension is up to date
2. Restart Chrome
3. Increase `BASE_DELAY` in `ralph-orchestrator.sh`
4. Check network stability

#### Issue: tmux session not detaching

**Symptoms:** Ctrl+B, D doesn't detach.

**Solution:** Verify tmux prefix key:
```bash
tmux show-options -g prefix
```

If different from `C-b`, use that key instead.

### 8.2 Log Analysis

```bash
# View latest log
tail -100 .claude/data/ralph-loops/{task}/logs/$(ls -t .claude/data/ralph-loops/{task}/logs/*.log | head -1)

# Search for errors
grep -i "error\|fail\|block" .claude/data/ralph-loops/{task}/logs/*.log

# Count retries
grep -c "Attempt [2-3]/" .claude/data/ralph-loops/{task}/logs/*.log
```

### 8.3 Recovery Procedures

#### Resume after PAUSED status

```bash
# Check current state
cat .claude/data/ralph-loops/{task}/progress.txt

# Resume from where it left off
./ralph-loop-wrapper.sh start .claude/data/ralph-loops/{task}
```

#### Reset and restart

```bash
# Reset all features to not passing
jq '.features |= map(.passes = false)' feature_list.json > temp.json && mv temp.json feature_list.json

# Clear logs
rm -rf .claude/data/ralph-loops/{task}/logs/*

# Update progress
sed -i '' 's/^- Status:.*/- Status: PENDING/' progress.txt
sed -i '' 's/^- Iteration:.*/- Iteration: 0/' progress.txt

# Start fresh
./ralph-loop-wrapper.sh start .claude/data/ralph-loops/{task}
```

---

## Appendix A: Debate Summary

This implementation plan was created through a structured debate process involving three branches:

| Branch | Initial Position | Final Contribution |
|--------|------------------|-------------------|
| Branch-1 | CLI + mprocs | Pre-loop validation, unified architecture, combined error handling |
| Branch-2 | Python SDK | MCP retry logic, exponential backoff, browser health check, OAuth clarification |
| Branch-3 | CLI + Bash Loop | Security hooks (ALLOWED_COMMANDS), CLI-only simplicity, schema validation |

**Key debate outcomes:**
1. SDK rejected due to Claude in Chrome incompatibility (Native Messaging vs HTTP)
2. CLI-only approach chosen for simplicity and proven reliability
3. All three branches' best contributions incorporated into final design

---

## Appendix B: References

- [Phase 1 Issues](./PHASE_1_CURRENT_ISSUES.md)
- [Debate Log](./further-investigations/orchestrator-debate/debate-log.md)
- [Branch-1 Investigation](./further-investigations/branch-1/)
- [Branch-2 Investigation](./further-investigations/branch-2/)
- [Branch-3 Investigation](./further-investigations/branch-3/)
- [coleam00's OAuth Implementation](https://github.com/coleam00/Linear-Coding-Agent-Harness)
- [Anthropic Autonomous Coding Quickstart](https://github.com/anthropics/claude-quickstarts/tree/main/autonomous-coding)
