#!/usr/bin/env -S uv run --script
# /// script
# requires-python = ">=3.11"
# ///

import json
import sys
from pathlib import Path

# Read input
input_data = json.loads(sys.stdin.read())
session_id = input_data.get('session_id', 'unknown')
prompt = input_data.get('prompt', '')

# Log to file
log_dir = Path(f"logs/{session_id}")
log_dir.mkdir(parents=True, exist_ok=True)
log_file = log_dir / 'user_prompts.json'

# Append prompt
if log_file.exists():
    with open(log_file, 'r') as f:
        prompts = json.load(f)
else:
    prompts = []

prompts.append({
    'timestamp': input_data.get('timestamp'),
    'prompt': prompt
})

with open(log_file, 'w') as f:
    json.dump(prompts, f, indent=2)

sys.exit(0)