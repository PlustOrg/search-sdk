import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { buildUrl, get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * @internal
 * SerpAPI response types for Google search engine
 */
interface SerpApiSearchResult {
  position: number;
  title: string;
  link: string;
  displayed_link: string;
  snippet: string;
  snippet_highlighted_words?: string[];
  cached_page_link?: string;
  related_pages_link?: string;
  source?: string;
  date?: string;
}

/**
 * @internal
 */
interface SerpApiResponse {
  search_metadata: {
    id: string;
    status: string;
    json_endpoint: string;
    created_at: string;
    processed_at: string;
    google_url: string;
    raw_html_file: string;
    total_time_taken: number;
  };
  search_parameters: {
    engine: string;
    q: string;
    google_domain: string;
    device: string;
    num: number;
    start?: number;
    hl?: string;
    gl?: string;
    safe?: string;
  };
  search_information: {
    organic_results_state: string;
    total_results: number;
    time_taken_displayed: number;
    query_displayed: string;
  };
  organic_results: SerpApiSearchResult[];
  error?: string;
}

/**
 * Defines the configuration options for the SerpAPI search provider.
 */
export interface SerpApiConfig extends ProviderConfig {
  /**
   * The search engine to use (e.g., 'google', 'bing', 'yahoo').
   * @default 'google'
   */
  engine?: string;
  /**
   * The base URL for the SerpAPI.
   * @default 'https://serpapi.com/search.json'
   */
  baseUrl?: string;
}

/**
 * @internal
 * Default base URL for SerpAPI
 */
const DEFAULT_BASE_URL = 'https://serpapi.com/search.json';

/**
 * Creates a new instance of the SerpAPI search provider.
 * This function is typically used through the `serpapi.configure()` method.
 *
 * @param {SerpApiConfig} config - The configuration options for SerpAPI.
 * @returns {SearchProvider} A configured SerpAPI provider instance.
 * @throws {Error} If the API key is missing.
 * @internal
 */
export function createSerpApiProvider(config: SerpApiConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('SerpAPI requires an API key.');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const engine = config.engine || 'google';
  
  return {
    name: 'serpapi',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      const params: Record<string, string | number | boolean | undefined> = {
        engine,
        api_key: config.apiKey,
        q: query,
        num: maxResults,
        start: page > 1 ? (page - 1) * maxResults : 0,
      };
      
      if (language) params.hl = language;
      if (region) params.gl = region;
      if (safeSearch) params.safe = safeSearch;

      const url = buildUrl(baseUrl, params);
      
      debug.logRequest(debugOptions, 'SerpAPI request', { url: url.replace(config.apiKey!, '***') });
      
      try {
        const response = await get<SerpApiResponse>(url, { timeout });
        
        debug.logResponse(debugOptions, 'SerpAPI raw response', {
          itemCount: response.organic_results?.length || 0,
        });
        
        if (response.error) throw new Error(response.error);
        if (!response.organic_results) return [];
        
        return response.organic_results.map((result) => ({
          url: result.link,
          title: result.title,
          snippet: result.snippet,
          domain: result.displayed_link,
          publishedDate: result.date,
          provider: 'serpapi',
          raw: result,
        }));
      } catch (error) {
        let errorMessage = 'SerpAPI search failed';
        if (error instanceof HttpError) {
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        debug.log(debugOptions, 'SerpAPI error', {
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * A search provider for SerpAPI.
 * This provider allows you to query various search engines like Google, Bing, and Yahoo.
 *
 * @example
 * ```typescript
 * import { serpapi, webSearch } from '@plust/search-sdk';
 *
 * const serpapiProvider = serpapi.configure({
 *   apiKey: 'YOUR_SERPAPI_KEY',
 *   engine: 'google'
 * });
 *
 * const results = await webSearch({
 *   query: 'TypeScript best practices',
 *   provider: [serpapiProvider]
 * });
 * ```
 */
export const serpapi: SearchProvider & { configure: (config: SerpApiConfig) => SearchProvider } = {
  name: 'serpapi',
  config: { apiKey: '' },
  
  /**
   * Configures a new instance of the SerpAPI provider.
   * An API key is required to use this provider.
   *
   * @param {SerpApiConfig} config - The configuration options for SerpAPI, including the API key.
   * @returns {SearchProvider} A configured SerpAPI provider instance.
   */
  configure: (config: SerpApiConfig): SearchProvider => createSerpApiProvider(config),
  
  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('SerpAPI provider must be configured before use. Call serpapi.configure() first.');
  }
};