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
