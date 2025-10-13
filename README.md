# @plust/search-sdk

A unified TypeScript SDK for integrating with multiple web search providers through a single, consistent interface.

## Overview

The Search SDK provides a standardized way to interact with various search APIs, allowing developers to easily switch between providers or use multiple providers simultaneously without changing application code. It's designed for simplicity, flexibility, and robust error handling.

## Installation

```bash
npm install @plust/search-sdk
```

## Quick Start

```typescript
import { google, webSearch } from '@plust/search-sdk';

// Configure the Google search provider
const googleProvider = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

// Perform a search
async function main() {
  try {
    const results = await webSearch({
      query: 'TypeScript SDK',
      provider: [googleProvider]
    });

    console.log(results);
  } catch (error) {
    console.error('Search failed:', error);
  }
}

main();
```

## Key Features

- **Unified API**: A single `webSearch` function for all supported providers.
- **Standardized Results**: Search results are mapped to a consistent `SearchResult` interface.
- **TypeScript Support**: Strong typing for all configurations, options, and results.
- **Parallel Searching**: Query multiple providers at once.
- **Detailed Error Handling**: Errors include provider-specific troubleshooting tips.
- **Built-in Debugging**:- LLog requests, responses, and internal operations.

## Supported Search Providers

- [Google Custom Search](https://developers.google.com/custom-search/v1/overview)
- [SerpAPI](https://serpapi.com/)
- [Brave Search](https://brave.com/search/api/)
- [Exa](https://exa.ai/)
- [Tavily](https://tavily.com/)
- [Custom SearXNG](https://docs.searxng.org/)
- [Arxiv](https://arxiv.org/)
- [DuckDuckGo](https://duckduckgo.com/)

## Usage

### Configuring Providers

Each search provider must be configured before use.

```typescript
import { google, brave, serpapi } from '@plust/search-sdk';

const googleProvider = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

const braveProvider = brave.configure({
  apiKey: 'YOUR_BRAVE_API_KEY'
});

const serpapiProvider = serpapi.configure({
  apiKey: 'YOUR_SERPAPI_KEY',
  engine: 'bing' // Optional: specify engine, defaults to 'google'
});
```

### Performing a Search

Pass one or more configured providers to the `webSearch` function.

```typescript
import { webSearch } from '@plust/search-sdk';

const results = await webSearch({
  query: 'best frontend frameworks',
  provider: [googleProvider, braveProvider], // Search multiple providers
  maxResults: 5
});
```

## Common Search Options

The `webSearch` function accepts these options:

| Option       | Type                                           | Description                                                                                             |
|--------------|------------------------------------------------|---------------------------------------------------------------------------------------------------------|
| `query`      | `string`                                       | The search query.                                                                                       |
| `maxResults` | `number`                                       | The maximum number of results to return.                                                                |
| `page`       | `number`                                       | The page number for pagination.                                                                         |
| `language`   | `string`                                       | The language for the search results (e.g., 'en-US').                                                     |
| `region`     | `string`                                       | The country or region to tailor results for (e.g., 'US').                                                |
| `safeSearch` | `'off' \| 'moderate' \| 'strict'`              | The safe search level for filtering content.                                                            |
| `timeout`    | `number`                                       | The maximum time in milliseconds to wait for a provider to respond.                                     |
| `idList`     | `string`                                       | **(Arxiv)** A comma-separated list of Arxiv document IDs to fetch.                                        |
| `sortBy`     | `'relevance' \| 'lastUpdatedDate' \| 'submittedDate'` | **(Arxiv)** The sorting criteria for Arxiv results.                                               |
| `searchType` | `'text' \| 'images' \| 'news'`                 | **(DuckDuckGo)** The type of search to perform.                                                           |

## Search Result Format

All providers return results in this standardized `SearchResult` format:

```typescript
interface SearchResult {
  url: string;
  title: string;
  snippet?: string;
  domain?: string;
  publishedDate?: string;
  provider: string;
  raw?: unknown; // The original, unprocessed result from the provider
}
```

## Error Handling

The SDK is designed to handle errors gracefully. If one provider in a multi-provider search fails, the others will still return results. If all providers fail, a detailed error is thrown.

```text
Search with provider 'google' failed: Request failed with status: 403 Forbidden

Troubleshooting: This is likely an authentication issue. Check your API key and ensure it has the correct permissions. Make sure your Google API key is valid and the Custom Search API is enabled. Also, check if your Search Engine ID (cx) is correct.
```

## Debugging

Enable debugging to get detailed logs of the search process.

```typescript
const results = await webSearch({
  query: 'TypeScript SDK',
  provider: [googleProvider],
  debug: {
    enabled: true,      // Enable basic logging
    logRequests: true,  // Log HTTP request details
    logResponses: true  // Log full HTTP response bodies
  }
});
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request on our [GitHub repository](https://github.com/plust/search-sdk).

## License

MIT
