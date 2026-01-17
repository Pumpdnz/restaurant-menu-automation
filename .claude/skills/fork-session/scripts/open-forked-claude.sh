#!/bin/bash
# open-split-claude.sh
# Opens a split terminal in Cursor and starts a new Claude session with the specified prime prompt

CLAUDE_SESSION_ID="$1"

# Use AppleScript to split terminal in Cursor and run Claude
osascript <<EOF
tell application "Cursor"
    activate
end tell

delay 0.3

tell application "System Events"
    tell process "Cursor"
        -- Split terminal with Cmd+\ (backslash key code is 42)
        key code 42 using {command down}
    end tell
end tell

delay 0.5

tell application "System Events"
    -- Type the command to start Claude with the resume flag, session id and fork session flag
    keystroke "claude -r $CLAUDE_SESSION_ID --fork-session"
    delay 0.1
    -- Press Enter
    key code 36
end tell
EOF

echo "New fork of $CLAUDE_SESSION_ID Claude session started in split terminal"
