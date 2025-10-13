import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { post, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * @internal
 * Tavily API response types
 */
interface TavilySearchResult {
  title: string;
  url: string;
  content: string;
  score: number;
  source?: string;
  published_date?: string;
}

/**
 * @internal
 */
interface TavilySearchResponse {
  query: string;
  results: TavilySearchResult[];
  search_id: string;
  search_depth?: string;
  max_results?: number;
  include_answer?: boolean;
  include_raw_content?: boolean;
  answer?: string;
}

/**
 * Defines the configuration options for the Tavily search provider.
 */
export interface TavilyConfig extends ProviderConfig {
  /**
   * The base URL for the Tavily API.
   * @default 'https://api.tavily.com/search'
   */
  baseUrl?: string;
  /**
   * If true, includes a concise answer to the search query in the response.
   * @default false
   */
  includeAnswer?: boolean;
  /**
   * The sorting preference for the search results.
   * @default 'relevance'
   */
  sortBy?: 'relevance' | 'date';
  /**
   * The depth of the search. 'basic' is faster, while 'comprehensive' provides more in-depth results.
   * @default 'basic'
   */
  searchDepth?: 'basic' | 'comprehensive';
}

/**
 * @internal
 * Tavily request body interface
 */
interface TavilyRequestBody {
  api_key: string;
  query: string;
  limit: number;
  include_answer: boolean;
  search_depth: 'basic' | 'comprehensive';
  sort_by: 'relevance' | 'date';
  locale?: string;
  safe_search?: boolean;
  page?: number;
}

/**
 * @internal
 * Default base URL for Tavily API
 */
const DEFAULT_BASE_URL = 'https://api.tavily.com/search';

/**
 * Creates a new instance of the Tavily search provider.
 * This function is typically used through the `tavily.configure()` method.
 *
 * @param {TavilyConfig} config - The configuration options for Tavily.
 * @returns {SearchProvider} A configured Tavily provider instance.
 * @throws {Error} If the API key is missing.
 * @internal
 */
export function createTavilyProvider(config: TavilyConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Tavily requires an API key.');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'tavily',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      const requestBody: TavilyRequestBody = {
        api_key: config.apiKey || '',
        query: query || '',
        limit: maxResults,
        include_answer: config.includeAnswer || false,
        search_depth: config.searchDepth || 'basic',
        sort_by: config.sortBy || 'relevance',
      };
      
      if (language || region) {
        requestBody.locale = region ? `${language || 'en'}-${region.toUpperCase()}` : language;
      }
      
      if (safeSearch && safeSearch !== 'moderate') {
        requestBody.safe_search = safeSearch === 'strict';
      }
      
      if (page > 1) {
        requestBody.page = page;
      }
      
      debug.logRequest(debugOptions, 'Tavily Search request', {
        url: baseUrl,
        body: { ...requestBody, api_key: '***' }
      });
      
      try {
        const response = await post<TavilySearchResponse>(baseUrl, requestBody, { timeout });
        
        debug.logResponse(debugOptions, 'Tavily Search raw response', {
          itemCount: response.results?.length || 0,
        });
        
        if (!response.results) return [];
        
        return response.results.map(result => ({
          url: result.url,
          title: result.title,
          snippet: result.content,
          domain: result.source,
          publishedDate: result.published_date,
          provider: 'tavily',
          raw: result,
        }));
      } catch (error) {
        let errorMessage = 'Tavily search failed';
        if (error instanceof HttpError) {
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        debug.log(debugOptions, 'Tavily Search error', {
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * A search provider for the Tavily API.
 * Tavily is a search engine built for AI developers, providing concise and relevant results.
 *
 * @example
 * ```typescript
 * import { tavily, webSearch } from '@plust/search-sdk';
 *
 * const tavilyProvider = tavily.configure({
 *   apiKey: 'YOUR_TAVILY_API_KEY',
 *   searchDepth: 'comprehensive',
 *   includeAnswer: true
 * });
 *
 * const results = await webSearch({
 *   query: 'climate change evidence',
 *   provider: [tavilyProvider]
 * });
 * ```
 */
export const tavily: SearchProvider & { configure: (config: TavilyConfig) => SearchProvider } = {
  name: 'tavily',
  config: { apiKey: '' },
  
  /**
   * Configures a new instance of the Tavily provider.
   * An API key is required to use this provider.
   *
   * @param {TavilyConfig} config - The configuration options for Tavily, including the API key.
   * @returns {SearchProvider} A configured Tavily provider instance.
   */
  configure: (config: TavilyConfig): SearchProvider => createTavilyProvider(config),
  
  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Tavily provider must be configured before use. Call tavily.configure() first.');
  }
};