# Investigation: Firecrawl Integration Patterns

## API Configuration

- **API Version:** v2 (exclusively)
- **Endpoint:** `POST https://api.firecrawl.dev/v2/scrape`
- **Concurrency:** 5 requests (configurable via `FIRECRAWL_CONCURRENCY_LIMIT`)
- **Rate Limit:** 10 req/min sliding window

## Request Structure

```javascript
{
  url: string,
  formats: [{
    type: 'json',
    schema: jsonSchema,
    prompt: extractionPrompt
  }],
  waitFor: 4000,           // Wait for JS rendering
  onlyMainContent: true,
  timeout: 120000,
  skipTlsVerification: true,
  removeBase64Images: true
}
```

## Schema Pattern

```javascript
{
  type: "object",
  properties: {
    fieldName: {
      type: "string|number|array",
      description: "Clear description of what to extract"
    }
  },
  required: ["fieldName"]
}
```

## Prompt Pattern

```
Extract [type of information] from this [page type].

For each [item], capture:
1. Field 1 - description
2. Field 2 - description
3. Field 3 - description

IMPORTANT: Only extract visible data. Leave empty if not found.
```

## Parallel Request Pattern

```javascript
const CONCURRENCY = 5;
for (let i = 0; i < urls.length; i += CONCURRENCY) {
  const batch = urls.slice(i, i + CONCURRENCY);

  const results = await Promise.allSettled(
    batch.map(async (url) => {
      await rateLimiter.acquireSlot('extraction');
      return firecrawlRequest(url, prompt, schema);
    })
  );

  // 1s delay between batches
  if (i + CONCURRENCY < urls.length) {
    await new Promise(r => setTimeout(r, 1000));
  }
}
```

## Error Handling & Retry

```javascript
async function firecrawlRequest(url, prompt, schema, options = {}) {
  const { maxRetries = 3, retryDelay = 5000 } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      await rateLimiter.acquireSlot();
      const response = await axios.post(url, payload);
      return response.data.data?.json || response.data.data;
    } catch (error) {
      const isRetryable =
        error.message.includes('TIMEOUT') ||
        error.message.includes('rate') ||
        error.response?.status >= 500;

      if (!isRetryable || attempt >= maxRetries) throw error;

      // Exponential backoff
      await new Promise(r => setTimeout(r, retryDelay * (attempt + 1)));
    }
  }
}
```

## Rate Limiter Service

**Location:** `/src/services/rate-limiter-service.js`

```javascript
class RateLimiterService {
  rateLimit = 10;           // Requests per window
  rateLimitWindow = 60000;  // 1 minute

  async acquireSlot(identifier) {
    // Sliding window implementation
    // Waits if at capacity
  }
}
```

## Companies Office Extraction Recommendations

**Step 1 Schema:**
```javascript
{
  type: "object",
  properties: {
    companies: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company_name: { type: "string" },
          company_number: { type: "string" },
          nzbn: { type: "string" },
          status: { type: "string" },
          registered_address: { type: "string" }
        },
        required: ["company_name", "company_number"]
      }
    }
  }
}
```

**Step 2 Schema:**
```javascript
{
  type: "object",
  properties: {
    company_info: { /* basic details */ },
    directors: { /* array of directors */ },
    shareholders: { /* array of shareholders */ },
    addresses: { /* array of addresses */ },
    nzbn_details: { /* GST, phone, email if available */ }
  }
}
```

## Key Configuration Values

| Setting | Value | Notes |
|---------|-------|-------|
| API Timeout | 120-180s | Firecrawl processing |
| Axios Timeout | 150s | Extra buffer |
| Retry Attempts | 3 | With exponential backoff |
| Base Retry Delay | 5s | × (attempt + 1) |
| Batch Delay | 1s | Between batches |
| Wait for JS | 4s | Dynamic content |
