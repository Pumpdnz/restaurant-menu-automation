# Parallel Ralph Loop Discussion Summary - Branch 1

## Overview

This document synthesizes analysis from two parallel conversation branches exploring **parallel Ralph Loop orchestration patterns** for Claude Code automation.

---

## The Proposed Multi-Layer Orchestrator Architecture

### User's 4-Layer Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 1: PLANNING SESSION                        │
│  - Plans the ralph loop prompt                                      │
│  - Writes main RALPH_PROMPT.md                                      │
│  - Determines task decomposition strategy                           │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: ORCHESTRATOR SESSION                    │
│  - Executes /init-parallel-ralph (create worktrees, ports, envs)    │
│  - Customizes RALPH_PROMPT.md per worktree (variants/approaches)    │
│  - Spawns N parallel sessions via /continue-t-ralph                 │
│  - Monitors progress.md files in each worktree                      │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   LAYER 3:        │ │   LAYER 3:        │ │   LAYER 3:        │
│   WORKTREE-1      │ │   WORKTREE-2      │ │   WORKTREE-3      │
│                   │ │                   │ │                   │
│   Ralph Loop      │ │   Ralph Loop      │ │   Ralph Loop      │
│   Iteration 1     │ │   Iteration 1     │ │   Iteration 1     │
│   ↓               │ │   ↓               │ │   ↓               │
│   /continue-t     │ │   /continue-t     │ │   /continue-t     │
│   ↓               │ │   ↓               │ │   ↓               │
│   Iteration 2     │ │   Iteration 2     │ │   Iteration 2     │
│   ↓               │ │   ↓               │ │   ↓               │
│   ...             │ │   ...             │ │   ...             │
│   ↓               │ │   ↓               │ │   ↓               │
│   <promise>       │ │   <promise>       │ │   <promise>       │
└───────────────────┘ └───────────────────┘ └───────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 4: USER EVALUATION                         │
│  - Reviews output from each worktree                                │
│  - Compares implementation quality                                  │
│  - Selects best result and merges to main branch                    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Critical Constraint: Browser MCP Tools

**From Branch 2 Analysis:**

> Claude for Chrome MCP tools are only available to the MAIN Claude session, not subagents (Task tool).

This is a fundamental constraint that shapes the architecture:

| Session Type | Browser Access | Implication |
|-------------|----------------|-------------|
| Main Session | YES | Can verify UI in browser |
| Task Subagent | NO | Code-only, no visual verification |
| Spawned Session (via /continue-t) | YES | Full MCP access in own terminal |

**Key Insight:** The `/continue-t` approach spawns TRUE separate Claude sessions, not subagents. Each spawned session is a "main session" in its own terminal with full MCP access.

---

## Context Rot vs Fresh Sessions

### Branch 2 Comparison Table

| Approach | Memory Source | Context | Tradeoff |
|----------|---------------|---------|----------|
| Official Plugin | Conversation + Files | Accumulates (summarized) | May lose details, context rot |
| Original Method | Files ONLY | Fresh each iteration | No memory of reasoning, may repeat mistakes |

### Geoffrey Huntley's Insight

> "Files ARE the memory. Claude reads git status, git diff, and the actual code each iteration. The conversation is ephemeral; the code is permanent."

**For frontend work with browser verification**, fresh sessions have an advantage: each iteration starts with a clean mental model and re-verifies from scratch.

---

## Critique of Multi-Layer Orchestrator Approach

### Strengths

1. **True Parallelism**: Each worktree operates independently with its own dev server
2. **No Browser Bottleneck**: Each spawned session has full MCP access
3. **Exploration of Alternatives**: Multiple approaches can be tried simultaneously
4. **Clean Separation**: Each worktree is isolated via git worktrees (no merge conflicts during work)
5. **Fresh Context per Iteration**: Self-spawning via /continue-t prevents context rot
6. **Files as Memory**: Progress tracked in persistent files, not ephemeral conversation

### Weaknesses & Concerns

#### 1. Complexity Overhead
- **3 custom skills needed**: `/init-parallel-ralph`, `/continue-t-ralph`, and progress monitoring
- Risk of over-engineering for tasks that may not need parallelism
- Debugging becomes harder when issues span multiple sessions

#### 2. Resource Consumption
- N worktrees × M iterations = N×M Claude sessions (API costs)
- Multiple dev servers running simultaneously (ports 5008, 5009, 5010...)
- Multiple Chrome tabs for browser verification per session

#### 3. Coordination Challenges
- No inter-worktree communication (by design, but limits collaboration)
- Same bug may be hit in multiple worktrees (wasted effort)
- Orchestrator session (Layer 2) becomes idle while monitoring
- User must manually evaluate and merge (Layer 4)

#### 4. Self-Spawning Complexity
- Each session must correctly spawn its successor
- If `/continue-t` fails, the chain breaks silently
- Progress detection requires reliable file format/parsing
- Max iteration limits must be enforced to prevent runaway loops

#### 5. Port & State Management
- Each worktree needs unique ports (already solved in /init-parallel)
- Dev servers must be started before session begins work
- Browser sessions (cookies, localStorage) may conflict if same domain

---

## Recommendations

### 1. Start Simple: 2-Layer Model First

Before implementing the full 4-layer architecture, validate with a simpler model:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    LAYER 1: ORCHESTRATOR SESSION                    │
│  - /init-parallel-ralph (worktrees + ports + prompts)               │
│  - /continue-t-ralph for each worktree (spawn sessions)             │
│  - Monitor progress.md files                                        │
│  - Report completion to user                                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            ▼                   ▼                   ▼
┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
│   WORKTREE-1      │ │   WORKTREE-2      │ │   WORKTREE-3      │
│   Ralph Loop      │ │   Ralph Loop      │ │   Ralph Loop      │
│   (self-iterate)  │ │   (self-iterate)  │ │   (self-iterate)  │
└───────────────────┘ └───────────────────┘ └───────────────────┘
```

The "planning session" (Layer 1 in original) can be the same session that becomes the orchestrator—or the user can write the prompt themselves.

### 2. Define Clear Progress Protocol

Each worktree needs a standardized `progress.md` format:

```markdown
# Ralph Loop Progress: {worktree-name}

## Status: IN_PROGRESS | COMPLETE | BLOCKED | FAILED

## Current Iteration: 3 / 10 (max)

## Last Updated: 2026-01-13T10:30:00Z

## Iteration Log:
| # | Timestamp | Action | Result |
|---|-----------|--------|--------|
| 1 | 10:00 | Initial implementation | Build failed - missing import |
| 2 | 10:15 | Fixed import, added component | Browser shows blank page |
| 3 | 10:30 | Fixed routing issue | Testing in browser... |

## Current Blockers:
- None

## Completion Criteria Met:
- [x] Build passes
- [x] Dashboard loads
- [ ] All sections visible
- [ ] Feature flags work
- [ ] No console errors

## Promise:
<!-- Written when complete -->
<promise>DASHBOARD UPDATE COMPLETE</promise>
```

### 3. Implement Graceful Chain Continuation

For self-spawning via `/continue-t`, include safeguards:

```bash
# In continue-t-ralph, before spawning:
ITERATION=$(grep "Current Iteration:" progress.md | grep -oE '[0-9]+' | head -1)
MAX_ITER=10

if [ "$ITERATION" -ge "$MAX_ITER" ]; then
  echo "Max iterations reached. Marking as BLOCKED."
  # Update progress.md status to BLOCKED
  exit 0
fi

# Check for COMPLETE status
if grep -q "Status: COMPLETE" progress.md; then
  echo "Ralph loop completed successfully."
  exit 0
fi

# Spawn next iteration
...
```

### 4. Consider Hybrid Browser Verification

Instead of each iteration doing full browser verification:

- **Every iteration**: Code changes + build verification
- **Every 3rd iteration**: Full browser verification
- **Final iteration**: Complete verification checklist

This reduces iteration time while still catching visual bugs.

### 5. Use Worktrees for Different Approaches, Not Just Parallelism

The most powerful use of parallel worktrees isn't just "doing the same thing faster"—it's trying **different implementation approaches**:

| Worktree | Approach |
|----------|----------|
| 1 | Minimal changes to existing Dashboard.jsx |
| 2 | Full rewrite as Dashboard.tsx with new components |
| 3 | Modular approach with dedicated dashboard/ component folder |

This yields better results than 3 identical attempts.

### 6. Orchestrator Monitoring Strategy

The Layer 2 orchestrator should:

1. **Spawn all sessions** (N invocations of /continue-t-ralph)
2. **Enter monitoring loop**:
   ```
   while not all_complete:
     for each worktree:
       read progress.md
       if status == BLOCKED:
         alert user
       if status == COMPLETE:
         mark worktree done
     sleep 30 seconds
   ```
3. **Generate comparison report** when all complete
4. **Provide merge recommendation**

---

## Implementation Priority

### Phase 1: Core Skills (High Priority)

1. **`/init-parallel-ralph`**: Fork of /init-parallel with:
   - Auto-generation of RALPH_PROMPT.md per worktree
   - Dev server startup scripts per worktree
   - Progress.md initialization

2. **`/continue-t-ralph`**: Fork of /continue-t with:
   - Ralph loop prompt injection
   - Iteration counter management
   - Completion/blocker detection

### Phase 2: Orchestration (Medium Priority)

3. **Progress monitoring skill**: Watch progress.md files and report status
4. **Comparison/merge skill**: Analyze outputs from multiple worktrees

### Phase 3: Automation (Lower Priority)

5. **Auto-merge for passing results**: If all criteria met, auto-merge
6. **Slack/webhook notifications**: Alert user when loops complete or block

---

## Open Questions for Further Discussion

1. **Dev Server Lifecycle**: Should each worktree have its own persistent dev server, or start/stop per iteration?

2. **Shared Knowledge**: If worktree-1 finds a critical bug fix, should it be propagated to worktree-2 and worktree-3 mid-loop?

3. **Failure Recovery**: If a session crashes mid-iteration, how does the chain recover?

4. **User Intervention Points**: Should the user be able to pause/guide individual worktrees, or is it fully autonomous until completion?

5. **Cost vs Value**: For a given task, how many parallel worktrees actually provides better outcomes vs just running a single thorough Ralph loop?

---

## Branch 2 Synthesis: "Ralph Swarm" Pattern

Branch 2 proposed a "Ralph Swarm" model that aligns with the multi-layer approach:

```
┌─────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR SESSION                        │
│  1. /init-parallel creates worktrees                            │
│  2. Writes RALPH_PROMPT.md to each worktree                     │
│  3. Spawns Claude sessions via /continue-t                      │
│  4. Monitors progress.md files in each worktree                 │
│  5. When complete: compares, selects best, merges               │
└─────────────────────────────────────────────────────────────────┘
          │                    │                    │
          ▼                    ▼                    ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│  worktree-1   │  │  worktree-2   │  │  worktree-3   │
│  Claude + MCP │  │  Claude + MCP │  │  Claude + MCP │
│  Ralph Loop   │  │  Ralph Loop   │  │  Ralph Loop   │
│  Browser ✓    │  │  Browser ✓    │  │  Browser ✓    │
│  progress.md  │  │  progress.md  │  │  progress.md  │
└───────────────┘  └───────────────┘  └───────────────┘
```

This is essentially the 2-layer simplified model recommended above. The additional "planning session" layer can be merged with the orchestrator for most tasks.

---

## Conclusion

The multi-layer parallel Ralph loop orchestration is **architecturally sound** and addresses the key constraints:
- Full browser access via spawned sessions (not subagents)
- Fresh context per iteration (files as memory)
- True parallelism via git worktrees

**Primary concerns** are:
- Implementation complexity (3 new skills needed)
- Resource consumption (API costs, multiple servers)
- Failure modes in self-spawning chains

**Recommended approach**:
1. Start with 2-layer model (orchestrator + workers)
2. Standardize progress.md protocol
3. Use worktrees for different approaches, not identical attempts
4. Implement graceful termination and monitoring
5. Evaluate cost/value before scaling to more worktrees

---

## Next Steps

1. [ ] Design `/init-parallel-ralph` skill specification
2. [ ] Design `/continue-t-ralph` skill specification
3. [ ] Define progress.md schema and parsing logic
4. [ ] Create prototype with 2 worktrees on simple task
5. [ ] Validate browser MCP access in spawned sessions
6. [ ] Measure iteration times and API costs
7. [ ] Document failure modes and recovery procedures

---

*Document created: 2026-01-13*
*Branch: 1 of parallel discussion*
*Related: See PARALLEL_RALPH_LOOP_DISCUSSION_SUMMARY_BRANCH_2.md for complementary analysis*
