/**
 * Represents a web search result returned by any search provider
 */
export interface SearchResult {
  /** URL of the search result */
  url: string;
  /** Title of the web page */
  title: string;
  /** Snippet/description of the web page */
  snippet?: string;
  /** The source website domain */
  domain?: string;
  /** When the result was published or last updated */
  publishedDate?: string;
  /** The search provider that returned this result */
  provider?: string;
  /** Raw response data from the provider */
  raw?: unknown;
}

/**
 * Debug options for the search SDK
 */
export interface DebugOptions {
  /** Enable verbose logging */
  enabled?: boolean;
  /** Log request details (URLs, headers, etc.) */
  logRequests?: boolean;
  /** Log full responses */
  logResponses?: boolean;
  /** Custom logger function */
  logger?: (message: string, data?: unknown) => void;
}

/**
 * Common options for web search across all providers
 */
export interface SearchOptions {
  /** The search query text */
  query: string;
  /** Maximum number of results to return */
  maxResults?: number;
  /** Language/locale for results */
  language?: string;
  /** Country/region for results */
  region?: string;
  /** Safe search setting */
  safeSearch?: 'off' | 'moderate' | 'strict';
  /** Result page number (for pagination) */
  page?: number;
  /** Custom timeout in milliseconds */
  timeout?: number;
  /** Debug options */
  debug?: DebugOptions;
}

/**
 * Interface that all search provider implementations must satisfy
 */
export interface SearchProvider {
  /** Name of the search provider */
  name: string;
  /** Search method implementation */
  search: (options: SearchOptions) => Promise<SearchResult[]>;
  /** API configuration for the provider */
  config: ProviderConfig;
}

/**
 * Provider configuration options
 */
export interface ProviderConfig {
  /** API key or token */
  apiKey: string;
  /** Base URL for API requests */
  baseUrl?: string;
  /** Additional provider-specific options */
  [key: string]: unknown;
}

/**
 * Options for the main webSearch function
 */
export interface WebSearchOptions extends SearchOptions {
  /** Search provider to use */
  provider: SearchProvider;
}