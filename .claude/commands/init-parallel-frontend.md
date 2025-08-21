# Initialize parallel git worktree directories for frontend-only development (Corrected)

## Variables
FEATURE_NAME: $ARGUMENTS
NUMBER_OF_PARALLEL_WORKTREES: $ARGUMENTS

## Execute these commands
> Execute the loop in parallel with the Batch and Task tool

### IMPORTANT: Use absolute paths to avoid directory navigation issues

**PROJECT_ROOT**: Get current working directory with `pwd` first, then use absolute paths throughout

- create a new dir `PROJECT_ROOT/trees/`
- for i in NUMBER_OF_PARALLEL_WORKTREES
  - RUN `git worktree add -b FEATURE_NAME-i PROJECT_ROOT/trees/FEATURE_NAME-i`
  - RUN `cp PROJECT_ROOT/.env.example PROJECT_ROOT/trees/FEATURE_NAME-i/.env.local`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/.env.local`:
    - `VITE_API_BASE_URL=https://pumpd-webhook-app-5c7ade204a3d.herokuapp.com`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/vite.config.ts`: 
    - `port: 8080+(i),`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && npm install`
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/vite.config.ts | grep port` to verify the frontend port is set correctly
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/.env.local | grep VITE_API_BASE_URL` to verify using production backend
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && git ls-files | head -5` to validate
- RUN `cd PROJECT_ROOT && git worktree list` to verify all trees were created properly

### Usage Notes:
- Replace PROJECT_ROOT with the actual absolute path from `pwd`
- Use absolute paths in all bash commands to prevent directory confusion
- Execute npm install commands with explicit directory changes
- Verify configuration with grep commands showing actual values

## Notes
- Each worktree runs frontend on unique port (8081, 8082, 8083...)
- All frontends connect to shared production Heroku backend
- No local backend setup required - faster startup
- Perfect for UI changes, styling, frontend features