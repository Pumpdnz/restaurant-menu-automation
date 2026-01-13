# Initialize parallel git worktree directories for backend-only development

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
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor && npm install`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/scripts && npm install`
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i/scripts/restaurant-registration && npm install`
  - RUN `cat PROJECT_ROOT/trees/FEATURE_NAME-i/UberEats-Image-Extractor/.env | grep PORT` to verify the backend port is set correctly
  - RUN `cd PROJECT_ROOT/trees/FEATURE_NAME-i && git ls-files | head -5` to validate
- RUN `cd PROJECT_ROOT && git worktree list` to verify all trees were created properly

### Port Allocation:
| Worktree | Backend (PORT) | Test with Frontend |
|----------|----------------|-------------------|
| Main     | 3007           | Main (5007) |
| 1        | 3008           | Update main's VITE_RAILWAY_API_URL |
| 2        | 3009           | Update main's VITE_RAILWAY_API_URL |
| 3        | 3010           | Update main's VITE_RAILWAY_API_URL |

### Usage Notes:
- Replace PROJECT_ROOT with the actual absolute path from `pwd`
- Use absolute paths in all bash commands to prevent directory confusion
- Execute npm install commands with explicit directory changes
- Verify configuration with grep commands showing actual values

## Notes
- Each worktree runs backend on unique port (3008, 3009, 3010...)
- No frontend setup in worktrees - use main frontend for testing
- Perfect for API changes, server.js modifications, automation scripts
- Test different backends by changing `VITE_RAILWAY_API_URL` in main frontend's `.env`
- Backend is `UberEats-Image-Extractor/server.js` (not a separate server/ directory)
