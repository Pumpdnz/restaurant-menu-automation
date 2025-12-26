---
description: Create a prompt for the user to continue this project in the next session
---

# Write Prime Prompt

To avoid running into context length limits, the user needs to continue this project in a new session. They need you to respond with a prompt that they can copy and paste into the next session. 

Begin the prompt with the "/prime" command and a path to the folder containing the project-specific documentation.

The "/prime" command uses an argument for "path-to-project-docs" and an argument for the "USER_PROMPT".

If this session was focused on implementation, then the "path-to-project-docs" for your prompt is typically the same path that the user provided you with at the beginning of this session.

If this session was primary focused on investigation, documentation and planning, then the "path-to-project-docs" for your prompt will be the relative path to the parent folder of the documentation files you've been creating.

The "USER_PROMPT" you write should provide comprehensive context on the current project and explain next steps.

If one or more specific problems have been identified and not yet solved, then you should include specific file paths in the "USER_PROMPT" for the next session to investigate. 