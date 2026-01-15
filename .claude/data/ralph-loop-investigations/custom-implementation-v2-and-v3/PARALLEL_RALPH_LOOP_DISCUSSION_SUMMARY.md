# Parallel Ralph Loop Architecture Discussion

## Summary

This document synthesizes two branches of discussion about implementing parallel Ralph Loops with browser verification for frontend development tasks.

---

## The Core Problem

We want to:
1. Run Ralph Loop iterations for frontend development
2. Use browser verification (Claude for Chrome) to test results
3. Avoid context rot that degrades LLM effectiveness
4. Parallelize across multiple attempts for comparison
5. Maintain clean separation of concerns

---

## Key Constraints Identified

### 1. Browser Tools Availability
- `mcp__claude-in-chrome__*` tools work best in MAIN Claude context
- Subagents CAN call them but results get summarized
- Interactive verification (click → verify → click) is awkward in subagents
- **Implication:** Each parallel worker needs to be a MAIN session, not a subagent

### 2. Context Rot
- Official Ralph plugin: Same session with auto-compact (risk of accumulated confusion)
- Original Ralph method: Fresh session each iteration (files are the memory)
- **Implication:** Fresh sessions preferred for complex frontend work

### 3. Port/Resource Management
- Each worktree running its own dev server needs unique ports
- Multiple Claude sessions = multiple API calls = cost/rate consideration
- **Implication:** Need systematic port assignment and resource awareness

---

## Comparison of Approaches

| Approach | Context Rot | Parallelization | Browser Access | Complexity | Coordination |
|----------|-------------|-----------------|----------------|------------|--------------|
| Official Ralph Plugin | ⚠️ Risk | ❌ Single | ✅ Main context | Low | None |
| Original Ralph (fresh) | ✅ Avoided | ❌ Single | ✅ Main context | Medium | Manual |
| Subagent Loop | ✅ Workers fresh | ⚠️ Sequential | ⚠️ Orchestrator only | Medium | Automated |
| Parallel Worktrees (simple) | ⚠️ Per-instance | ✅ True parallel | ✅ Each has access | Medium | Manual merge |
| **Multi-Layer Orchestrator** | ✅ Fresh per iteration | ✅ True parallel | ✅ Each has access | High | Semi-automated |

---

## Proposed Architecture: Multi-Layer Ralph Swarm

### Layer Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: PLANNING SESSION                         │
│                                                                          │
│  Human + Claude plan the task, create RALPH_PRD.md                      │
│  Output: .claude/data/ralph-loop/RALPH_PRD.md                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     LAYER 2: ORCHESTRATOR SESSION                        │
│                                                                          │
│  /init-parallel-ralph                                                    │
│  1. Create N git worktrees                                               │
│  2. For each worktree:                                                   │
│     - Copy RALPH_PRD.md                                                  │
│     - Modify .env with unique port (5007 + N)                           │
│     - Create progress.md (initialized)                                   │
│     - Create worktree-specific prime prompt                              │
│  3. /continue-t-ralph spawns N parallel Layer 3 sessions                │
│  4. (Optional) Monitor progress files, report status                     │
└─────────────────────────────────────────────────────────────────────────┘
           │                        │                        │
           ▼                        ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   WORKTREE 1    │     │   WORKTREE 2    │     │   WORKTREE 3    │
│   Port: 5007    │     │   Port: 5008    │     │   Port: 5009    │
├─────────────────┤     ├─────────────────┤     ├─────────────────┤
│                 │     │                 │     │                 │
│  LAYER 3        │     │  LAYER 3        │     │  LAYER 3        │
│  Session 1.1    │     │  Session 2.1    │     │  Session 3.1    │
│  ┌───────────┐  │     │  ┌───────────┐  │     │  ┌───────────┐  │
│  │1. Read PRD│  │     │  │1. Read PRD│  │     │  │1. Read PRD│  │
│  │2. Read    │  │     │  │2. Read    │  │     │  │2. Read    │  │
│  │   progress│  │     │  │   progress│  │     │  │   progress│  │
│  │3. Make    │  │     │  │3. Make    │  │     │  │3. Make    │  │
│  │   changes │  │     │  │   changes │  │     │  │   changes │  │
│  │4. Browser │  │     │  │4. Browser │  │     │  │4. Browser │  │
│  │   verify  │  │     │  │   verify  │  │     │  │   verify  │  │
│  │5. Update  │  │     │  │5. Update  │  │     │  │5. Update  │  │
│  │   progress│  │     │  │   progress│  │     │  │   progress│  │
│  │6./continue│  │     │  │6./continue│  │     │  │6./continue│  │
│  │   -t      │  │     │  │   -t      │  │     │  │   -t      │  │
│  └─────┬─────┘  │     │  └─────┬─────┘  │     │  └─────┬─────┘  │
│        │        │     │        │        │     │        │        │
│        ▼        │     │        ▼        │     │        ▼        │
│  Session 1.2    │     │  Session 2.2    │     │  Session 3.2    │
│  (fresh ctx)    │     │  (fresh ctx)    │     │  (fresh ctx)    │
│        │        │     │        │        │     │        │        │
│        ▼        │     │        ▼        │     │        ▼        │
│      ...        │     │      ...        │     │      ...        │
│        │        │     │        │        │     │        │        │
│        ▼        │     │        ▼        │     │        ▼        │
│  COMPLETE.md    │     │  COMPLETE.md    │     │  COMPLETE.md    │
│  (promise met)  │     │  (promise met)  │     │  (promise met)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
           │                        │                        │
           └────────────────────────┼────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      LAYER 4: HUMAN MERGE PHASE                          │
│                                                                          │
│  1. Review COMPLETE.md and final state of each worktree                 │
│  2. Compare implementations (screenshots, code quality, approach)        │
│  3. Select best result or cherry-pick best aspects                       │
│  4. Merge chosen solution back to main branch                            │
│  5. Cleanup worktrees                                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Critique of Multi-Layer Approach

### Strengths

1. **Clean Separation of Concerns**
   - Planning is isolated from execution
   - Each layer has a single responsibility
   - Failures in one worktree don't affect others

2. **Context Rot Eliminated**
   - Fresh session for every iteration via /continue-t
   - Progress.md is the ONLY memory (files, not conversation)
   - Each session reads state, acts, writes state, exits

3. **True Parallelism**
   - N worktrees run simultaneously
   - Natural variation may discover different solutions
   - Can compare approaches and pick best

4. **Full Browser Access**
   - Each Layer 3 session is a MAIN Claude instance
   - Full access to mcp__claude-in-chrome__* tools
   - Can do interactive verification

5. **Resumable**
   - Progress.md captures state
   - If a session fails, can resume from last checkpoint
   - Human can intervene and adjust progress.md

### Weaknesses / Concerns

1. **Complexity Overhead**
   - Three layers of orchestration
   - Multiple new skills to create (/init-parallel-ralph, /continue-t-ralph)
   - More moving parts = more failure modes

2. **Port Management**
   - Each worktree needs unique port for dev server
   - Must modify .env or vite.config for each
   - Browser verification must know correct port
   - **Mitigation:** Systematic port assignment (base_port + worktree_index)

3. **Browser Tab Group Conflicts**
   - Claude for Chrome uses tab groups
   - Multiple sessions may conflict if using same tab group
   - **Mitigation:** Each worktree session creates its own tab group via `tabs_context_mcp(createIfEmpty: true)`

4. **Resource Intensity**
   - N Claude sessions running concurrently
   - N dev servers consuming ports/memory
   - API rate limits if too many parallel calls
   - **Mitigation:** Limit N to 2-3 worktrees initially

5. **Merge Complexity**
   - Parallel implementations may diverge significantly
   - Merge conflicts possible
   - Choosing "best" is subjective
   - **Mitigation:** Use git cherry-pick for specific commits rather than full merge

6. **Prime Prompt Engineering**
   - Each fresh session needs comprehensive prime prompt
   - Must include: PRD, progress state, file paths, verification steps
   - If prime prompt is wrong, session may go off track
   - **Mitigation:** Standardized template, tested before parallelizing

7. **Completion Detection**
   - How does user know when ALL worktrees are done?
   - No automated aggregation
   - **Mitigation:** Each worktree writes COMPLETE.md; user can `ls */COMPLETE.md`

---

## Alternative: Simplified Two-Layer Approach

If the three-layer approach is too complex, consider:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    LAYER 1: PLANNING + INIT SESSION                      │
│                                                                          │
│  1. Human + Claude plan task, create RALPH_PRD.md                       │
│  2. /init-parallel-ralph creates worktrees with PRD + progress.md       │
│  3. User manually runs `claude "$(cat RALPH_PRD.md)"` in each worktree  │
│  4. Each worktree uses standard Ralph plugin OR manual /continue-t      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
          ┌─────────────────────────┼─────────────────────────┐
          ▼                         ▼                         ▼
   [Worktree 1]              [Worktree 2]              [Worktree 3]
   Ralph Loop                Ralph Loop                Ralph Loop
   (independent)             (independent)             (independent)
          │                         │                         │
          └─────────────────────────┼─────────────────────────┘
                                    ▼
                         [Human compares + merges]
```

**Pros:** Simpler, fewer new skills needed, user controls parallelism
**Cons:** More manual coordination, less automated

---

## Recommended Implementation Path

### Phase 1: Validate Single Worktree (This Week)
1. Run Dashboard update as single Ralph Loop
2. Use official plugin OR manual /continue-t iterations
3. Validate browser verification works
4. Document learnings in progress.md format

### Phase 2: Create Parallel Infrastructure (Next)
1. Adapt /init-parallel for Ralph use case
   - Port assignment logic
   - PRD + progress.md templating
   - Worktree-specific .env modification
2. Create /continue-t-ralph variant
   - Includes reading progress.md
   - Includes browser port awareness
3. Test with 2 worktrees on simple task

### Phase 3: Full Multi-Layer (Later)
1. Add Layer 2 orchestrator capabilities
   - Progress monitoring
   - Completion aggregation
   - Optional: Active coordination between worktrees
2. Refine based on learnings from Phase 2

---

## Progress.md Standard Format

```markdown
# Ralph Loop Progress: [TASK_NAME]

## Configuration
- Worktree: worktree-1
- Port: 5007
- PRD: .claude/data/ralph-loop/RALPH_PRD.md
- Max Iterations: 10

## Current State
- Iteration: 3
- Status: in_progress | blocked | complete
- Last Updated: 2024-01-14 15:30

## Completed Criteria
- [x] Old stat cards removed
- [x] Reports section added with leadScraping flag
- [x] Pending Leads preview added

## Remaining Criteria
- [ ] Batch Registration preview
- [ ] Tasks Due Today list
- [ ] Recent Restaurants preview
- [ ] Quick actions updated
- [ ] Browser verification Phase 1
- [ ] Browser verification Phase 2

## Current Blocker
ReportsTabContent not rendering - import path may be incorrect.
Console error: "Cannot find module '../components/reports/ReportsTabContent'"

## Last Verification Result
- Phase 1: PARTIAL (Reports section missing)
- Phase 2: NOT STARTED
- Screenshot: ./screenshots/iteration-3.png

## Next Session Instructions
1. Fix ReportsTabContent import - check if it exports from index.ts
2. Run build to verify no TypeScript errors
3. Browser verify Reports section renders
4. If successful, proceed to Batch Registration preview

## Iteration History
| # | Changes Made | Result | Blocker |
|---|--------------|--------|---------|
| 1 | Removed old stat cards | ✅ Build passes | - |
| 2 | Added Reports section | ❌ Import error | Wrong path |
| 3 | TBD | TBD | TBD |
```

---

## New Skills Required

### /init-parallel-ralph
- Creates N worktrees from current branch
- Copies RALPH_PRD.md to each
- Creates initialized progress.md in each
- Modifies .env in each for unique port
- Returns worktree paths and ports

### /continue-t-ralph (variant of /continue-t)
- Reads progress.md to understand current state
- Generates prime prompt including:
  - Full PRD
  - Current progress state
  - Last blocker and resolution hints
  - Correct port for browser verification
- Spawns new Claude session in split terminal

### /ralph-status (optional)
- Reads progress.md from all worktrees
- Aggregates status into single view
- Shows which are complete, blocked, in-progress

---

## Open Questions for User

1. **Phase 1 Validation:** Should we run the Dashboard task as single Ralph Loop first, or go straight to parallel?

2. **Port Strategy:** Is modifying .env sufficient, or does vite.config need changes too?

3. **Browser Tab Management:** Should each worktree:
   - A) Create its own Chrome tab group (isolated but more resources)
   - B) Share a tab group with separate tabs (less resources, potential conflicts)

4. **Iteration Trigger:** Should the next iteration be triggered by:
   - A) The session itself via /continue-t (fully autonomous)
   - B) A file watcher/script (external trigger)
   - C) Human manually (most control, least automated)

5. **Failure Handling:** If a worktree gets stuck after N iterations:
   - A) Auto-stop and mark as blocked
   - B) Continue until max iterations
   - C) Notify user for intervention

---

## Conclusion

The multi-layer orchestrator approach is architecturally sound and addresses the core constraints (context rot, browser verification, parallelism). However, it introduces significant complexity.

**Recommendation:** Start with Phase 1 (single worktree validation) to prove the Ralph Loop + browser verification pattern works for the Dashboard task. Then incrementally add parallelization.

The investment in /init-parallel-ralph and /continue-t-ralph skills will pay off for future frontend development tasks beyond this Dashboard update.
