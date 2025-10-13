import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * @internal
 * Brave Search API response types
 */
interface BraveSearchWeb {
  title: string;
  url: string;
  description: string;
  is_source_from_meta: boolean;
  is_source_local: boolean;
  language: string;
  family_friendly: boolean;
  meta_url?: {
    scheme: string;
    netloc: string;
    path: string;
    query: string;
    fragment: string;
  };
  profile?: {
    name: string;
    short_name: string;
    search_url: string;
    image?: string;
  };
  age?: string;
  type?: string;
}

/**
 * @internal
 */
interface BraveSearchResponse {
  type: string;
  query: {
    original: string;
    show_strict_warning: boolean;
    is_navigational: boolean;
    is_media_query: boolean;
    locale: {
      country: string;
      language: string;
    };
  };
  mixed: {
    type: string;
    main: {
      type: string;
      results: BraveSearchWeb[];
    };
    top?: {
      type: string;
      results: BraveSearchWeb[];
    };
  };
  web: {
    type: string;
    results: BraveSearchWeb[];
  };
  news?: {
    type: string;
    results: BraveSearchWeb[];
  };
  count: number;
}

/**
 * Defines the configuration options for the Brave search provider.
 */
export interface BraveSearchConfig extends ProviderConfig {
  /**
   * The base URL for the Brave Search API.
   * @default 'https://api.search.brave.com/res/v1/web/search'
   */
  baseUrl?: string;
}

/**
 * @internal
 * Default base URL for Brave Search API
 */
const DEFAULT_BASE_URL = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Creates a new instance of the Brave search provider.
 * This function is typically used through the `brave.configure()` method.
 *
 * @param {BraveSearchConfig} config - The configuration options for Brave Search.
 * @returns {SearchProvider} A configured Brave Search provider instance.
 * @throws {Error} If the API key is missing.
 * @internal
 */
export function createBraveProvider(config: BraveSearchConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Brave Search requires an API key.');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'brave',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      const offset = (page - 1) * maxResults;
      
      if (!query) {
        throw new Error('Brave search requires a query.');
      }

      const searchUrl = new URL(baseUrl);
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('count', maxResults.toString());
      
      if (offset > 0) {
        searchUrl.searchParams.append('offset', offset.toString());
      }
      
      if (language) {
        searchUrl.searchParams.append('language', language);
      }
      
      if (region) {
        searchUrl.searchParams.append('country', region);
      }
      
      if (safeSearch) {
        const safeValue = safeSearch === 'off' ? 'off' :
                          safeSearch === 'moderate' ? 'moderate' : 'strict';
        searchUrl.searchParams.append('safesearch', safeValue);
      }
      
      const headers = {
        'Accept': 'application/json',
        'X-Subscription-Token': config.apiKey || '',
      };
      
      debug.logRequest(debugOptions, 'Brave Search request', {
        url: searchUrl.toString(),
      });
      
      try {
        const response = await get<BraveSearchResponse>(searchUrl.toString(), { 
          headers,
          timeout,
        });
        
        debug.logResponse(debugOptions, 'Brave Search raw response', {
          itemCount: response.web?.results?.length || 0,
        });
        
        const results = response.web?.results || [];
        
        if (results.length === 0) {
          debug.log(debugOptions, 'Brave Search returned no results');
          return [];
        }
        
        return results.map((item) => {
          let domain;
          try {
            domain = new URL(item.url).hostname;
          } catch {
            domain = undefined;
          }
          
          return {
            url: item.url,
            title: item.title,
            snippet: item.description,
            domain,
            publishedDate: item.age,
            provider: 'brave',
            raw: item,
          };
        });
      } catch (error) {
        let errorMessage = 'Brave search failed';
        if (error instanceof HttpError) {
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        debug.log(debugOptions, 'Brave Search error', {
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * A search provider for the Brave Search API.
 * This provider allows you to query the Brave search engine for web results.
 *
 * @example
 * ```typescript
 * import { brave, webSearch } from '@plust/search-sdk';
 *
 * const braveProvider = brave.configure({
 *   apiKey: 'YOUR_BRAVE_API_KEY'
 * });
 *
 * const results = await webSearch({
 *   query: 'privacy-focused browsers',
 *   provider: [braveProvider],
 *   maxResults: 10
 * });
 * ```
 */
export const brave: SearchProvider & { configure: (config: BraveSearchConfig) => SearchProvider } = {
  name: 'brave',
  config: { apiKey: '' },
  
  /**
   * Configures a new instance of the Brave Search provider.
   * An API key is required to use this provider.
   *
   * @param {BraveSearchConfig} config - The configuration options for Brave Search, including the API key.
   * @returns {SearchProvider} A configured Brave Search provider instance.
   */
  configure: (config: BraveSearchConfig): SearchProvider => createBraveProvider(config),
  
  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Brave Search provider must be configured before use. Call brave.configure() first.');
  }
};