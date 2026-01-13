/prime .claude/skills/continue-session

## Context: Continue-Session Skill - Agent SDK Exploration

We're developing a `/continue-session` skill that generates prime prompts for continuing projects in new Claude sessions. Session 8 successfully implemented a session ID capture approach that works reliably from both CLI and IDE contexts.

### Previous Sessions Summary
- Session 7: Created the initial `/continue-session` skill with AppleScript-based terminal splitting (fragile, unreliable in IDE)
- Session 8: Implemented session ID capture approach - Claude runs in print mode, captures session_id from JSON response, copies `claude --resume {id}` to clipboard. This works reliably.

---

## Task for Session 9: Explore Agent SDK Alternatives

### Background
The current approach works well but requires the user to:
1. Wait for the print-mode session to complete
2. Manually open a new terminal
3. Paste the resume command

### Goal
Explore whether the Claude Agent SDK can provide a more seamless experience by:
- Spawning interactive Claude sessions programmatically
- Handling session handoff without user intervention
- Potentially running in a way that directly starts an interactive session

### Areas to Investigate

1. **Agent SDK Documentation**
   - Check if SDK allows spawning interactive (non-print) sessions
   - Look for session management capabilities
   - Investigate if there's a way to "transfer" to a new interactive session

2. **Alternative Approaches**
   - Could we use the SDK to create a wrapper that starts interactive mode after priming?
   - Is there a `--fork-session` or similar flag that could help?
   - Can we combine print mode priming with automatic interactive resume?

3. **SDK Installation & Setup**
   - What's required to use the Agent SDK?
   - Is it a Node.js package? Python?
   - What are the minimal requirements?

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `.claude/skills/continue-session/SKILL.md` | Skill definition with current workflow |
| `.claude/skills/continue-session/scripts/prime-session.sh` | Current working script using session ID capture |
| `.claude/skills/continue-session-terminal/` | Backup skill using AppleScript approach |

---

## Notes
- The current session ID approach is solid and reliable - keep it as the default
- Agent SDK exploration is about finding potential improvements, not replacing what works
- The `--resume` flag works perfectly with captured session IDs
- `claude -p --output-format json` returns `session_id` in the response
- Consider if SDK complexity is worth the potential UX improvement
