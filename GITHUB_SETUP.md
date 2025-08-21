# GitHub Repository Setup Instructions

## Step 1: Create Repository on GitHub

1. Go to https://github.com/new
2. Repository name: `restaurant-menu-automation` (or your preferred name)
3. Description: "Automated restaurant menu extraction from delivery platforms with database persistence"
4. Set to **Private** (recommended) or Public
5. DO NOT initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

## Step 2: Link Local Repository to GitHub

After creating the repository on GitHub, run these commands in your terminal:

```bash
# Add the GitHub repository as origin
git remote add origin https://github.com/YOUR_USERNAME/restaurant-menu-automation.git

# Or if using SSH:
# git remote add origin git@github.com:YOUR_USERNAME/restaurant-menu-automation.git

# Push the main branch
git branch -M main
git push -u origin main
```

## Step 3: Verify Upload

Your repository should now be on GitHub with:
- All source code (without secrets)
- Proper .gitignore configuration
- Example environment files
- Documentation

## Repository Structure on GitHub

```
restaurant-menu-automation/
├── UberEats-Image-Extractor/     # Main extraction server
├── scripts/                       # Automation scripts
├── extracted-menus/              # Sample CSV outputs
├── .claude/                      # Claude Code configurations
├── README_GITHUB.md              # Main documentation
└── .gitignore                    # Properly configured
```

## For Collaborators

Anyone who clones this repository will need to:

1. Clone the repository:
```bash
git clone https://github.com/YOUR_USERNAME/restaurant-menu-automation.git
cd restaurant-menu-automation
```

2. Install dependencies:
```bash
cd UberEats-Image-Extractor
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with their API keys
```

4. Get required API keys:
- Firecrawl API key from https://firecrawl.dev
- (Optional) Supabase project for database persistence

## Security Reminders

✅ All API keys removed from code
✅ .env files are git-ignored
✅ Example files use placeholders
✅ No hardcoded URLs or credentials
✅ CLAUDE.local.md is ignored

## Next Steps

After pushing to GitHub:

1. Add collaborators (Settings → Manage access)
2. Set up branch protection rules if needed
3. Configure GitHub Actions for CI/CD (optional)
4. Add additional documentation as needed

## Alternative: GitHub Desktop

If you prefer a GUI, you can use GitHub Desktop:
1. Download from https://desktop.github.com/
2. Sign in with your GitHub account
3. Add existing repository (select the automation folder)
4. Publish repository to GitHub

## Troubleshooting

If you get authentication errors:
```bash
# For HTTPS, use personal access token:
# Go to GitHub Settings → Developer settings → Personal access tokens
# Generate new token with repo scope
# Use token as password when prompted

# For SSH, add SSH key:
ssh-keygen -t ed25519 -C "your-email@example.com"
cat ~/.ssh/id_ed25519.pub
# Add this key to GitHub Settings → SSH and GPG keys
```