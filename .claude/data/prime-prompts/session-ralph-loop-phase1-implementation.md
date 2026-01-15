/prime .claude/data/ralph-loop-investigations/custom-implementation-v2-and-v3/

## Context: Ralph Loop System - Phase 1 Implementation

Building a highly effective Ralph Loop system with fresh sessions per iteration, browser verification via Claude for Chrome, and file-based progress tracking.

### Previous Sessions Summary
- Designed multi-layer Ralph Loop architecture
- Investigated original Ralph bash loop vs /continue-t pattern
- Reviewed Anthropic's official guidance on long-running agents
- Created comprehensive implementation roadmap
- Decision: Proceed with /continue-t pattern for v2 implementation

---

## Tasks for This Session

### Task 1: Create `/plan-parallel-investigation-ralph` Command

**What:** Adapt the existing `/plan-parallel-investigation` command for Ralph Loop planning.

**Source file:** `.claude/commands/plan-parallel-investigation.md`

**Target file:** `.claude/commands/plan-parallel-investigation-ralph.md`

**Changes to implement:**
1. Add `AskUserQuestion()` step to refine understanding of:
   - Testing and validation requirements
   - Success criteria and acceptance tests
   - Browser verification needs
   - Feature flag considerations

2. Enhance plan template with new sections:
   - Testing & Validation Requirements
   - Success Criteria
   - Feature categories (functional, UI, integration)

3. Add prime prompt generation step

4. Add `/continue-t` execution at the end

**Reference:** Roadmap Step 1.1 in `RALPH_LOOP_IMPLEMENTATION_ROADMAP.md`

### Task 2: Create `/plan-ralph-loop` Skill Structure

**What:** Create the skill directory structure and SKILL.md for orchestrating Ralph Loop setup.

**Target structure:**
```
.claude/skills/plan-ralph-loop/
├── SKILL.md
├── templates/
│   ├── progress.txt.template
│   ├── RALPH_PROMPT.md.template
│   ├── feature_list.json.template
│   └── init.sh.template
└── testing-methods/
    └── frontend/
        └── claude_in_chrome.md
```

**Reference:** Roadmap Step 1.2 templates in `RALPH_LOOP_IMPLEMENTATION_ROADMAP.md`

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/data/ralph-loop-investigations/custom-implementation-v2-and-v3/RALPH_LOOP_IMPLEMENTATION_ROADMAP.md` | Full implementation roadmap with templates |
| `.claude/commands/plan-parallel-investigation.md` | Source command to adapt |
| `.claude/skills/continue-t/SKILL.md` | Reference for /continue-t integration |

---

## Anthropic Patterns to Follow

From the official guidance:

1. **Use JSON for feature list** - Claude is less likely to modify JSON inappropriately
2. **One feature per iteration** - Critical for managing scope
3. **Basic E2E test BEFORE new work** - Catch broken state early
4. **Clean state on exit** - Code ready for next developer/iteration
5. **init.sh script** - Environment setup each session

---

## Notes

- The roadmap contains full template content - copy from there
- Prioritize getting the structure right over perfection
- Test with a simple task before using for Dashboard update
- The `/plan-ralph-loop` skill will generate all Ralph Loop files from investigation findings
