#!/usr/bin/env node
/**
 * ralph-pre-tool.js
 * PreToolUse hook for Ralph Loop security
 *
 * Validates bash commands against an allowlist and blocks dangerous operations.
 * Per user clarification: Only validates Bash commands (file access validation excluded)
 *
 * Usage: Configure in .claude/settings.local.json hooks section
 */

// ---------------------------------------------------------------------------
// CONFIGURATION
// ---------------------------------------------------------------------------

const ALLOWED_COMMANDS = new Set([
    // Package managers
    'npm', 'npx', 'yarn', 'pnpm', 'bun',
    // Node/Python
    'node', 'python', 'python3', 'pip', 'pip3',
    // Git
    'git',
    // File operations (safe)
    'ls', 'cat', 'head', 'tail', 'wc', 'find', 'grep', 'mkdir', 'touch', 'cp', 'mv',
    // Text processing
    'jq', 'sed', 'awk', 'sort', 'uniq', 'tr', 'cut',
    // Network (read-only)
    'curl', 'wget',
    // System info
    'pwd', 'whoami', 'date', 'echo', 'printf', 'which', 'type',
    // Claude
    'claude',
    // Build tools
    'make', 'cargo', 'go',
    // Process management
    'pgrep', 'ps', 'sleep', 'timeout',
    // Tmux (for ralph-loop-wrapper)
    'tmux',
    // Source (for bash scripts)
    'source', '.',
    // Bash itself (for running scripts)
    'bash', 'sh',
    // Directory navigation
    'cd', 'pushd', 'popd',
    // Diff tools
    'diff', 'rg',
    // File info
    'file', 'stat', 'test', '[',
    // Archive tools
    'tar', 'zip', 'unzip',
    // Permissions (safe subset)
    'chmod',
]);

const BLOCKED_PATTERNS = [
    /^rm\s+(-rf?|--recursive)?\s*\/(?!Users)/i,  // rm -rf / (allow /Users paths)
    /^sudo\s/i,                                    // Any sudo command
    /^chmod\s+777/i,                               // chmod 777
    /^chown\s+root/i,                              // chown to root
    />\s*\/etc\//i,                                // Write to /etc
    />\s*\/usr\//i,                                // Write to /usr
    /\|\s*sh\s*$/i,                                // Pipe to sh
    /\|\s*bash\s*$/i,                              // Pipe to bash
    /eval\s*\(/i,                                  // eval()
    /`.*`/,                                        // Command substitution (backticks) - be cautious
    /\brm\s+-rf\s+\/\s*$/i,                       // Explicit rm -rf /
    /\brm\s+-rf\s+\/\*\s*$/i,                     // rm -rf /*
    /mkfs\./i,                                     // Format filesystems
    /dd\s+if=.*of=\/dev/i,                        // dd to devices
    /:\(\)\s*\{\s*:\|:&\s*\}\s*;/,                // Fork bomb
];

// ---------------------------------------------------------------------------
// VALIDATION FUNCTIONS
// ---------------------------------------------------------------------------

function extractBaseCommand(command) {
    // Handle common prefixes
    const trimmed = command.trim();

    // Skip environment variables at the start (e.g., FOO=bar command)
    const envVarPattern = /^([A-Z_][A-Z0-9_]*=\S+\s+)*/;
    const withoutEnvVars = trimmed.replace(envVarPattern, '');

    // Get first word (the command)
    const match = withoutEnvVars.match(/^(\S+)/);
    return match ? match[1] : '';
}

function validateBashCommand(command) {
    const baseCommand = extractBaseCommand(command);

    // Check for blocked patterns first (these are always dangerous)
    for (const pattern of BLOCKED_PATTERNS) {
        if (pattern.test(command)) {
            return {
                allowed: false,
                reason: `Command matches blocked pattern: ${pattern}`
            };
        }
    }

    // Check if base command is allowed
    if (!ALLOWED_COMMANDS.has(baseCommand)) {
        return {
            allowed: false,
            reason: `Command '${baseCommand}' is not in the allowlist`
        };
    }

    return { allowed: true };
}

// ---------------------------------------------------------------------------
// MAIN HOOK HANDLER
// ---------------------------------------------------------------------------

async function main() {
    // Read input from stdin
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
    }

    let hookData;
    try {
        hookData = JSON.parse(input);
    } catch (e) {
        // If we can't parse input, allow the operation (fail-open for usability)
        // Output empty object to pass through without blocking
        console.log(JSON.stringify({}));
        return;
    }

    const { tool_name, tool_input } = hookData;

    // ---------------------------------------------------------------------------
    // Validate Bash commands only (per user clarification)
    // ---------------------------------------------------------------------------
    if (tool_name === 'Bash' && tool_input?.command) {
        const result = validateBashCommand(tool_input.command);

        if (!result.allowed) {
            console.error(`[ralph-pre-tool] BLOCKED: ${result.reason}`);
            console.error(`[ralph-pre-tool] Command: ${tool_input.command}`);
            console.log(JSON.stringify({
                decision: 'block',
                reason: result.reason
            }));
            return;
        }
    }

    // ---------------------------------------------------------------------------
    // Allow all other operations (file access validation excluded per user)
    // Output empty object to pass through without blocking
    // ---------------------------------------------------------------------------
    console.log(JSON.stringify({}));
}

main().catch(err => {
    console.error(`[ralph-pre-tool] Error: ${err.message}`);
    // On error, allow the operation (fail-open for usability)
    // Output empty object to pass through without blocking
    console.log(JSON.stringify({}));
});
