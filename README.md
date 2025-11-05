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
    provider: [configuredGoogle]  // Provider is now an array
  });
  
  console.log(results);
}

search();
```

### Using Multiple Providers

You can query multiple search providers simultaneously for better coverage and reliability:

```typescript
import { google, brave, webSearch } from '@plust/search-sdk';

const googleProvider = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

const braveProvider = brave.configure({
  apiKey: 'YOUR_BRAVE_API_KEY'
});

// Search with multiple providers in parallel
async function search() {
  const results = await webSearch({
    query: 'TypeScript SDK',
    maxResults: 10,
    provider: [googleProvider, braveProvider]  // Multiple providers
  });
  
  // Results from all successful providers are combined
  console.log(`Found ${results.length} total results`);
}

search();
```

**Benefits of using multiple providers:**
- **Fail-soft behavior**: If one provider fails, others can still return results
- **Better coverage**: Combine results from multiple sources
- **Redundancy**: Protection against API downtime or rate limits

## Key Features

- Unified API for working with multiple search providers
- Standardized result format across all providers
- Comprehensive type safety with TypeScript
- Configurable search parameters (pagination, safe search, language, etc.)
- Detailed error handling with provider-specific troubleshooting
- Built-in debugging capabilities
- **MCP (Model Context Protocol) support** for AI agent integration

## Supported Search Providers

The SDK currently supports the following search APIs:

- [Google Custom Search](https://developers.google.com/custom-search/v1/overview)
- [SerpAPI](https://serpapi.com/)
- [Brave Search](https://brave.com/search/api/)
- [Exa](https://exa.ai/)
- [Tavily](https://tavily.com/)
- [Custom SearXNG](https://docs.searxng.org/)
- [Arxiv](https://arxiv.org/)
- [DuckDuckGo](https://duckduckgo.com/)

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
  provider: [googleProvider]
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
  provider: [serpProvider]
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
  provider: [braveProvider]
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
  provider: [exaProvider]
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
  provider: [tavilyProvider]
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
  provider: [searxngProvider]
});
```

### DuckDuckGo

```typescript
import { duckduckgo, webSearch } from '@plust/search-sdk';

// DuckDuckGo doesn't require an API key, but you can configure other options
const duckduckgoProvider = duckduckgo.configure({
  searchType: 'text', // Optional: 'text', 'images', or 'news'
  useLite: false,     // Optional: use lite version for lower bandwidth
  region: 'wt-wt'     // Optional: region code
});

// Text search
const textResults = await webSearch({
  query: 'privacy focused search',
  maxResults: 10,
  provider: [duckduckgoProvider]
});

// Image search
const imageProvider = duckduckgo.configure({ searchType: 'images' });
const imageResults = await webSearch({
  query: 'landscape photography',
  maxResults: 10,
  provider: [imageProvider]
});

// News search
const newsProvider = duckduckgo.configure({ searchType: 'news' });
const newsResults = await webSearch({
  query: 'latest technology',
  maxResults: 10,
  provider: [newsProvider]
});
```

### Arxiv

Arxiv is a repository of electronic preprints of scientific papers. It does not require an API key for its public API.

```typescript
import { arxiv, webSearch } from '@plust/search-sdk';

// Arxiv doesn't require an API key, but you can configure other options.
const arxivProvider = arxiv.configure({
  sortBy: 'relevance', // Optional: 'relevance', 'lastUpdatedDate', 'submittedDate'
  sortOrder: 'descending' // Optional: 'ascending', 'descending'
});

const results = await webSearch({
  query: 'cat:cs.AI AND ti:transformer', // Example: Search for "transformer" in title within Computer Science AI category
  // Alternatively, search by ID list:
  // idList: '2305.12345v1,2203.01234v2', 
  provider: [arxivProvider],
  maxResults: 5
});
```

## Common Search Options

The `webSearch` function accepts these standard options across all providers:

| Option | Type | Description |
|--------|------|-------------|
| `query` | string | The search query text. For Arxiv, this can be a complex query using field prefixes (e.g., `au:del_maestro AND ti:checkerboard`). |
| `idList` | string | (Arxiv specific) A comma-delimited list of Arxiv IDs to fetch. |
| `maxResults` | number | Maximum number of results to return. |
| `language` | string | Language code for results (e.g., 'en') |
| `region` | string | Country/region code (e.g., 'US'). For DuckDuckGo, use format like 'wt-wt', 'us-en'. |
| `safeSearch` | 'off' \| 'moderate' \| 'strict' | Content filtering level (Not applicable to Arxiv). For DuckDuckGo, 'moderate' is default. |
| `page` | number | Result page number (for pagination). Arxiv uses `start` (offset) instead. |
| `start` | number | (Arxiv specific) The starting index for results (pagination offset). |
| `sortBy` | 'relevance' \| 'lastUpdatedDate' \| 'submittedDate' | (Arxiv specific) Sort order for results. |
| `sortOrder` | 'ascending' \| 'descending' | (Arxiv specific) Sort direction. |
| `searchType` | 'text' \| 'images' \| 'news' | (DuckDuckGo specific) The type of search to perform. |
| `timeout` | number | Request timeout in milliseconds. |

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

const googleProvider = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

const results = await webSearch({
  query: 'TypeScript SDK',
  provider: [googleProvider],
  debug: { enabled: true, logRequests: true, logResponses: true }
});
```

## MCP (Model Context Protocol) Integration

The SDK includes built-in support for the [Model Context Protocol (MCP)](https://modelcontextprotocol.io), allowing AI agents and LLM applications to use web search capabilities through a standardized interface.

### What is MCP?

MCP is an open protocol that standardizes how applications provide context to Large Language Models (LLMs). It enables AI agents to safely access external tools and data sources through a unified interface.

### Using the SDK as an MCP Server

The SDK can run as an MCP server that exposes a `webSearch` tool to MCP clients:

#### Method 1: Using the `asMcp()` Function

The `asMcp()` function converts your configured search providers into an MCP server configuration that can be used with MCP clients like Stagehand:

```typescript
import { google, brave, asMcp } from '@plust/search-sdk';

// Configure your search providers
const googleProvider = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

const braveProvider = brave.configure({
  apiKey: 'YOUR_BRAVE_API_KEY'
});

// Create MCP server configuration
const mcpConfig = asMcp([googleProvider, braveProvider]);

// Use with an MCP client (e.g., Stagehand)
// The mcpConfig object can be passed to connectToMCPServer() or similar
console.log(mcpConfig);
// {
//   command: 'node',
//   args: ['node_modules/@plust/search-sdk/dist/mcp/cli.js'],
//   env: {
//     SEARCH_SDK_MCP_CONFIG: '{"providers":[...]}'
//   }
// }
```

#### Method 2: Running the MCP Server Directly

You can also run the MCP server directly by invoking the CLI script with Node.js:

```bash
# Set up your configuration
export SEARCH_SDK_MCP_CONFIG='{
  "providers": [
    {
      "name": "google",
      "config": {
        "apiKey": "YOUR_GOOGLE_API_KEY",
        "cx": "YOUR_SEARCH_ENGINE_ID"
      }
    },
    {
      "name": "brave",
      "config": {
        "apiKey": "YOUR_BRAVE_API_KEY"
      }
    }
  ]
}'

# Run the MCP server (from within your node_modules)
node node_modules/@plust/search-sdk/dist/mcp/cli.js
```

The MCP server will start and communicate over stdio, making it compatible with any MCP client.

### Available MCP Tools

When running as an MCP server, the following tool is exposed:

#### `webSearch`

Performs a web search across all configured providers.

**Parameters:**
- `query` (string, required): The search query
- `maxResults` (number, optional): Maximum number of results to return
- `region` (string, optional): Country code for regional results (e.g., "US")
- `language` (string, optional): Language code for results (e.g., "en-US")
- `idList` (string, optional): Comma-separated list of Arxiv IDs (Arxiv provider only)

**Returns:** JSON array of search results in the standardized format.

### MCP Client Configuration Examples

#### Claude Desktop

Add to your Claude Desktop configuration (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "search-sdk": {
      "command": "node",
      "args": ["node_modules/@plust/search-sdk/dist/mcp/cli.js"],
      "env": {
        "SEARCH_SDK_MCP_CONFIG": "{\"providers\":[{\"name\":\"brave\",\"config\":{\"apiKey\":\"YOUR_API_KEY\"}}]}"
      }
    }
  }
}
```

**Note:** The path assumes the package is installed in your project's `node_modules`. Adjust the path if using a different installation method or directory structure.

#### Stagehand

```typescript
import { connectToMCPServer } from '@browserbasehq/stagehand';
import { asMcp, google } from '@plust/search-sdk';

const googleProvider = google.configure({
  apiKey: 'YOUR_GOOGLE_API_KEY',
  cx: 'YOUR_SEARCH_ENGINE_ID'
});

const mcpServer = await connectToMCPServer(asMcp([googleProvider]));

// The webSearch tool is now available to your AI agent
const results = await mcpServer.callTool('webSearch', {
  query: 'latest AI developments',
  maxResults: 5
});
```

### Benefits of MCP Integration

- **Standardized Interface**: AI agents can access web search through a consistent protocol
- **Secure**: Provider credentials are managed securely through environment variables
- **Flexible**: Support for multiple search providers in a single MCP server
- **Easy Integration**: Works with any MCP-compatible client (Claude Desktop, Stagehand, etc.)

## Error Handling

The SDK provides detailed error messages with troubleshooting suggestions:

```text
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
  provider: [googleProvider]
});
```

## License

MIT
