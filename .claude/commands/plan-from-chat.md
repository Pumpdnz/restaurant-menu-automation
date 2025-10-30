---
description: Create a plan for making changes to the codebase based on a discussion with the user
argument-hint: [path-to-project-docs]
---

# Plan From Chat

Follow the `Workflow` to create the documentation within the `PATH_TO_PROJECT_DOCS` folder, then `Report` your understanding and next steps to the user

## Variables

PATH_TO_PROJECT_DOCS: $ARGUMENTS
USER_PROMPT: $ARGUMENTS

## Workflow

- If no `PATH_TO_PROJECT_DOCS` is provided, STOP immediately and ask the user to provide it.
- If there has not been a recent discussion with the user about changes to the codebase, STOP immediately and ask the user for more context.
- Use ultrathink to consider the entire previous discussion you've had with the user. If the discussion has involved an investigation of a required change and the user has provided confirmation of the desired approach in the `USER_PROMPT`, continue. If you've suggested multiple approaches and the user has not provided a clear decision of which approach to take, STOP immediately and ask clarification questions before continuing.
- Create all relevant documentation files within the `PATH_TO_PROJECT_DOCS` folder, following the `files_to_create` guide below. If no folder currently exists at this path, create it first. Use your own initiative to create the relevant files as per the project discussed previously with the user.

<files_to_create>
1. api-specification.md (if relevant)
2. database-schema.md (if relevant)
3. service-layer.md (if relevant)
4. ui-components.md (if relevant)
5. {x-feature}-integration.md (if relevant)
6. implementation-roadmap.md (always include)
    - Overview
    - Current Status (Not started - date)
    - Prerequisites (if any)
    - Phase by phase breakdown of implementation plan
    - Checklists for low level tasks within each phase
    - Next steps after implementation (if any)
    - Handoff Summary (for future developers to track progress)
        - What's Done
        - What's Next
        - Notes for next developer
            - Read Reference Files First
            - Review Current Implementation
            - Implementation Order for Additional Features
            - Key Architecture Decisions            
7. architecture.md (always include)
    - High-Level Overview: Human-readable visual map of layers and interaction patterns
    - Directory Structure: Map of key files with locations of relevant code and descriptions
    - Data Flow: Visual map(s) showing how the system passes information between UI components, API layers, Middleware, Backend Services, Database and External Services
    - Individual detailed breakdowns of relevant architecture: Create project-specific sections as needed (i.e., Service Layer Architecture, Error Handling, Security Considerations, Performance Considerations)
    - Integration Points: Detailed documentation of existing systems as needed (Authentication, Database Service, Storage, UI Framework)
    - Testing Strategy
8. README.md (always include)
- Sections to include:
    - Overview
    - Documentation Structure with map to other documentation files
    - Architecture Overview
    - Core Principles
    - Existing UI Patterns (If any)
    - Implementation Location (New Files to create, if any)
    - Quick Start Guide
    - Related Documentation if discovered outside of `PATH_TO_PROJECT_DOCS`
    - Status
    - Next Steps
    - Last Updated (current date)
</files_to_create>

- IMPORTANT: If the `USER_PROMPT` includes any further instructions, follow these instructions after completing the above steps

## Report

- Provide a concise report to user:
- Summarise your understanding of the overview of the current project.
- Report your understanding of the current status of the project.
- Summarise what has been completed and what remains to be done.
- Suggest the next steps required for implementation of the next phase.