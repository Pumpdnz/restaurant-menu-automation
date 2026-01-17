# Investigation: Bash Loop vs /continue-t Compatibility

## Investigation Goal

Determine whether our `/continue-t` self-triggering pattern can reliably achieve iteration without an external bash loop forcing continuation.

---

## The Core Problem

**Original Ralph:** External bash loop GUARANTEES continuation
**Our approach:** Claude must CHOOSE to call /continue-t

The risk: If Claude forgets, decides not to, or exits without calling /continue-t, the loop stops prematurely.

---

## The Two Patterns

### Original Ralph Pattern (Geoffrey Huntley)
```bash
while :; do
  cat PROMPT.md | claude-code
done
```

**Key characteristics:**
- Infinite bash loop FORCES iteration
- Claude cannot stop the loop - it's external
- Same prompt fed every iteration
- Fresh session each time (new claude-code invocation)
- **Continuation is GUARANTEED by bash, not Claude**

### Our Proposed Pattern (/continue-t)
```
Session 1: Read progress → work → update progress → run /continue-t → exit
Session 2: (FRESH) Read progress → work → update progress → run /continue-t → exit
Session 3: (FRESH) Read progress → work → update progress → ...
```

**Key characteristics:**
- Session triggers next session before exit
- **ALWAYS fresh context** - /continue-t does NOT use --continue flag
- `/continue-t` runs: `claude "$(cat prime-prompt.md)"` - completely new session
- Files (progress.txt, feature_list.json) are the ONLY memory
- Prime prompt provides all context needed for fresh session
- No external loop required
- Self-terminating when promise criteria met

**CRITICAL DISTINCTION:**
The "continue" in `/continue-t` refers to continuing the PROJECT/WORK, NOT continuing a Claude session. Each iteration is a completely fresh Claude session with no conversation history.

---

## Investigation Questions

### Q1: Will Claude reliably call /continue-t? (CRITICAL)

**The core risk:** Our approach depends on Claude CHOOSING to call /continue-t before exiting.

**Failure scenarios:**
1. Claude forgets to call /continue-t
2. Claude decides task is "done enough" and exits
3. Claude encounters an error and exits without continuing
4. Claude gets confused and skips the /continue-t step
5. /continue-t skill fails to spawn new session

**Investigation tasks:**
1. Test: How reliably does Claude follow "run /continue-t before exiting" instructions?
2. Test: Under what conditions does Claude skip the continuation step?
3. Test: What happens if /continue-t script fails?

### Q2: How does original Ralph guarantee continuation? ✅ INVESTIGATED

**Finding:** Original Ralph uses external bash loop with FRESH sessions each iteration. NO `--continue` flag is used.

**Original Ralph Pattern (Confirmed):**
```bash
while :; do
  cat PROMPT.md | claude-code
done
```

**How it works:**
1. External bash `while :;` loop runs indefinitely
2. Each iteration pipes PROMPT.md to a NEW claude-code session
3. Claude runs, does work on ONE task, updates files, exits
4. Bash loop immediately starts another FRESH session
5. New session reads files (progress.txt, feature_list.json) to understand state
6. Files are the ONLY memory between iterations (no conversation context preserved)

**Termination mechanisms (confirmed):**
- **Promise detection:** Claude outputs `<promise>COMPLETE</promise>` when all tasks done
- **Max iterations:** `--max-iterations 30` flag stops after N iterations
- **Manual kill:** User can Ctrl+C the bash loop

**Key insight:** Both original Ralph and our /continue-t use FRESH sessions. The difference is:
- Original Ralph: External bash loop FORCES the next iteration
- Our /continue-t: Claude must CHOOSE to trigger the next iteration

### Q3: What are the tradeoffs?

| Aspect | External Bash Loop | Self-Triggering /continue-t |
|--------|-------------------|----------------------------|
| **Continuation guarantee** | ✅ Guaranteed by bash | ⚠️ Depends on Claude compliance |
| **Termination control** | External (manual/script) | Internal (promise detection) |
| **Iteration autonomy** | Claude has no control | Claude controls continuation |
| **Failure recovery** | Bash restarts anyway | May need external monitoring |
| **Complexity** | Requires bash wrapper | Self-contained |

### Q4: Can we get the best of both?

**Core tradeoff:**
- Original Ralph (bash loop): Deterministic control, but less autonomous
- Our /continue-t: More autonomous, but depends on Claude compliance

**Options to ensure reliable continuation:**

**Option A) Self-triggering /continue-t (OUR CURRENT PLAN) ✅**
- Claude triggers next iteration via /continue-t skill
- Fresh session each time (like original Ralph)
- Self-terminating when promise detected
- Risk: Claude may forget to call /continue-t
- Benefit: Self-contained, no external scripts needed
- **Best for:** Single-process development, simpler setup

**Option B) External bash loop (ORIGINAL RALPH METHOD)**
- External bash loop guarantees continuation
- Claude has no control over iteration - bash forces it
- Fresh session each time
- Termination via promise detection or max iterations
- **Best for:** Guaranteed iteration, when you don't trust self-triggering

**Option C) Hybrid: /continue-t with external watchdog**
- Claude tries to self-trigger via /continue-t
- External watchdog script monitors progress.txt
- If no progress for N minutes, watchdog restarts Claude
- Combines self-management with safety net
- **Best for:** Production use where reliability is critical

**Key difference between A and B:**
| Aspect | Option A (/continue-t) | Option B (Bash Loop) |
|--------|------------------------|---------------------|
| Who controls iteration? | Claude (internal) | Bash (external) |
| Can Claude stop loop? | Yes (by not calling /continue-t) | No (bash forces restart) |
| Termination | Claude outputs promise | Promise OR max iterations |
| Setup complexity | Lower (skill-based) | Higher (bash script) |
| Autonomy | Higher | Lower |
| Determinism | Lower | Higher |

---

## Experiment Design

### Experiment 1: Self-Trigger Reliability Test (CRITICAL)

**Goal:** Test how reliably Claude calls /continue-t when instructed.

```markdown
# Test Prompt

You are in iteration 1 of a test loop.

## Task
1. Create a file called `iteration-1.txt` with content "Iteration 1 complete"
2. Update `progress.txt` to say "Iteration 1 done"
3. Run `/continue-t` to spawn the next iteration

## CRITICAL
You MUST run /continue-t before ending this session. Do not exit without running /continue-t.
```

**Run 5 times and track:**
- Did Claude call /continue-t? (Y/N)
- Did Claude complete the work first? (Y/N)
- Any errors or confusion? (Notes)

**Success criteria:** 5/5 successful /continue-t calls

### Experiment 2: External Bash Loop Test

**Goal:** Verify external bash loop forces continuation regardless of Claude's behavior.

```bash
#!/bin/bash
# test-bash-loop.sh

ITERATION=1
MAX=3

while [ $ITERATION -le $MAX ]; do
  echo "=== Starting iteration $ITERATION ==="

  # Fresh session each time
  claude "You are in iteration $ITERATION. Create file iteration-$ITERATION.txt. Then exit."

  echo "=== Iteration $ITERATION complete ==="
  ITERATION=$((ITERATION + 1))
done

echo "All iterations complete"
```

**Observe:**
- Does bash loop continue even if Claude doesn't cooperate?
- Is each iteration truly a fresh session?
- How does termination work (max iterations)?

### Experiment 3: Failure Scenario Testing

**Goal:** Test what happens when /continue-t fails or Claude doesn't call it.

**Scenario A: Claude forgets /continue-t**
- Give Claude a complex task that distracts from continuation
- Does loop stop?

**Scenario B: /continue-t script fails**
- Temporarily break the script
- Does Claude notice and retry?

**Scenario C: Claude declares premature completion**
- Give Claude an incomplete task with "looks done" state
- Does Claude continue or stop?

### Experiment 4: Hybrid Watchdog Test

**Goal:** Test if external watchdog can recover from self-trigger failures.

```bash
#!/bin/bash
# watchdog.sh

PROGRESS_FILE="progress.txt"
TIMEOUT=300  # 5 minutes
LAST_MOD=$(stat -f %m "$PROGRESS_FILE" 2>/dev/null || echo 0)

while true; do
  sleep 30

  # Check if progress file was updated
  CURRENT_MOD=$(stat -f %m "$PROGRESS_FILE" 2>/dev/null || echo 0)

  if [ "$CURRENT_MOD" = "$LAST_MOD" ]; then
    STALE_TIME=$(($(date +%s) - CURRENT_MOD))
    if [ $STALE_TIME -gt $TIMEOUT ]; then
      echo "WARNING: No progress in $TIMEOUT seconds - restarting"
      # Restart Claude with prime prompt
      claude "$(cat prime-prompt.md)" &
    fi
  else
    LAST_MOD=$CURRENT_MOD
  fi

  # Check for completion
  if grep -q "COMPLETE" "$PROGRESS_FILE"; then
    echo "Task complete!"
    exit 0
  fi
done
```

**Test:** Can watchdog recover from:
- Claude forgetting to self-trigger?
- /continue-t failure?
- Session crash?

---

## Key Differences Analysis

| Aspect | Original Ralph (Bash Loop) | Our /continue-t | Notes |
|--------|---------------------------|-----------------|-------|
| **Session type** | Fresh (new claude-code each iteration) | Fresh (new session via /continue-t) | Same |
| **Context rot** | None (fresh sessions) | None (fresh sessions) | Same |
| **Iteration control** | External (bash forces restart) | Internal (Claude calls /continue-t) | Different |
| **Memory source** | Files (PROMPT.md, progress.txt) | Files (progress.txt, feature_list.json) | Similar |
| **State tracking** | Static PROMPT.md + dynamic files | Dynamic prime prompt + progress files | Similar |
| **Termination** | Promise OR max-iterations | Promise detection | Similar |
| **Continuation guarantee** | ✅ Guaranteed by bash | ⚠️ Depends on Claude compliance | Ralph wins |
| **Autonomy** | Lower (externally controlled) | Higher (self-managing) | /continue-t wins |
| **Setup complexity** | Higher (bash script required) | Lower (skill-based) | /continue-t wins |
| **Anthropic alignment** | Partially (fresh sessions) | Full (init.sh, progress patterns) | /continue-t wins |

**Key Insight:** Both approaches use FRESH sessions - there is no context rot risk in either. The fundamental difference is WHO controls iteration:
- Original Ralph: Bash loop deterministically forces the next iteration
- Our /continue-t: Claude autonomously triggers the next iteration

This is a tradeoff between **determinism** (bash loop) and **autonomy** (/continue-t).

---

## Integration Options

### Option A: Self-Triggering /continue-t ✅ CURRENT PLAN FOR v2

Session triggers next FRESH session via /continue-t skill, no external loop required.

```
Each session:
1. Read progress.txt, feature_list.json (memory from files)
2. Run init.sh to ensure dev server running
3. Run basic E2E test BEFORE new work
4. Work on ONE feature
5. Update files (progress.txt, feature_list.json)
6. Git commit with descriptive message
7. If ALL features pass: output <promise>COMPLETE</promise>
8. If NOT complete: run /continue-t → spawns fresh Claude session
9. Exit
```

**Pros:**
- Always fresh context (no context rot)
- Self-managing (no external loop required)
- Rich state via progress files + feature_list.json
- Aligns with Anthropic patterns (init.sh, progress.txt, feature_list.json)
- Self-terminating when promise detected
- More portable (skill-based, no bash dependency)

**Cons:**
- Relies on Claude compliance to call /continue-t
- If Claude forgets, loop stops prematurely
- No external guarantee of continuation

**Mitigation:** Strong prompting with explicit instructions to ALWAYS run /continue-t before exiting.

---

### Option B: External Bash Loop (ORIGINAL RALPH METHOD)

This is the original Geoffrey Huntley pattern - external bash loop guarantees continuation.

```bash
#!/bin/bash
# ralph-loop.sh - Original Ralph pattern

MAX_ITERATIONS=30
ITERATION=1

while [ $ITERATION -le $MAX_ITERATIONS ]; do
  echo "=== Ralph Loop Iteration $ITERATION ==="

  # Pipe prompt to fresh Claude session
  cat ralph-loop/RALPH_PROMPT.md | claude

  # Check for completion promise in progress.txt
  if grep -q "<promise>COMPLETE</promise>" ralph-loop/progress.txt; then
    echo "✅ Ralph Loop complete! Promise detected."
    break
  fi

  # Check feature_list.json for all passes
  TOTAL=$(jq '.total_features' ralph-loop/feature_list.json)
  PASSED=$(jq '[.features[] | select(.passes == true)] | length' ralph-loop/feature_list.json)

  if [ "$PASSED" -eq "$TOTAL" ]; then
    echo "✅ All $TOTAL features complete!"
    break
  fi

  echo "Progress: $PASSED/$TOTAL features complete"
  ITERATION=$((ITERATION + 1))
done

if [ $ITERATION -gt $MAX_ITERATIONS ]; then
  echo "⚠️ Max iterations ($MAX_ITERATIONS) reached"
fi
```

**Pros:**
- Continuation GUARANTEED by bash (Claude can't stop it)
- Deterministic iteration control
- Max iterations safety built-in
- Proven pattern from Geoffrey Huntley

**Cons:**
- Requires external bash script
- Less autonomous (externally controlled)
- More setup complexity
- Less portable (bash dependency)

**Best for:** When you need guaranteed iteration and don't trust self-triggering.

---

### Option C: Hybrid - /continue-t with External Watchdog

Use /continue-t for autonomous iteration, but external watchdog monitors for failures.

```bash
#!/bin/bash
# watchdog.sh - Monitor Ralph Loop progress

PROGRESS_FILE="ralph-loop/progress.txt"
TIMEOUT=600  # 10 minutes without progress = restart
PRIME_PROMPT="ralph-loop/prime-prompt.md"

# Start first iteration
claude "$(cat $PRIME_PROMPT)" &

while true; do
  sleep 60

  # Check for completion
  if grep -q "<promise>COMPLETE</promise>" "$PROGRESS_FILE"; then
    echo "✅ Ralph Loop complete!"
    exit 0
  fi

  # Check for stalled progress
  LAST_UPDATE=$(stat -f %m "$PROGRESS_FILE" 2>/dev/null || echo 0)
  NOW=$(date +%s)
  STALE_TIME=$((NOW - LAST_UPDATE))

  if [ $STALE_TIME -gt $TIMEOUT ]; then
    echo "⚠️ No progress in ${TIMEOUT}s - restarting Claude"
    # Kill any existing Claude process and restart
    pkill -f "claude" 2>/dev/null
    sleep 2
    claude "$(cat $PRIME_PROMPT)" &
  fi
done
```

**Pros:**
- /continue-t handles normal iteration autonomously
- Watchdog catches failures and restarts
- Best of both worlds: autonomy + safety net
- Can detect stuck loops

**Cons:**
- Two processes to manage
- More complex overall
- Watchdog may restart unnecessarily during long operations

**Best for:** Production use where reliability is critical.

---

## Recommendation Framework

After investigation, choose based on these criteria:

| Criterion | Weight | Favors |
|-----------|--------|--------|
| Context rot prevention | High | Fresh sessions |
| Simplicity | Medium | Bash loop |
| Anthropic alignment | High | Our patterns |
| Reliability | High | Tested approach |
| Portability | Medium | /continue-t |

---

## Next Steps

### Immediate: Implement v2 (Single Process /continue-t)

1. **Proceed with Phase 1 implementation** using Option A (/continue-t self-triggering)
2. Create `/plan-parallel-investigation-ralph` command
3. Create `/plan-ralph-loop` skill with templates
4. Test single instance Ralph Loop on Dashboard task
5. Iterate based on findings

### Future Exploration (After v2 Validated)

1. **Original bash loop method (Option B)**
   - May provide more deterministic control
   - Worth testing if /continue-t proves unreliable

2. **mprocs for parallelization**
   - Investigate for Phase 2 parallel worktrees
   - May provide better visibility than manual terminal management

3. **Ralph Orchestrator framework**
   - https://github.com/mikeyobrien/ralph-orchestrator
   - Pre-built orchestration that may solve problems we haven't discovered yet
   - Worth evaluating after we understand our own requirements better

---

## Resources for Future Reference

- [x] Geoffrey Huntley's Ralph blog: https://ghuntley.com/ralph/ (INVESTIGATED)
- [ ] Ralph Orchestrator: https://github.com/mikeyobrien/ralph-orchestrator (FUTURE)
- [ ] mprocs: Process manager for parallel execution (FUTURE - Phase 2)
- [x] Anthropic's Long-Running Agents Guide (INVESTIGATED - see RECOMMENDATIONS_ANTHROPIC_PATTERNS.md)

---

## Investigation Status

### Completed ✅

- [x] Q1: Self-trigger reliability - IDENTIFIED AS KEY RISK (will validate during v2 implementation)
- [x] Q2: Original Ralph continuation mechanism - CONFIRMED: External bash loop, fresh sessions, no --continue flag
- [x] Q3: Tradeoffs analysis - DOCUMENTED: Determinism vs Autonomy tradeoff
- [x] Q4: Best-of-both-worlds options - DOCUMENTED: Three options (A, B, C) with clear tradeoffs

### Decision Made ✅

**Proceeding with Option A: Self-triggering /continue-t for v2 implementation**

Rationale:
- Aligns with Anthropic patterns
- More autonomous and self-contained
- Lower setup complexity
- Self-trigger reliability will be validated during implementation
- Can fall back to Option B (bash loop) if /continue-t proves unreliable

### Deferred to Future Exploration

- [ ] Experiment 1: Self-trigger reliability test - WILL VALIDATE DURING v2 IMPLEMENTATION
- [ ] Experiment 2: External bash loop comparison - FUTURE EXPLORATION
- [ ] Experiment 3: Failure scenario testing - FUTURE EXPLORATION
- [ ] Experiment 4: Hybrid watchdog test - FUTURE EXPLORATION (Option C)
- [ ] mprocs integration - PHASE 2
- [ ] Ralph Orchestrator evaluation - FUTURE EXPLORATION
