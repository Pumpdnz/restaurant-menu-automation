# Initialize parallel git worktree directories for Pumpd development

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
  - RUN `cp PROJECT_ROOT/server/.env PROJECT_ROOT/trees/FEATURE_NAME-i/server/.env`
  - RUN `cp PROJECT_ROOT/.env.example PROJECT_ROOT/trees/FEATURE_NAME-i/.env.local`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/server/.env`: 
    - `PORT=3000+(i)`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/.env.local`:
    - `VITE_API_BASE_URL=http://localhost:3000+(i)`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/vite.config.ts`: 
    - `port: 8080+(i),`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/server && npm install`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && npm install`
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/vite.config.ts | grep port` to verify the frontend port is set correctly
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/server/.env | grep PORT` to verify the backend port is set correctly
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/.env.local | grep VITE_API_BASE_URL` to verify the API URL is set correctly
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && git ls-files | head -5` to validate
- RUN `cd PROJECT_ROOT && git worktree list` to verify all trees were created properly

### Usage Notes:
- Replace PROJECT_ROOT with the actual absolute path from `pwd`
- Use absolute paths in all bash commands to prevent directory confusion
- Execute npm install commands with explicit directory changes
- Verify configuration with grep commands showing actual values