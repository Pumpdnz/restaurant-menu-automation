#!/usr/bin/env node
/**
 * Run and Validate Automation Script
 *
 * Executes a script with given arguments and validates:
 * - Exit code matches expected
 * - Expected patterns are found in output
 * - Unexpected patterns are NOT found in output
 *
 * Usage:
 *   node run-and-validate.js \
 *     --script "path/to/script.js" \
 *     --args "--email test@test.com --csv /path/file.csv" \
 *     --expected-exit-code 1 \
 *     --expected-patterns "FAILED" "error" \
 *     --unexpected-patterns "SUCCESS" "completed"
 */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '../../../..');

// Parse command line arguments
function parseArgs(args) {
  const result = {
    script: null,
    args: '',
    expectedExitCode: 0,
    expectedPatterns: [],
    unexpectedPatterns: [],
    timeout: 120000, // 2 minutes default
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--script':
        result.script = args[++i];
        break;
      case '--args':
        result.args = args[++i] || '';
        break;
      case '--expected-exit-code':
        result.expectedExitCode = parseInt(args[++i], 10);
        break;
      case '--expected-patterns':
        // Collect all following args until next flag
        while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          result.expectedPatterns.push(args[++i]);
        }
        break;
      case '--unexpected-patterns':
        // Collect all following args until next flag
        while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
          result.unexpectedPatterns.push(args[++i]);
        }
        break;
      case '--timeout':
        result.timeout = parseInt(args[++i], 10);
        break;
    }
  }

  return result;
}

// Run the script and capture output
async function runScript(scriptPath, scriptArgs, timeout) {
  return new Promise((resolve) => {
    const fullPath = scriptPath.startsWith('/')
      ? scriptPath
      : `${PROJECT_ROOT}/${scriptPath}`;

    console.log(`\n${'='.repeat(60)}`);
    console.log('EXECUTING SCRIPT');
    console.log('='.repeat(60));
    console.log(`Script: ${fullPath}`);
    console.log(`Arguments: ${scriptArgs || '(none)'}`);
    console.log(`Timeout: ${timeout}ms`);
    console.log('='.repeat(60));
    console.log('\n--- SCRIPT OUTPUT START ---\n');

    const args = scriptArgs ? scriptArgs.split(/\s+/).filter(Boolean) : [];
    const child = spawn('node', [fullPath, ...args], {
      cwd: PROJECT_ROOT,
      env: { ...process.env },
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timedOut = false;

    const timeoutId = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
      console.log('\n[TIMEOUT] Script exceeded timeout limit');
    }, timeout);

    child.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('close', (code, signal) => {
      clearTimeout(timeoutId);
      console.log('\n--- SCRIPT OUTPUT END ---\n');

      resolve({
        exitCode: code ?? (signal ? 128 : -1),
        stdout,
        stderr,
        combinedOutput: stdout + stderr,
        timedOut,
        signal,
      });
    });

    child.on('error', (err) => {
      clearTimeout(timeoutId);
      console.error('\n[ERROR] Failed to spawn script:', err.message);
      resolve({
        exitCode: -1,
        stdout,
        stderr: stderr + err.message,
        combinedOutput: stdout + stderr + err.message,
        timedOut: false,
        error: err,
      });
    });
  });
}

// Validate the results
function validateResults(result, config) {
  const report = {
    exitCode: {
      expected: config.expectedExitCode,
      actual: result.exitCode,
      passed: result.exitCode === config.expectedExitCode,
    },
    expectedPatterns: [],
    unexpectedPatterns: [],
    overallPassed: true,
  };

  // Check expected patterns
  for (const pattern of config.expectedPatterns) {
    const found = result.combinedOutput.includes(pattern);
    report.expectedPatterns.push({
      pattern,
      shouldBePresent: true,
      found,
      passed: found,
    });
    if (!found) report.overallPassed = false;
  }

  // Check unexpected patterns
  for (const pattern of config.unexpectedPatterns) {
    const found = result.combinedOutput.includes(pattern);
    report.unexpectedPatterns.push({
      pattern,
      shouldBePresent: false,
      found,
      passed: !found,
    });
    if (found) report.overallPassed = false;
  }

  // Check exit code
  if (!report.exitCode.passed) report.overallPassed = false;

  // Check timeout
  if (result.timedOut) {
    report.timedOut = true;
    report.overallPassed = false;
  }

  return report;
}

// Print the validation report
function printReport(report, config) {
  console.log('='.repeat(60));
  console.log('VALIDATION REPORT');
  console.log('='.repeat(60));

  // Exit code
  const exitIcon = report.exitCode.passed ? '✅' : '❌';
  console.log(`\n${exitIcon} Exit Code`);
  console.log(`   Expected: ${report.exitCode.expected}`);
  console.log(`   Actual:   ${report.exitCode.actual}`);

  // Timeout
  if (report.timedOut) {
    console.log('\n❌ TIMEOUT');
    console.log('   Script exceeded timeout limit and was terminated');
  }

  // Expected patterns
  if (report.expectedPatterns.length > 0) {
    console.log('\nExpected Patterns (should be present):');
    for (const p of report.expectedPatterns) {
      const icon = p.passed ? '✅' : '❌';
      console.log(`   ${icon} "${p.pattern}" - ${p.found ? 'FOUND' : 'NOT FOUND'}`);
    }
  }

  // Unexpected patterns
  if (report.unexpectedPatterns.length > 0) {
    console.log('\nUnexpected Patterns (should NOT be present):');
    for (const p of report.unexpectedPatterns) {
      const icon = p.passed ? '✅' : '❌';
      console.log(`   ${icon} "${p.pattern}" - ${p.found ? 'FOUND (BAD!)' : 'NOT FOUND (GOOD)'}`);
    }
  }

  // Overall result
  console.log('\n' + '='.repeat(60));
  if (report.overallPassed) {
    console.log('✅ OVERALL: ALL VALIDATIONS PASSED');
  } else {
    console.log('❌ OVERALL: SOME VALIDATIONS FAILED');
  }
  console.log('='.repeat(60) + '\n');

  return report.overallPassed;
}

// Main
async function main() {
  const config = parseArgs(process.argv.slice(2));

  if (!config.script) {
    console.error('Usage: node run-and-validate.js --script <path> [options]');
    console.error('\nOptions:');
    console.error('  --script <path>              Path to script to test (required)');
    console.error('  --args <string>              Arguments to pass to script');
    console.error('  --expected-exit-code <n>     Expected exit code (default: 0)');
    console.error('  --expected-patterns <p>...   Patterns that should be in output');
    console.error('  --unexpected-patterns <p>... Patterns that should NOT be in output');
    console.error('  --timeout <ms>               Timeout in milliseconds (default: 120000)');
    process.exit(1);
  }

  // Check script exists
  const fullPath = config.script.startsWith('/')
    ? config.script
    : `${PROJECT_ROOT}/${config.script}`;

  if (!existsSync(fullPath)) {
    console.error(`Error: Script not found: ${fullPath}`);
    process.exit(1);
  }

  // Run the script
  const result = await runScript(config.script, config.args, config.timeout);

  // Validate results
  const report = validateResults(result, config);

  // Print report
  const passed = printReport(report, config);

  // Exit with appropriate code
  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
