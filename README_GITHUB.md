# Restaurant Menu Extraction Automation

A comprehensive automation system for extracting restaurant menus from delivery platforms (UberEats, DoorDash) and managing restaurant data.

## Features

- 🚀 **Menu Extraction**: Extract complete menu data from UberEats and DoorDash
- 📊 **Database Persistence**: Store menu data in Supabase with version control
- 🖼️ **Image Management**: Download and manage menu item images
- 📝 **CSV Export**: Generate CSV files for easy data manipulation
- 🔄 **Batch Processing**: Process multiple categories concurrently
- 💾 **Caching**: Smart caching with Firecrawl v2 API
- 🎯 **Option Sets**: Extract modifiers, sizes, and add-ons
- 📈 **Price History**: Track price changes over time

## Project Structure

```
automation/
├── UberEats-Image-Extractor/    # Main extraction API server
│   ├── src/
│   │   ├── services/           # Core services
│   │   └── utils/              # Utility functions
│   ├── server.js               # Express server
│   └── package.json
├── scripts/                      # Automation scripts
│   ├── restaurant-registration/  # Registration automation
│   ├── menu-import/             # Menu import scripts
│   └── image-upload/            # Image upload scripts
├── extracted-menus/             # Extracted CSV files
├── planning/                    # Planning documents
└── .claude/                     # Claude Code agent configs
```

## Prerequisites

- Node.js 18+
- npm
- Firecrawl API key
- Supabase account (optional, for database persistence)

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd automation
```

2. Install dependencies:
```bash
cd UberEats-Image-Extractor
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

## Configuration

### Required Environment Variables

```env
# Firecrawl API (Required)
FIRECRAWL_API_KEY=your-firecrawl-api-key
FIRECRAWL_API_URL=https://api.firecrawl.dev

# Server Configuration
PORT=3007
NODE_ENV=production

# Optional: Supabase for database persistence
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Usage

### Start the Server

```bash
cd UberEats-Image-Extractor
npm start
```

Server will run on `http://localhost:3007`

### API Endpoints

#### 1. Scan Categories
```bash
POST /api/scan-categories
{
  "url": "https://www.ubereats.com/store/..."
}
```

#### 2. Extract Menu (Batch)
```bash
POST /api/batch-extract-categories
{
  "url": "https://www.ubereats.com/store/...",
  "categories": [...],
  "async": true  // Optional: for background processing
}
```

#### 3. Check Job Status
```bash
GET /api/batch-extract-status/:jobId
```

#### 4. Get Results
```bash
GET /api/batch-extract-results/:jobId
```

#### 5. Generate CSV
```bash
POST /api/generate-csv
{
  "data": {...},
  "restaurantName": "Restaurant Name"
}
```

## Database Schema

If using Supabase, the system includes:
- Multi-restaurant management
- Platform URL tracking
- Menu versioning
- Price history tracking
- Option sets support
- Extraction job monitoring

See [DATABASE_SCHEMA.md](UberEats-Image-Extractor/DATABASE_SCHEMA.md) for details.

## Technologies

- **Backend**: Node.js, Express
- **API**: Firecrawl v2 for web scraping
- **Database**: Supabase (PostgreSQL)
- **Automation**: Playwright for browser automation

## Key Features

### Firecrawl v2 Integration
- Direct v2 API implementation
- Smart caching for faster extractions
- JSON schema-based extraction

### Concurrent Processing
- Process multiple categories in parallel
- Background job processing
- Real-time progress tracking

### Data Export
- CSV generation with proper formatting
- Image URL mapping
- Clean data output

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Security

- Never commit API keys or secrets
- Use environment variables for configuration
- Check `.env.example` for required variables

## License

This project is proprietary software. All rights reserved.

## Support

For issues or questions, please open an issue in the GitHub repository.