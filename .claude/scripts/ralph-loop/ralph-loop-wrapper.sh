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
