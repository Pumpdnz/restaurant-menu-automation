---
description: Read the documentation and planning files to gather an understanding of the current project
argument-hint: [path-to-project-docs]
allowed-tools: Read, Write, Bash
---

# Prime

Follow the `Workflow` to read the files within the `PATH_TO_PROJECT_DOCS` folder, then `Report` your understanding to the user

## Variables

PATH_TO_PROJECT_DOCS: $ARGUMENTS
USER_PROMPT: $ARGUMENTS

## Workflow

- If no `PATH_TO_PROJECT_DOCS` is provided, STOP immediately and ask the user to provide it.
- List the files in the `PATH_TO_PROJECT_DOCS` folder and read all files.
- Use ultrathink to consider the content of the documentation and planning files. If provided, consider the `USER_PROMPT` in relation to the content of the files you've read.
- If the next step of the project references files outside of the `PATH_TO_PROJECT_DOCS` folder, read these files too.
- IMPORTANT: If the `USER_PROMPT` includes any further instructions, follow these instructions after completing the above steps

## Report

- Provide a concise report to user:
- Summarise your understanding of the overview of the current project.
- Report your understanding of the current status of the project.
- Summarise what has been completed and what remains to be done.
- Suggest the next steps required for implementation of the next phase.