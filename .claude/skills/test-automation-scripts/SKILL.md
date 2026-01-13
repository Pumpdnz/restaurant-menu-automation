---
name: testing-automation-scripts
description: Test Playwright automation scripts by executing them with arguments and validating exit codes, stdout/stderr output patterns. Use when user wants to verify script changes work correctly, test error handling, validate exit codes, or check output patterns match expected behavior.
context: fork
---

# Testing Automation Scripts

**IMPORTANT: When invoked with test scenarios or script details, IMMEDIATELY execute the tests using bash. Do NOT ask for more information if the user has provided script path, arguments, and expected outcomes.**

## Immediate Action Required

If the user has provided ANY of the following, EXECUTE THE TESTS NOW:
- Script path
- Script arguments
- Test scenarios with expected outcomes

Use this command pattern to run each test:

```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation
HEADLESS=true node <script_path> <arguments> 2>&1; echo "EXIT_CODE: $?"
```

For headed tests (manual browser interaction):
```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation
HEADLESS=false node <script_path> <arguments> 2>&1; echo "EXIT_CODE: $?"
```

## Test Execution Workflow

1. **Parse the user's input** for script path, arguments, and expected outcomes
2. **Run each test scenario** using bash commands
3. **Capture exit code and output**
4. **Report results** in the format below

## Only Ask Questions If

- No script path is provided
- No test scenarios are described
- Critical information is genuinely missing

## Required Information (only ask if not provided)

| Parameter | Description | Example |
|-----------|-------------|---------|
| SCRIPT_PATH | Path to the script to test | `scripts/restaurant-registration/import-csv-menu.js` |
| SCRIPT_ARGS | Arguments to pass to the script | `--email test@example.com --csv-path /path/to/file.csv` |
| EXPECTED_EXIT_CODE | Expected exit code (0=success, 1=failure) | `1` |
| EXPECTED_PATTERNS | Stdout/stderr patterns to validate | `["❌ CSV IMPORT FAILED", "process.exit(1)"]` |
| UNEXPECTED_PATTERNS | Patterns that should NOT appear | `["✅ CSV IMPORT PROCESS COMPLETED"]` |
| TEST_SCENARIO | Description of what's being tested | `"Testing failure when CloudWaitress rejects import"` |

## Workflow

### Step 1: Prepare Test Environment

1. Verify the script exists at SCRIPT_PATH
2. Confirm required environment variables are set (check `.env` files)
3. Identify any test fixtures or mock data needed

### Step 2: Execute Script with Helper

Use the test runner script to execute and capture all output:

```bash
node .claude/skills/test-automation-scripts/scripts/run-and-validate.js \
  --script "SCRIPT_PATH" \
  --args "SCRIPT_ARGS" \
  --expected-exit-code EXPECTED_EXIT_CODE \
  --expected-patterns "pattern1" "pattern2" \
  --unexpected-patterns "pattern3"
```

Or execute directly and capture output manually:

```bash
cd /Users/giannimunro/Desktop/cursor-projects/automation
node SCRIPT_PATH SCRIPT_ARGS 2>&1; echo "EXIT_CODE: $?"
```

### Step 3: Validate Results

Check the following:

1. **Exit Code**: Does it match EXPECTED_EXIT_CODE?
2. **Expected Patterns**: Are all EXPECTED_PATTERNS found in stdout/stderr?
3. **Unexpected Patterns**: Are UNEXPECTED_PATTERNS absent from output?
4. **Error Messages**: Are error messages clear and actionable?

### Step 4: Report Results

Provide a clear test report:

```
## Test Results: [TEST_SCENARIO]

**Script:** SCRIPT_PATH
**Arguments:** SCRIPT_ARGS

### Exit Code
- Expected: EXPECTED_EXIT_CODE
- Actual: [actual exit code]
- Status: ✅ PASS / ❌ FAIL

### Output Patterns
| Pattern | Expected | Found | Status |
|---------|----------|-------|--------|
| pattern1 | Present | Yes/No | ✅/❌ |
| pattern2 | Present | Yes/No | ✅/❌ |
| pattern3 | Absent | Yes/No | ✅/❌ |

### Conclusion
[Summary of test outcome and any issues found]
```

## Common Test Scenarios

### Testing Error Exit Codes

For scripts that should exit with code 1 on failure:

```bash
# Run with invalid/missing arguments to trigger failure path
node scripts/restaurant-registration/import-csv-menu.js \
  --email invalid@test.com \
  --csv-path /nonexistent/file.csv

# Check exit code
echo "Exit code: $?"
```

Expected:
- Exit code: 1
- Output contains: `❌` and `FAILED`

### Testing Success Paths

For scripts that should exit with code 0 on success:

```bash
# Run with valid arguments
node scripts/restaurant-registration/import-csv-menu.js \
  --email valid@test.com \
  --csv-path /valid/file.csv

# Check exit code
echo "Exit code: $?"
```

Expected:
- Exit code: 0
- Output contains: `✅` and `completed` or `success`

### Testing Timeout Behavior

```bash
# Run with timeout to test long-running script handling
timeout 30 node scripts/some-script.js --args || echo "Timed out or failed with code: $?"
```

## Playwright-Specific Considerations

### Headless vs Headed Mode

Most scripts respect `HEADLESS=true` environment variable:

```bash
HEADLESS=true node scripts/restaurant-registration/import-csv-menu.js ...
```

### Screenshot Capture

Scripts typically save screenshots to `SCREENSHOT_DIR`. Check for:
- Error screenshots: `error-*.png`
- Success screenshots: `*-complete.png`

### Browser Cleanup

If a test fails mid-execution, ensure browsers are closed:

```bash
pkill -f "chromium" || true
pkill -f "playwright" || true
```

## Troubleshooting

### Script Hangs

If script doesn't exit:
1. Check for `await new Promise(() => {})` patterns (infinite wait)
2. Look for DEBUG_MODE flags that keep browser open
3. Use timeout wrapper: `timeout 60 node script.js`

### Missing Environment Variables

Scripts in `scripts/restaurant-registration/` need:
- `ADMIN_PASSWORD` - Admin portal password
- `HEADLESS` - true/false for browser visibility
- `DEBUG_MODE` - true/false for debug output

Check `scripts/restaurant-registration/.env` for required variables.
