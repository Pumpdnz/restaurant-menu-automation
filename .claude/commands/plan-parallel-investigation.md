---
description: Create a plan for investigating a specific feature with parallel subagents
argument-hint: [path-to-project-docs]
---

# Plan Parallel Investigation

Follow the `Workflow` to create the planning document within the `PATH_TO_PROJECT_DOCS` folder, then `Report` your understanding and next steps to the user

## Variables

PATH_TO_PROJECT_DOCS: $ARGUMENTS
USER_PROMPT: $ARGUMENTS

## Workflow

- If no `PATH_TO_PROJECT_DOCS` is provided, STOP immediately and ask the user to provide it.
- If no `USER_PROMPT` is provided, STOP immediately and ask the user to provide it.
- IMPORTANT: If the `USER_PROMPT` includes any specific instructions, follow these instructions before writing the plan
- Consider the purpose of the investigation that the `USER_PROMPT` specifies and consider any known information provided.
- Ultrathink about what additional information about the current codebase would be required to gather before having the necessary context to be able to write an implementation plan.
- Consider the available tools in your system prompt which would be able to be used to investigate each piece of missing information. 
- If the `USER_PROMPT` does not contain sufficient infomration about what has already been implemented, complete an initial investigation of the current codebase or STOP and ask questions before continuing.
- Once you have a clear understanding of the current situation and desired end result, create an investigation plan document within the `PATH_TO_PROJECT_DOCS` folder, following the `plan_structure_template` guide below. If no folder currently exists at this path, create it first. Use your own initiative to include as many relevant `subagent_n_instructions` sections as necessary. 
- When writing the investigation plan, consider all aspects of the current system which need to be investigated further and break these up into distinct tasks for subagents to be able to complete in parallel. 
- IMPORTANT: The next session of Claude will read the document you create and actually execute the investigation, so make sure you include context on the purpose of the current investigation and clear instructions to spin up multiple subagents in parallel to complete each investigation task 

<plan_structure_template>
# Investigation Plan Overview 
Details of the purpose of the current investigation

## Known Information
Any known information about the current system, provided from one or more of the following sources:
- In the `USER_PROMPT` 
- From your optional initial investigation of the current codebase
- From user provided answers to your optional clarification questions

## Instructions
Detailed instructions for the next instance of Claude Code to follow.
- Include specific instructions to use the Task tool to spin up n number of subagents to investigate each `subagent_n_instructions` section in parallel.
- Include specific instructions to prompt each subagent to only investigate, not change code,and to create an investigation document in the `PATH_TO_PROJECT_DOCS` folder as it's deliverable.
- Include instructions to read all files once the subagents have completed their work and then report the findings to the user

## subagent_1_instructions
- Context
- Instructions
- Deliverable (INVESTIGATION_TASK_1.md)
- Report

## subagent_2_instructions
- Context
- Instructions
- Deliverable (INVESTIGATION_TASK_2.md)
- Report

## subagent_3_instructions
- Context
- Instructions
- Deliverable (INVESTIGATION_TASK_3.md)
- Report

...etc
</plan_structure_template>

## Report

- Provide a concise report to user:
- Summarise your understanding of the overview of the current project and purpose of the investigation.
- Report the purpose of each subagent investigation task. 
- Create an easily copy and pasteable prompt for the user to give to the next session of Claude Code, summarising the project and purpose of the investigation and instructions to read the investigation plan file and execute the investigation