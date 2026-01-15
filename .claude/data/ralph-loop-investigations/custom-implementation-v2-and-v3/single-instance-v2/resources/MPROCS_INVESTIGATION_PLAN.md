# mprocs Investigation Plan

## Purpose

Evaluate `mprocs` as a tool for managing parallel Ralph Loop execution across multiple git worktrees. Determine if it provides benefits over manual terminal management.

---

## Background

### Current Parallel Execution Approach

Without mprocs, parallel Ralph Loops require:
1. Opening multiple terminal windows/panes manually
2. Starting each Claude session manually
3. Switching between terminals to monitor progress
4. No unified view of all parallel executions

### What is mprocs?

`mprocs` is a terminal multiplexer designed for running multiple processes in parallel with a unified TUI (Terminal User Interface). Unlike tmux/screen, it's optimized for:
- Running predefined process groups
- Visual monitoring of multiple processes
- Easy process restart/stop
- Configuration via YAML

**GitHub:** https://github.com/pvolok/mprocs

---

## Investigation Questions

### Q1: Installation and Basic Usage
- How to install mprocs (brew, cargo, etc.)?
- What's the basic configuration structure?
- How to start/stop individual processes?
- How to view logs from each process?

### Q2: Claude Session Management
- Can mprocs spawn Claude CLI sessions?
- Can it pass the prime prompt content to Claude?
- How does it handle interactive sessions vs background processes?
- Can Claude's output be captured/logged?

### Q3: Multi-Worktree Coordination
- Can mprocs change directory per process?
- Can it set environment variables per process?
- How to configure port-specific settings for each worktree?
- Can processes be started sequentially or only in parallel?

### Q4: Monitoring and Control
- Can we see real-time output from all Ralph sessions?
- Can we restart a stuck session without affecting others?
- Is there a way to detect session completion?
- Can mprocs trigger actions on process exit?

### Q5: Integration with /continue-t Pattern
- How does mprocs interact with processes that spawn new processes?
- When a Claude session runs /continue-t, does mprocs track the new session?
- Do we need a wrapper script to handle the iteration loop?

---

## Investigation Tasks

### Task 1: Install and Explore mprocs

```bash
# Install via Homebrew (macOS)
brew install mprocs

# Or via Cargo (Rust)
cargo install mprocs

# Check version
mprocs --version
```

**Deliverable:** Confirmed installation, version noted

### Task 2: Create Basic Test Configuration

Create a simple mprocs.yaml to test parallel process management:

```yaml
# mprocs-test.yaml
procs:
  server-1:
    cwd: /path/to/project
    shell: "echo 'Starting server 1' && sleep 5 && echo 'Server 1 done'"

  server-2:
    cwd: /path/to/project
    shell: "echo 'Starting server 2' && sleep 3 && echo 'Server 2 done'"

  watcher:
    shell: "echo 'Watching...' && sleep 10"
```

Run with:
```bash
mprocs --config mprocs-test.yaml
```

**Deliverable:** Working test configuration, notes on TUI behavior

### Task 3: Test Claude Session Integration

Test if mprocs can manage Claude CLI sessions:

```yaml
# mprocs-claude-test.yaml
procs:
  claude-1:
    cwd: /path/to/worktree-1
    shell: "claude 'Hello from worktree 1. Please respond and exit.'"

  claude-2:
    cwd: /path/to/worktree-2
    shell: "claude 'Hello from worktree 2. Please respond and exit.'"
```

**Questions to Answer:**
- Does Claude's interactive output display correctly?
- Can we interact with Claude through mprocs?
- What happens when Claude exits?

**Deliverable:** Assessment of Claude + mprocs compatibility

### Task 4: Test with Prime Prompt Pattern

Test passing a prime prompt file to Claude:

```yaml
# mprocs-prime-test.yaml
procs:
  ralph-1:
    cwd: /path/to/worktree-1
    shell: "claude \"$(cat .claude/data/prime-prompts/test-prompt.md)\""

  ralph-2:
    cwd: /path/to/worktree-2
    shell: "claude \"$(cat .claude/data/prime-prompts/test-prompt.md)\""
```

**Questions to Answer:**
- Does the prime prompt content pass correctly?
- Any issues with special characters or length?
- Does each session get its own context?

**Deliverable:** Validated prime prompt integration

### Task 5: Test /continue-t Iteration Pattern

The key question: When Claude runs /continue-t (which spawns a NEW terminal), how does mprocs handle it?

**Scenarios to Test:**

1. **Claude exits normally** - Does mprocs detect completion?
2. **Claude spawns new process** - Does mprocs track it?
3. **Manual restart** - Can we restart a Ralph session mid-loop?

**Deliverable:** Understanding of mprocs behavior with process spawning

### Task 6: Evaluate Alternative Approaches

If mprocs doesn't work well with /continue-t, consider:

1. **Wrapper Script Approach:**
   ```bash
   # ralph-loop-wrapper.sh
   MAX_ITERATIONS=10
   ITERATION=0

   while [ $ITERATION -lt $MAX_ITERATIONS ]; do
     claude "$(cat .claude/data/prime-prompts/ralph-iter.md)"

     # Check if COMPLETE file exists
     if [ -f "ralph-loop/COMPLETE" ]; then
       echo "Ralph Loop completed!"
       break
     fi

     ITERATION=$((ITERATION + 1))
   done
   ```

   Then mprocs manages the wrapper script, not Claude directly.

2. **mprocs + File Watcher:**
   Use mprocs for dev servers and monitoring, but handle Claude iteration separately.

**Deliverable:** Recommendation on best approach

---

## Expected mprocs Configuration for Ralph

Based on investigation, draft configuration:

```yaml
# ralph-parallel.yaml (DRAFT - to be refined)

procs:
  # Dev servers (long-running)
  dev-server-1:
    cwd: ./trees/task-1/UberEats-Image-Extractor
    shell: "npm run dev -- --port 5008"

  dev-server-2:
    cwd: ./trees/task-2/UberEats-Image-Extractor
    shell: "npm run dev -- --port 5009"

  # Ralph Loop wrappers (iterative)
  ralph-1:
    cwd: ./trees/task-1
    shell: "./ralph-loop/run-ralph.sh"
    # OR direct: claude "$(cat .claude/data/prime-prompts/ralph-1.md)"

  ralph-2:
    cwd: ./trees/task-2
    shell: "./ralph-loop/run-ralph.sh"

  # Status monitor (optional)
  status:
    shell: "watch -n 5 'cat trees/*/ralph-loop/progress.txt | head -20'"
```

---

## Success Criteria for Investigation

### mprocs is VIABLE if:
- [ ] Can spawn multiple Claude sessions in parallel
- [ ] Each session can read from worktree-specific prime prompts
- [ ] TUI provides useful visibility into all sessions
- [ ] Can restart individual sessions without affecting others
- [ ] Works with wrapper script approach for iteration loop

### mprocs is NOT VIABLE if:
- [ ] Cannot handle Claude's interactive nature
- [ ] Process spawning (/continue-t) breaks mprocs tracking
- [ ] No significant benefit over manual terminal management
- [ ] Complex configuration negates simplicity gains

---

## Timeline

| Task | Estimated Time |
|------|----------------|
| Task 1: Install | 5 min |
| Task 2: Basic test | 15 min |
| Task 3: Claude test | 20 min |
| Task 4: Prime prompt test | 15 min |
| Task 5: Iteration test | 30 min |
| Task 6: Alternatives | 20 min |
| **Total** | ~2 hours |

---

## Deliverables

1. `MPROCS_INVESTIGATION_RESULTS.md` - Full findings
2. `ralph-parallel.yaml` - Working configuration (if viable)
3. `run-ralph.sh` - Wrapper script template (if needed)
4. Recommendation: Use mprocs / Don't use mprocs / Modified approach

---

## Next Steps After Investigation

If mprocs is viable:
- Integrate into Phase 2 Step 2.4 of the roadmap
- Update `/init-parallel-ralph` to generate mprocs.yaml
- Document mprocs usage in skill instructions

If mprocs is not viable:
- Document why
- Recommend alternative (manual terminals, tmux, etc.)
- Update roadmap accordingly
