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
