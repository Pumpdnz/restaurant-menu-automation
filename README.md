# Pumpd Restaurant Automation

Automated tools for onboarding restaurants to the Pumpd online ordering platform.

## Overview

This repository contains automation scripts and tools for:
- Extracting restaurant menus from delivery platforms (UberEats, DoorDash)
- Automated restaurant registration on Pumpd admin portal
- Menu data import and image uploading
- Restaurant information extraction (logos, business hours, social media)

## Quick Start

### Prerequisites
- Node.js 18+ 
- npm
- Playwright browsers (installed automatically)

### Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd automation
```

2. Install dependencies:
```bash
# Main image extractor
cd UberEats-Image-Extractor
npm install

# Registration scripts
cd ../scripts/restaurant-registration
npm install
```

3. Set up environment variables:
- Copy `.env.example` files to `.env` in respective directories
- Add your API keys (Firecrawl, OpenAI)
- Set admin password for registration scripts

### Usage

#### Extract Menu from UberEats/DoorDash

1. Start the extraction server:
```bash
cd UberEats-Image-Extractor
npm start
```

2. Use Claude Code with the `menu-extractor-batch` agent
3. Provide the restaurant's delivery platform URL

#### Register a Restaurant

Use Claude Code with the `restaurant-registration-browser` agent, providing:
- Restaurant name and details
- Operating hours
- Contact information

#### Import Menu Data

Use Claude Code with the `menu-import-uploader` agent, providing:
- CSV file path (use the _no_images.csv version)
- Image mapping JSON file
- Restaurant email

## Project Structure

```
automation/
├── UberEats-Image-Extractor/    # Menu extraction API
├── scripts/                      # Automation scripts
│   ├── restaurant-registration/  # Registration automation
│   ├── menu-import/             # Menu import scripts
│   └── image-upload/            # Image upload scripts
├── extracted-menus/             # Extracted CSV files
├── planning/                    # Planning documents
└── .claude/                     # Claude Code agent configs
    └── agents/                  # Specialized automation agents
```

## Ports

- API Server: 3007
- WebSocket: 5007

## Available Agents

The `.claude/agents` directory contains specialized agents for:
- `menu-extractor-batch` - Extract menus from delivery platforms
- `restaurant-registration-browser` - Automate registration
- `menu-import-uploader` - Import menus and upload images
- `google-business-extractor` - Extract business information
- `restaurant-logo-*` - Various logo extraction methods

## Contributing

1. Create a feature branch
2. Make your changes
3. Test thoroughly
4. Submit a pull request

## License

Private repository - All rights reserved