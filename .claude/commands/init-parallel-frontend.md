# Initialize parallel git worktree directories for frontend-only development

## Variables
FEATURE_NAME: $ARGUMENTS
NUMBER_OF_PARALLEL_WORKTREES: $ARGUMENTS

## Execute these commands
> Execute the loop in parallel with the Bash and Task tool

### IMPORTANT: Use absolute paths to avoid directory navigation issues

**PROJECT_ROOT**: Get current working directory with `pwd` first, then use absolute paths throughout

- create a new dir `PROJECT_ROOT/trees/`
- for i in NUMBER_OF_PARALLEL_WORKTREES
  - RUN `git worktree add -b FEATURE_NAME-i PROJECT_ROOT/trees/FEATURE_NAME-i`
  - RUN `cp PROJECT_ROOT/UberEats-Image-Extractor/.env PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/.env`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/.env`:
    - `VITE_RAILWAY_API_URL=https://automation-production.up.railway.app` (use production backend)
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/vite.config.ts`:
    - `port: 5007+(i),` (e.g., worktree 1 = 5008, worktree 2 = 5009)
    - Comment out the proxy config (using production backend directly)
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor && npm install`
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/vite.config.ts | grep -A2 "port:"` to verify the frontend port is set correctly
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/.env | grep VITE_RAILWAY_API_URL` to verify using production backend
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && git ls-files | head -5` to validate
- RUN `cd PROJECT_ROOT && git worktree list` to verify all trees were created properly

### Port Allocation:
| Worktree | Frontend (vite) | Backend |
|----------|-----------------|---------|
| Main     | 5007            | Local 3007 |
| 1        | 5008            | Production Railway |
| 2        | 5009            | Production Railway |
| 3        | 5010            | Production Railway |

### Usage Notes:
- Replace PROJECT_ROOT with the actual absolute path from `pwd`
- Use absolute paths in all bash commands to prevent directory confusion
- Execute npm install commands with explicit directory changes
- Verify configuration with grep commands showing actual values

## Notes
- Each worktree runs frontend on unique port (5008, 5009, 5010...)
- All frontends connect to shared production Railway backend
- No local backend setup required - faster startup
- Perfect for UI changes, styling, frontend features in `UberEats-Image-Extractor/src/`
