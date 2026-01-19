#!/bin/bash
# ralph-orchestrator.sh
# Main Ralph Loop orchestration script
# v2.1 - Improved error handling and log preservation
#
# Usage: ./ralph-orchestrator.sh <ralph-loop-directory> [max-iterations]
# Example: ./ralph-orchestrator.sh .claude/data/ralph-loops/city-breakdown 20

# Note: NOT using set -e because we need to handle Claude CLI crashes gracefully
# The CLI can crash with unhandled promise rejections that would otherwise kill the orchestrator
set -uo pipefail

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

        # Prepare log file with timestamp to prevent overwrites on restart
        local timestamp=$(date '+%Y%m%d-%H%M%S')
        local logfile="$LOG_DIR/iteration-$iteration-attempt-$attempt-$timestamp.log"
        local session_log="$LOG_DIR/session-output.log"

        echo "" >> "$session_log"
        echo "═══════════════════════════════════════════════════════════════" >> "$session_log"
        echo "Iteration $iteration, Attempt $attempt - Started at $(date)" >> "$session_log"
        echo "Log file: $logfile" >> "$session_log"
        echo "═══════════════════════════════════════════════════════════════" >> "$session_log"

        echo "=== Iteration $iteration, Attempt $attempt started at $(date) ===" > "$logfile"

        # Run Claude session
        local exit_code=0
        claude --model "$model" \
               --dangerously-skip-permissions \
               "$(cat "$PROMPT_FILE")" 2>&1 | tee -a "$logfile" "$session_log" || exit_code=$?

        echo "=== Completed at $(date) with exit code $exit_code ===" >> "$logfile"
        echo "Exit code: $exit_code" >> "$session_log"

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

        # CLI-specific errors (No messages returned, promise rejection, etc.)
        if grep -qi "No messages returned\|promise.*rejected\|unhandled.*rejection" "$logfile"; then
            echo "⚠️  CLI error detected (No messages returned / Promise rejection)"
            log_session "$iteration" "$attempt" "cli_error"

            if [ $attempt -lt $MAX_RETRIES ]; then
                local delay=$((BASE_DELAY * (2 ** (attempt - 1)) + 5))
                echo "   Retrying in ${delay}s..."
                sleep $delay
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
