# Extensibility Thoughts before testing bash loop implementation for the first time
Before running the test I want to understand how the complete workflow executes from the user's perspective, so I've asked claude to generate 3 files to outline how the process works. While writing this document I've had some interesting thoughts around extensibility and improvements to the system, but I do not want to pollute the context window so I've removed these ideas from the main task of documenting the system.

## Known gaps
- No mechanism for sessions to restart the server when making backend changes 

## Extensibility opportunities
### Planning Phase
#### 1. plan-parallel-investigation-ralph command
- Convert the command to a skill to enable progressive disclosure of additional resources when necessary
Proposed plan-parallel-investigation-ralph skill architecture:
.claude/skills/plan-parallel-investigation-ralph/
├── scripts/
├── templates/
    ├── investigaton_plan_structure_template.md
    └── ...
├──resources/
    ├── codebase-architecture-diagram.md (lookup table)
    ├── ...
    └── database-schema/
        ├── organisations.sql
        ├── restaurants.sql
        ├── registration-jobs.sql
        ├── extractions.sql
        ├── ...
        └── leads.sql
└── SKILL.md

#### 2. plan-ralph-loop skill

1. Enhance the feature_list.json.template file with additional examples as we plan ralph loops for non-frontend changes
- Backend 
- Database
- Automation Scripts Directory 

2. Add new templates to the ralph execution directory for the ralph execution sessions to be better equipped to make accurate changes and debug issues
    - auth-methods-reference.md.template
    - api-routes-reference.md.template
    - ui-styling-patterns-reference.md.template
    - feature-flag-reference.md.template
    - codebase-architecture-reference.md.template
    - rls-policy-reference.md.template
    - database-reference.md.template

3. Add Project-specific documentation for the agent using the skill
    - Auth methods
    - Feature flag documentation
    - Codebase architecture diagram (lookup table)

4. Add additional testing methods documents for the agent using the skill
    - Database changes
    - API changes
    - Service layer changes
    - New feature flags
    - Adding feature flagged features/components with existing feature flags 

### Execution Phase
1. Security features
2. User intervention
3. Model Selection within ralph loop execution phase
4. Custom agents for each session
    - Deterministic assignment based on task
5. Custom subagents within each session
    - Nondeterministic activation triggered based on model's intelligence and used on a per-session basis depending on requirements
    - Deterministic activation by instructions in RALPH_PROMPT.md
6. Packaging tasks into skills
    - "Use the update-status skill to update the {RELATIVE_PATH}/feature_list.json and {RELATIVE_PATH}/progress.txt files"
    - "IF the tests pass, use the commit-ralph skill to commit changes to github"
    - "Use the select
7. Additional tool access
    - MCP tools
    - Custom subagents
        - UI Expert
        - Playwright Expert
    - Skills
8. Build better back pressure options  
- Prebuilt Testing Suite
    - Playwright Scripts for user stories on Frontend
    - Database Scripts
        - Existing RPC functions with known values 
    - API Health Tests

# Current Understanding
Let's say that the user wants to begin planning a new ralph loop for finishing the work on the dashboard updates

## Session 1
I believe that they would begin by starting a new chat with the "/plan-parallel-investigation-ralph" command, including a path to a folder for the investigation docs such as ".claude/data/ralph-loops/dashboard-enhancements/" and then specifying as much detail about the change they want to make as possible as the "USER_PROMPT" variable in the command. The first message would be some thing like the following:

<example-message>
/plan-parallel-investigation-ralph planning/ralph-loops/
# Task:
Update the Dashboard page to display new report and navigation components instead of the current basic ones we created on the first iteration
## Current components
1. Active Restaurants total card (not displaying actual restaurant count for the user's organisation)
2. Total Menus count card (not displaying actual values)
3. Extractions total count (not displaying actual count)
4. Success rate (not displaying actual count)
5. Recent restaurants list (works intermittently)
6. Recent extractions list (works intermittently)
7. Quick actions:
- New Extraction button (navigates to /extractions/new)
- Manage restaurants button (navigates to restaurants page)
- View analytics button (navigates to analytics page that is just a placeholder)
8. Lead Scraping reports (heatmap + city breakdown table in tabs)
These components were recently implemented but there are issues:
- Components are not currently tabbed (both the table and heatmap show at the same time)
- All currently nested within a card titled "City Breakdown" that violates design patterns across the application
- Not wrapped in a feature flag to prevent users without the lead-scraping feature flag from seeing the components

## Desired components:
1. Fix Lead Scraping page reports tab components
- City x cuisine heatmap and the City breakdown table components should be within a tabbed section for the user to toggle between the two views
- Remove from nesting within the card titled "City Breakdown" that violates design patterns across the application
- Wrap in a feature flag to prevent users without the lead-scraping feature flag from seeing the components

2. Recent Pending leads preview (5 most recent leads at step 4 with status "passed")
IMPORTANT: "Pending" leads are defined as leads which are yet to be converted into restaurants but have been "passed" from step 4

3. Recent Batch Registration jobs preview (most recently created registration batch job)

4. Paginated list of tasks due today

5. Recently created restaurants preview table with filter for city

6. Replace "Manage Restaurants" quick action button with "New Restaurant" (navigates directly to /restaurants/new)

7. Replace "Analytics" quick action button with "New Task" (opens existing new task dialog which needs to be imported and wired up on the dashboard page)
- Wrap in tasks and sequences feature flag

## Requirements 
### Components feature flagged appropriately:
- Lead scraping page reports and pending leads preview components wrapped in lead scraping feature flag
- Tasks List wrapped in Tasks and Sequences feature flag
- Recent batch registration jobs preview wrapped in registration batches feature flag
- Recently created restaurants peview does not need to be wrapped in a feature flag

### Move Existing Quick actions buttons to top of page:
- New Extraction button
- Replace Manage Restaurants with \"New Restaurant\" (navigates directly to /restaurants/new)
- Replace Analytics button with \"New Task\" (opens existing new task dialog which needs to be imported and wired up on the dashboard page)

### Remove existing totals components
- Active Restaurants
- Total Menus
- Extractions
- Success rate

### Make the Recent Restaurants and recent extractions previews actually work

## Verification steps:
- Use claude for chrome to navigate to "http://localhost:5007" and {test feature steps}

Please help me design the ralph loop and ask further questions if required
</example-message>

My understanding is that this first session would then use the "/plan-parallel-investigation-ralph" command to:
1. Perform an initial investigation
2. Ask the user questions to refine the investigation plan
3. Create the investigation plan document "planning/ralph-loops/INVESTIGATION_PLAN.md"
4. Generate a prime prompt for the next session
5. Execute the split terminal script:

```bash
bash .claude/skills/continue-t/scripts/open-split-claude.sh "{filename}"
```
Where `{filename}` is the name of the file created (without path, e.g., `session-dashboard-update-investigation.md`).

## Session 2
My understanding is that the next session would be initialised by a split view opening in cursor with with the prime prompt already loaded as the first message

### Parallel investigation execution phase
The session would then read the investigation plan and execute the parallel investigation

```markdown
### Task 1: Execute Parallel Investigation
**Instructions:**
1. Read the investigation plan at `{PATH_TO_PROJECT_DOCS}/INVESTIGATION_PLAN.md`
2. Spin up {N} general-purpose subagents in parallel using the Task tool
3. Each subagent investigates ONE area and creates a deliverable document
4. Wait for all subagents to complete
5. Read all investigation documents and compile findings
```

Then it would create an investigation summary document and initialise the "/plan-ralph-loop" skill to generate the ralph loop configuration documents

```markdown
### Task 2: Report and Continue
**Instructions:**
1. Summarize key findings from all investigation documents
2. Identify any blockers or additional questions
3. Run `/plan-ralph-loop` to generate Ralph Loop configuration from findings
```

### plan-ralph-loop skill execution phase

With the skill initialised, the session would follow these steps:

#### Use the AskUserQuestion() tool to:
1. Confirm Success Criteria
2. Select Testing Method
3. Select Max Iterations (NEW)

#### Create the ralph loop directory at `.claude/data/ralph-loops/{TASK_NAME}/`

#### Generate the Ralph Loop Files:
- `RALPH_PROMPT.md`
- `progress.txt`
- `feature_list.json` 
- `init.sh`

#### Report to the user and offer start
Once the ralph documents have been created, the "plan-ralph-loop" skill would exit and the session would offer to the user to start the loop using the "/continue-ralph" skill

## Ralph Loop execution
Not well understood by user

## Each session's workflow
Not well understood by user

## Ralph Loop orchestration (execution session {N})
Not well understood by user