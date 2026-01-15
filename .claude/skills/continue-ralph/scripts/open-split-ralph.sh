#!/bin/bash
# open-split-ralph.sh
# Opens a split terminal in Cursor and starts a new Claude session with the RALPH_PROMPT.md

RALPH_LOOP_PATH="$1"
PROMPT_FILE="$RALPH_LOOP_PATH/RALPH_PROMPT.md"

# Verify the file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: RALPH_PROMPT.md not found at: $PROMPT_FILE"
    exit 1
fi

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
    -- Type the command to start Claude with the RALPH_PROMPT.md
    keystroke "claude \"\$(cat $PROMPT_FILE)\""
    delay 0.1
    -- Press Enter
    key code 36
end tell
EOF

echo "New Ralph Loop session started in split terminal with: $PROMPT_FILE"
