#!/bin/bash
# open-split-claude.sh
# Primes a new Claude session with the specified prompt and copies resume command to clipboard

FILENAME="$1"
PROMPT_DIR=".claude/data/prime-prompts"
PROMPT_FILE="$PROMPT_DIR/$FILENAME"

# Verify the file exists
if [ ! -f "$PROMPT_FILE" ]; then
    echo "Error: Prompt file not found: $PROMPT_FILE"
    exit 1
fi

echo "Priming new Claude session with: $PROMPT_FILE"
echo "This may take a moment..."
echo ""

# Run Claude in print mode to prime the session and capture the session ID
RESULT=$(claude -p "$(cat "$PROMPT_FILE")" --output-format json 2>&1)

# Extract session_id using jq (or fallback to grep/sed if jq not available)
if command -v jq &> /dev/null; then
    SESSION_ID=$(echo "$RESULT" | jq -r '.session_id // empty')
else
    SESSION_ID=$(echo "$RESULT" | grep -o '"session_id":"[^"]*"' | sed 's/"session_id":"//;s/"//')
fi

if [ -z "$SESSION_ID" ]; then
    echo "Error: Failed to capture session ID from Claude response"
    echo "Response: $RESULT"
    exit 1
fi

# Create the resume command
RESUME_CMD="claude --resume $SESSION_ID"

# Copy to clipboard
echo "$RESUME_CMD" | pbcopy

echo "Session primed successfully!"
echo ""
echo "Session ID: $SESSION_ID"
echo ""
echo "Resume command copied to clipboard:"
echo "  $RESUME_CMD"
echo ""
echo "Open a new terminal and paste (Cmd+V) to continue the session."
