# Initialize parallel git worktree directories for Automation development

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
  - RUN `cp PROJECT_ROOT/scripts/.env PROJECT_ROOT/trees/FEATURE_NAME-i/scripts/.env`
  - RUN `cp PROJECT_ROOT/scripts/restaurant-registration/.env PROJECT_ROOT/trees/FEATURE_NAME-i/scripts/restaurant-registration/.env`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/.env`:
    - `PORT=3007+(i)` (e.g., worktree 1 = 3008, worktree 2 = 3009)
    - `VITE_RAILWAY_API_URL=http://localhost:3007+(i)`
  - UPDATE `PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/vite.config.ts`:
    - `port: 5007+(i),` (e.g., worktree 1 = 5008, worktree 2 = 5009)
    - `target: 'http://localhost:3007+(i)'` in the proxy config
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor && npm install`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/scripts && npm install`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/scripts/restaurant-registration && npm install`
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/vite.config.ts | grep -A2 "port:"` to verify the frontend port is set correctly
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/.env | grep PORT` to verify the backend port is set correctly
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/.env | grep VITE_RAILWAY_API_URL` to verify the API URL is set correctly
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && git ls-files | head -5` to validate
- RUN `cd PROJECT_ROOT && git worktree list` to verify all trees were created properly

### Port Allocation:
| Worktree | Backend (PORT) | Frontend (vite) | VITE_RAILWAY_API_URL |
|----------|----------------|-----------------|----------------------|
| Main     | 3007           | 5007            | http://localhost:3007 |
| 1        | 3008           | 5008            | http://localhost:3008 |
| 2        | 3009           | 5009            | http://localhost:3009 |
| 3        | 3010           | 5010            | http://localhost:3010 |

### Usage Notes:
- Replace PROJECT_ROOT with the actual absolute path from `pwd`
- Use absolute paths in all bash commands to prevent directory confusion
- Execute npm install commands with explicit directory changes
- Verify configuration with grep commands showing actual values
- The scripts/.env and scripts/restaurant-registration/.env don't need port changes (no servers)
