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
