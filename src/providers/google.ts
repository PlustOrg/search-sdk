import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { buildUrl, get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * @internal
 * Google Custom Search API response types
 */
interface GoogleSearchItem {
  kind: string;
  title: string;
  htmlTitle: string;
  link: string;
  displayLink: string;
  snippet: string;
  htmlSnippet: string;
  formattedUrl: string;
  htmlFormattedUrl: string;
  pagemap?: {
    cse_thumbnail?: Array<{ src: string; width: string; height: string; }>;
    metatags?: Array<Record<string, string>>;
    cse_image?: Array<{ src: string; }>;
  };
}

/**
 * @internal
 */
interface GoogleSearchResponse {
  kind: string;
  url: { type: string; template: string; };
  queries: {
    request: Array<{
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
    nextPage?: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
  };
  context: { title: string; };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items?: GoogleSearchItem[];
}

/**
 * Defines the configuration options for the Google Custom Search provider.
 */
export interface GoogleSearchConfig extends ProviderConfig {
  /**
   * The Google Custom Search Engine ID (cx).
   * This is a unique identifier for your custom search engine.
   */
  cx: string;
  /**
   * The base URL for the Google Custom Search API.
   * @default 'https://www.googleapis.com/customsearch/v1'
   */
  baseUrl?: string;
}

/**
 * @internal
 * Default base URL for Google Custom Search API
 */
const DEFAULT_BASE_URL = 'https://www.googleapis.com/customsearch/v1';

/**
 * Creates a new instance of the Google Custom Search provider.
 * This function is typically used through the `google.configure()` method.
 *
 * @param {GoogleSearchConfig} config - The configuration options for Google Custom Search.
 * @returns {SearchProvider} A configured Google Custom Search provider instance.
 * @throws {Error} If the API key or Search Engine ID (cx) is missing.
 * @internal
 */
export function createGoogleProvider(config: GoogleSearchConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Google Custom Search requires an API key.');
  }
  
  if (!config.cx) {
    throw new Error('Google Custom Search requires a Search Engine ID (cx).');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'google',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      const start = (page - 1) * maxResults + 1;
      
      const params: Record<string, string | number | undefined> = {
        key: config.apiKey,
        cx: config.cx,
        q: query,
        num: maxResults > 10 ? 10 : maxResults,
        start,
      };
      
      if (language) params.lr = `lang_${language}`;
      if (region) params.gl = region;
      if (safeSearch) params.safe = safeSearch;

      const url = buildUrl(baseUrl, params);
      
      debug.logRequest(debugOptions, 'Google Search request', { url: url.replace(config.apiKey!, '***') });
      
      try {
        const response = await get<GoogleSearchResponse>(url, { timeout });
        
        debug.logResponse(debugOptions, 'Google Search raw response', {
          itemCount: response.items?.length || 0,
          totalResults: response.searchInformation?.totalResults,
        });
        
        if (!response.items) return [];
        
        return response.items.map((item) => {
          const metatags = item.pagemap?.metatags?.[0];
          return {
            url: item.link,
            title: item.title,
            snippet: item.snippet,
            domain: item.displayLink,
            publishedDate: metatags?.['article:published_time'] || metatags?.['date'],
            provider: 'google',
            raw: item,
          };
        });
      } catch (error) {
        let errorMessage = 'Google search failed';
        if (error instanceof HttpError) {
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        debug.log(debugOptions, 'Google Search error', {
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * A search provider for the Google Custom Search API.
 * This provider allows you to integrate Google's search capabilities into your application.
 *
 * @example
 * ```typescript
 * import { google, webSearch } from '@plust/search-sdk';
 *
 * const googleProvider = google.configure({
 *   apiKey: 'YOUR_GOOGLE_API_KEY',
 *   cx: 'YOUR_SEARCH_ENGINE_ID'
 * });
 *
 * const results = await webSearch({
 *   query: 'React hooks tutorial',
 *   provider: [googleProvider]
 * });
 * ```
 */
export const google: SearchProvider & { configure: (config: GoogleSearchConfig) => SearchProvider } = {
  name: 'google',
  config: { apiKey: '', cx: '' },
  
  /**
   * Configures a new instance of the Google Custom Search provider.
   * An API key and a Search Engine ID (cx) are required.
   *
   * @param {GoogleSearchConfig} config - The configuration options for Google Custom Search.
   * @returns {SearchProvider} A configured Google Custom Search provider instance.
   */
  configure: (config: GoogleSearchConfig): SearchProvider => createGoogleProvider(config),
  
  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Google provider must be configured before use. Call google.configure() first.');
  }
};