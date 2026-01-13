#!/bin/bash
# open-split-claude.sh
# Opens a split terminal in Cursor and starts a new Claude session with the specified prime prompt

FILENAME="$1"
PROMPT_DIR=".claude/data/prime-prompts"
PROMPT_FILE="$PROMPT_DIR/$FILENAME"

# Verify the file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: Prompt file not found: $PROMPT_FILE"
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
    -- Type the command to start Claude with the prime prompt
    keystroke "claude \"\$(cat $PROMPT_FILE)\""
    delay 0.1
    -- Press Enter
    key code 36
end tell
EOF

echo "New Claude session started in split terminal with: $PROMPT_FILE"
