import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * @internal
 * SearXNG API response types
 */
interface SearxNGResult {
  url: string;
  title: string;
  content: string;
  publishedDate: string | null;
  thumbnail?: string;
  engine?: string;
  template?: string;
  parsed_url?: string[];
  img_src?: string;
  priority?: string;
  engines?: string[];
  positions?: number[];
  score?: number;
  category?: string;
}

/**
 * @internal
 */
interface SearxNGResponse {
  query: string;
  number_of_results: number;
  results: SearxNGResult[];
}

/**
 * Defines the configuration options for the SearXNG search provider.
 */
export interface SearxNGConfig extends ProviderConfig {
  /**
   * The base URL of your SearXNG instance (e.g., 'https://searx.example.com/search').
   */
  baseUrl: string;
  /**
   * A record of additional parameters to include in every search request.
   * This can be used to specify default engines, categories, etc.
   */
  additionalParams?: Record<string, string>;
}

/**
 * Creates a new instance of the SearXNG search provider.
 * This function is typically used through the `searxng.configure()` method.
 *
 * @param {SearxNGConfig} config - The configuration options for SearXNG.
 * @returns {SearchProvider} A configured SearXNG provider instance.
 * @throws {Error} If the base URL is missing.
 * @internal
 */
export function createSearxNGProvider(config: SearxNGConfig): SearchProvider {
  if (!config.baseUrl) {
    throw new Error('SearXNG requires a base URL.');
  }
  
  return {
    name: 'searxng',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, language, safeSearch, timeout, debug: debugOptions } = options;
      
      const searchUrl = new URL(config.baseUrl);
      searchUrl.searchParams.append('q', query || '');
      searchUrl.searchParams.append('format', 'json');
      
      if (maxResults) {
        searchUrl.searchParams.append('count', maxResults.toString());
      }
      
      if (language) {
        searchUrl.searchParams.append('language', language);
      }
      
      if (safeSearch) {
        const safeValue = safeSearch === 'off' ? '0' : 
                          safeSearch === 'moderate' ? '1' : '2';
        searchUrl.searchParams.append('safesearch', safeValue);
      }
      
      if (config.additionalParams) {
        Object.entries(config.additionalParams).forEach(([key, value]) => {
          searchUrl.searchParams.append(key, value);
        });
      }
      
      if (config.apiKey) {
        searchUrl.searchParams.append('api_key', config.apiKey);
      }
      
      debug.logRequest(debugOptions, 'SearxNG Search request', { url: searchUrl.toString() });
      
      try {
        const response = await get<SearxNGResponse>(searchUrl.toString(), { timeout });
        
        debug.logResponse(debugOptions, 'SearxNG Search raw response', {
          itemCount: response.results?.length || 0,
        });
        
        if (!response.results) return [];
        
        return response.results.map(result => ({
          url: result.url,
          title: result.title,
          snippet: result.content,
          domain: result.parsed_url?.[1],
          publishedDate: result.publishedDate || undefined,
          provider: 'searxng',
          raw: result,
        }));
      } catch (error) {
        let errorMessage = 'SearxNG search failed';
        if (error instanceof HttpError) {
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        debug.log(debugOptions, 'SearxNG Search error', {
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * A search provider for self-hosted SearXNG instances.
 * This provider allows you to query your own metasearch engine.
 *
 * @example
 * ```typescript
 * import { searxng, webSearch } from '@plust/search-sdk';
 *
 * const searxngProvider = searxng.configure({
 *   baseUrl: 'http://127.0.0.1:8080/search',
 *   additionalParams: {
 *     categories: 'general',
 *     engines: 'google,brave,duckduckgo'
 *   }
 * });
 *
 * const results = await webSearch({
 *   query: 'open source software',
 *   provider: [searxngProvider]
 * });
 * ```
 */
export const searxng: SearchProvider & { configure: (config: SearxNGConfig) => SearchProvider } = {
  name: 'searxng',
  config: { baseUrl: '' },
  
  /**
   * Configures a new instance of the SearXNG provider.
   * A base URL for your SearXNG instance is required.
   *
   * @param {SearxNGConfig} config - The configuration options for SearXNG.
   * @returns {SearchProvider} A configured SearXNG provider instance.
   */
  configure: (config: SearxNGConfig): SearchProvider => createSearxNGProvider(config),
  
  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('SearxNG provider must be configured before use. Call searxng.configure() first.');
  }
};