/**
 * Represents a web search result returned by any search provider.
 * This interface standardizes the structure of search results from different sources.
 */
export interface SearchResult {
  /**
   * The direct URL to the search result.
   * @type {string}
   */
  url: string;
  /**
   * The title of the web page.
   * @type {string}
   */
  title: string;
  /**
   * A brief summary or snippet of the web page's content.
   * @type {string | undefined}
   */
  snippet?: string;
  /**
   * The domain name of the source website.
   * @type {string | undefined}
   */
  domain?: string;
  /**
   * The date when the result was published or last updated, in ISO 8601 format.
   * @type {string | undefined}
   */
  publishedDate?: string;
  /**
   * The name of the search provider that returned this result (e.g., 'google', 'bing').
   * @type {string}
   */
  provider: string;
  /**
   * The raw, unprocessed response data from the search provider.
   * The structure of this data is provider-specific.
   * @type {unknown}
   */
  raw?: unknown;
}

/**
 * Defines the configuration options for debugging within the search SDK.
 * These options allow for detailed logging of search operations.
 */
export interface DebugOptions {
  /**
   * If true, enables verbose logging throughout the search process.
   * @type {boolean | undefined}
   */
  enabled?: boolean;
  /**
   * If true, logs the details of HTTP requests made to search providers (e.g., URL, headers).
   * @type {boolean | undefined}
   */
  logRequests?: boolean;
  /**
   * If true, logs the full, raw response bodies from search providers.
   * @type {boolean | undefined}
   */
  logResponses?: boolean;
  /**
   * A custom logger function to override the default console logging.
   * @param {string} message The log message.
   * @param {unknown} [data] Additional data to log.
   * @returns {void}
   */
  logger?: (message: string, data?: unknown) => void;
}

/**
 * Defines common search options applicable across all search providers.
 * This interface provides a consistent way to specify search parameters.
 */
export interface SearchOptions {
  /**
   * The search query string.
   * This is optional for providers like Arxiv that can also search by ID list.
   * @type {string | undefined}
   */
  query?: string;
  /**
   * A comma-separated list of Arxiv document IDs to fetch.
   * This option is specific to the Arxiv provider.
   * @type {string | undefined}
   */
  idList?: string;
  /**
   * The maximum number of search results to return.
   * @type {number | undefined}
   */
  maxResults?: number;
  /**
   * The language and locale for the search results (e.g., 'en-US').
   * @type {string | undefined}
   */
  language?: string;
  /**
   * The country or region to tailor the search results for (e.g., 'US').
   * @type {string | undefined}
   */
  region?: string;
  /**
   * The safe search level to filter explicit content.
   * Note: Not all providers support this feature (e.g., Arxiv).
   * @type {'off' | 'moderate' | 'strict' | undefined}
   */
  safeSearch?: 'off' | 'moderate' | 'strict';
  /**
   * The page number of the search results for pagination.
   * Some providers may use an offset-based approach instead.
   * @type {number | undefined}
   */
  page?: number;
  /**
   * The starting index for fetching results, used for pagination in providers like Arxiv.
   * @type {number | undefined}
   */
  start?: number;
  /**
   * The criteria for sorting Arxiv results.
   * @type {'relevance' | 'lastUpdatedDate' | 'submittedDate' | undefined}
   */
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  /**
   * The sort order direction for Arxiv results.
   * @type {'ascending' | 'descending' | undefined}
   */
  sortOrder?: 'ascending' | 'descending';
  /**
   * The maximum time in milliseconds to wait for a search provider to respond.
   * @type {number | undefined}
   */
  timeout?: number;
  /**
   * Debugging options for this specific search request.
   * @type {DebugOptions | undefined}
   */
  debug?: DebugOptions;
}

/**
 * An interface that all search provider implementations must satisfy.
 * This ensures a consistent contract for interacting with different search APIs.
 */
export interface SearchProvider {
  /**
   * The unique name of the search provider (e.g., 'google', 'bing').
   * @type {string}
   */
  name: string;
  /**
   * The method that executes the search query.
   * @param {SearchOptions} options The search parameters.
   * @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results.
   */
  search: (options: SearchOptions) => Promise<SearchResult[]>;
  /**
   * The configuration object for the search provider, including API keys and base URLs.
   * @type {ProviderConfig}
   */
  config: ProviderConfig;
}

/**
 * Defines the configuration options for a search provider.
 * This includes credentials and other provider-specific settings.
 */
export interface ProviderConfig {
  /**
   * The API key or access token for authenticating with the search provider.
   * @type {string | undefined}
   */
  apiKey?: string;
  /**
   * The base URL for the search provider's API.
   * @type {string | undefined}
   */
  baseUrl?: string;
  /**
   * A flexible property to hold any additional, provider-specific configuration options.
   * @type {any}
   */
  [key: string]: unknown;
}

/**
 * Defines the options for the main `webSearch` function.
 * This extends the common `SearchOptions` with the requirement of at least one search provider.
 */
export interface WebSearchOptions extends SearchOptions {
  /**
   * An array of one or more configured search providers to query in parallel.
   * @type {SearchProvider[]}
   */
  provider: SearchProvider[];
}