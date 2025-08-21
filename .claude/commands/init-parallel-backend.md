# Initialize parallel git worktree directories for backend-only development (Corrected)

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
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/server/.env`: 
    - `PORT=3000+(i)`
    - `FRONTEND_URL=http://localhost:8080`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/server && npm install`
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/server/.env | grep PORT` to verify the backend port is set correctly
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/server/.env | grep FRONTEND_URL` to verify CORS is set for main frontend
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && git ls-files | head -5` to validate
- RUN `cd PROJECT_ROOT && git worktree list` to verify all trees were created properly

### Usage Notes:
- Replace PROJECT_ROOT with the actual absolute path from `pwd`
- Use absolute paths in all bash commands to prevent directory confusion
- Execute npm install commands with explicit directory changes
- Verify configuration with grep commands showing actual values

## Notes
- Each worktree runs backend on unique port (3001, 3002, 3003...)
- All backends configured for CORS with main frontend on port 8080
- No frontend setup in worktrees - use main frontend for testing
- Perfect for API changes, business logic, backend features
- Test different backends by changing VITE_API_BASE_URL in main frontend