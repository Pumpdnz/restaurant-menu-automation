#!/bin/bash
# ralph-loop-wrapper.sh
# tmux wrapper for detachable Ralph Loop execution
# v2.1 - Added auto-recovery on CLI crashes
#
# Usage: ./ralph-loop-wrapper.sh {start|attach|status|stop|logs} <ralph-dir> [max-iter]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMAND="${1:-help}"
RALPH_DIR="${2:-.}"
MAX_ITER="${3:-20}"
SESSION_NAME="ralph-loop"
MAX_CRASHES=5
CRASH_COOLDOWN=10

# Auto-recovery wrapper function
run_with_recovery() {
    local ralph_dir="$1"
    local max_iter="$2"
    local crash_count=0
    local master_log="$ralph_dir/logs/master.log"

    mkdir -p "$ralph_dir/logs"

    echo "$(date '+%Y-%m-%d %H:%M:%S') - Ralph Loop started with auto-recovery (max crashes: $MAX_CRASHES)" >> "$master_log"

    while [ $crash_count -lt $MAX_CRASHES ]; do
        echo ""
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        if [ $crash_count -gt 0 ]; then
            echo "🔄 AUTO-RECOVERY: Restarting orchestrator (crash #$crash_count)"
            echo "$(date '+%Y-%m-%d %H:%M:%S') - Auto-recovery restart #$crash_count" >> "$master_log"
        fi
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

        # Run orchestrator
        "$SCRIPT_DIR/ralph-orchestrator.sh" "$ralph_dir" "$max_iter"
        exit_code=$?

        echo "$(date '+%Y-%m-%d %H:%M:%S') - Orchestrator exited with code $exit_code" >> "$master_log"

        # Check exit code
        case $exit_code in
            0)
                # Success - all features complete
                echo "$(date '+%Y-%m-%d %H:%M:%S') - SUCCESS: All features complete" >> "$master_log"
                return 0
                ;;
            130)
                # User interrupt (Ctrl+C)
                echo "$(date '+%Y-%m-%d %H:%M:%S') - User interrupted" >> "$master_log"
                return 130
                ;;
            *)
                # Crash or error - attempt recovery
                crash_count=$((crash_count + 1))
                echo ""
                echo "⚠️  Orchestrator crashed (exit code: $exit_code)"
                echo "   Crash count: $crash_count/$MAX_CRASHES"
                echo "$(date '+%Y-%m-%d %H:%M:%S') - CRASH detected (code: $exit_code, count: $crash_count)" >> "$master_log"

                if [ $crash_count -lt $MAX_CRASHES ]; then
                    # Check if there are still features to complete
                    local remaining=$(jq '[.features[] | select(.passes != true)] | length' "$ralph_dir/feature_list.json" 2>/dev/null || echo "0")

                    if [ "$remaining" -eq 0 ]; then
                        echo "✅ No remaining features - considering complete despite crash"
                        echo "$(date '+%Y-%m-%d %H:%M:%S') - No remaining features, exiting successfully" >> "$master_log"
                        return 0
                    fi

                    echo "   Waiting ${CRASH_COOLDOWN}s before auto-recovery..."
                    echo "   Remaining features: $remaining"
                    sleep $CRASH_COOLDOWN
                else
                    echo "❌ Max crash limit reached ($MAX_CRASHES)"
                    echo "$(date '+%Y-%m-%d %H:%M:%S') - FAILED: Max crash limit reached" >> "$master_log"
                    return 1
                fi
                ;;
        esac
    done

    return 1
}

case "$COMMAND" in
    start)
        if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
            echo "❌ Ralph Loop already running"
            echo "   Use '$0 attach' to observe"
            echo "   Use '$0 stop' to terminate"
            exit 1
        fi

        # Convert to absolute path for tmux
        RALPH_DIR_ABS="$(cd "$RALPH_DIR" 2>/dev/null && pwd || echo "$RALPH_DIR")"

        echo "Starting Ralph Loop in tmux session '$SESSION_NAME'..."
        echo "   Auto-recovery enabled (max $MAX_CRASHES crashes)"

        # Export the function and run it in tmux
        tmux new-session -d -s "$SESSION_NAME" \
            "cd $(pwd) && bash -c 'source $SCRIPT_DIR/ralph-loop-wrapper.sh && run_with_recovery \"$RALPH_DIR\" $MAX_ITER'"

        echo "✅ Ralph Loop started"
        echo "   Use '$0 attach' to observe"
        echo "   Use '$0 status $RALPH_DIR' to check progress"
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
            echo "═══════════════════════════════════════════════════════════════"
            echo "Log Files:"
            echo "═══════════════════════════════════════════════════════════════"
            ls -lt "$RALPH_DIR/logs" | head -15
            echo ""

            # Show master log (crash recovery events)
            if [ -f "$RALPH_DIR/logs/master.log" ]; then
                echo "═══════════════════════════════════════════════════════════════"
                echo "Master Log (crash recovery events):"
                echo "═══════════════════════════════════════════════════════════════"
                tail -20 "$RALPH_DIR/logs/master.log"
                echo ""
            fi

            # Show session log (continuous output)
            if [ -f "$RALPH_DIR/logs/session-output.log" ]; then
                echo "═══════════════════════════════════════════════════════════════"
                echo "Recent Session Output (last 100 lines):"
                echo "═══════════════════════════════════════════════════════════════"
                tail -100 "$RALPH_DIR/logs/session-output.log"
            else
                echo "═══════════════════════════════════════════════════════════════"
                echo "Latest Iteration Log:"
                echo "═══════════════════════════════════════════════════════════════"
                local latest=$(ls -t "$RALPH_DIR/logs"/iteration-*.log 2>/dev/null | head -1)
                if [ -n "$latest" ]; then
                    tail -50 "$latest"
                else
                    echo "   No iteration logs found"
                fi
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
