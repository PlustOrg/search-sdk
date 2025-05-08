# @plust/search-sdk

A unified TypeScript SDK for integrating with multiple web search providers through a single, consistent interface.

## Overview

The Search SDK provides a standardized way to interact with various search APIs, allowing developers to easily switch between providers or use multiple providers simultaneously without changing application code.

## Installation

```bash
npm install @plust/search-sdk
```

## Quick Start

```typescript
import { google, webSearch } from '@plust/search-sdk';

// Configure the Google search provider with your API key and Search Engine ID
const configuredGoogle = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

// Search using the configured provider
async function search() {
  const results = await webSearch({
    query: 'TypeScript SDK',
    maxResults: 5,
    provider: configuredGoogle
  });
  
  console.log(results);
}

search();
```

## Key Features

- Unified API for working with multiple search providers
- Standardized result format across all providers
- Comprehensive type safety with TypeScript
- Configurable search parameters (pagination, safe search, language, etc.)
- Detailed error handling with provider-specific troubleshooting
- Built-in debugging capabilities

## Supported Search Providers

The SDK currently supports the following search APIs:

- [Google Custom Search](https://developers.google.com/custom-search/v1/overview)
- [SerpAPI](https://serpapi.com/)
- [Brave Search](https://brave.com/search/api/)
- [Exa](https://exa.ai/)
- [Tavily](https://tavily.com/)
- [Custom SearXNG](https://docs.searxng.org/)

## Provider Configuration

Each search provider needs to be configured before use:

### Google Custom Search

```typescript
import { google, webSearch } from '@plust/search-sdk';

const googleProvider = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

const results = await webSearch({
  query: 'React hooks tutorial',
  maxResults: 10,
  provider: googleProvider
});
```

### SerpAPI

```typescript
import { serpapi, webSearch } from '@plust/search-sdk';

const serpProvider = serpapi.configure({
  apiKey: 'YOUR_SERPAPI_KEY',
  engine: 'google' // Optional, defaults to 'google'
});

const results = await webSearch({
  query: 'TypeScript best practices',
  maxResults: 10,
  provider: serpProvider
});
```

### Brave Search

```typescript
import { brave, webSearch } from '@plust/search-sdk';

const braveProvider = brave.configure({
  apiKey: 'YOUR_BRAVE_API_KEY'
});

const results = await webSearch({
  query: 'privacy-focused browsers',
  maxResults: 10,
  safeSearch: 'moderate',
  provider: braveProvider
});
```

### Exa

```typescript
import { exa, webSearch } from '@plust/search-sdk';

const exaProvider = exa.configure({
  apiKey: 'YOUR_EXA_API_KEY',
  model: 'keyword', // Optional, defaults to 'keyword'
  includeContents: true // Optional, defaults to false
});

const results = await webSearch({
  query: 'machine learning papers',
  provider: exaProvider
});
```

### Tavily

```typescript
import { tavily, webSearch } from '@plust/search-sdk';

const tavilyProvider = tavily.configure({
  apiKey: 'YOUR_TAVILY_API_KEY',
  searchDepth: 'comprehensive', // Optional, defaults to 'basic'
  includeAnswer: true // Optional, defaults to false
});

const results = await webSearch({
  query: 'climate change evidence',
  maxResults: 15,
  provider: tavilyProvider
});
```

### SearXNG

```typescript
import { searxng, webSearch } from '@plust/search-sdk';

const searxngProvider = searxng.configure({
  baseUrl: 'http://127.0.0.1:8080/search',
  additionalParams: {
    // Optional additional parameters for SearXNG
    categories: 'general',
    engines: 'google,brave,duckduckgo'
  },
  apiKey: '' // Not needed for most SearXNG instances
});

const results = await webSearch({
  query: 'open source software',
  maxResults: 10,
  provider: searxngProvider
});
```

## Common Search Options

The `webSearch` function accepts these standard options across all providers:

| Option | Type | Description |
|--------|------|-------------|
| `query` | string | The search query text |
| `maxResults` | number | Maximum number of results to return |
| `language` | string | Language code for results (e.g., 'en') |
| `region` | string | Country/region code (e.g., 'US') |
| `safeSearch` | 'off' \| 'moderate' \| 'strict' | Content filtering level |
| `page` | number | Result page number (for pagination) |
| `timeout` | number | Request timeout in milliseconds |

## Search Result Format

All providers return results in this standardized format:

```typescript
interface SearchResult {
  url: string;         // The URL of the search result
  title: string;       // Title of the web page
  snippet?: string;    // Brief description or excerpt
  domain?: string;     // The source website domain
  publishedDate?: string; // When the content was published
  provider?: string;   // The search provider that returned this result
  raw?: unknown;       // Raw provider-specific data
}
```

## Debugging

The SDK includes built-in debugging capabilities to help diagnose issues:

```typescript
import { google, webSearch } from '@plust/search-sdk';

const results = await webSearch({
  query: 'TypeScript SDK',
  provider: googleProvider,
  debug: {
    enabled: true,           // Enable debug logging
    logRequests: true,       // Log HTTP request details
    logResponses: true,      // Log response data (excluding sensitive info)
    logger: (msg, data) => { // Optional custom logger
      console.log(`Custom logger: ${msg}`, data);
    }
  }
});
```

You can also use the debug utility directly:

```typescript
import { debug } from '@plust/search-sdk';

// Log only if debugging is enabled in options
debug.log(options.debug, 'My debug message', { some: 'data' });
```

## Error Handling

The SDK provides detailed error messages with troubleshooting suggestions:

```
Search with provider 'google' failed: Google search failed: Request failed with status: 400 Bad Request - Invalid Value

Troubleshooting: This is likely due to invalid request parameters. Check your query and other search options. Make sure your Google API key is valid and has the Custom Search API enabled. Also check if your Search Engine ID (cx) is correct.
```

## API Reference

### Main Function

#### `webSearch(options: WebSearchOptions): Promise<SearchResult[]>`

Performs a web search using the specified provider and options.

```typescript
const results = await webSearch({
  query: 'TypeScript tutorial',
  maxResults: 10,
  language: 'en',
  region: 'US',
  safeSearch: 'moderate',
  page: 1,
  provider: googleProvider
});
```

## License

MIT