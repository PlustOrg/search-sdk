import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { post, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * @internal
 * Exa API response types
 */
interface ExaSearchResult {
  title: string;
  url: string;
  text: string;
  relevance_score?: number;
  publish_date?: string;
  author?: string;
  document_id?: string;
}

/**
 * @internal
 */
interface ExaSearchResponse {
  results: ExaSearchResult[];
  query: string;
}

/**
 * Defines the configuration options for the Exa search provider.
 */
export interface ExaConfig extends ProviderConfig {
  /**
   * The base URL for the Exa API.
   * @default 'https://api.exa.ai/search'
   */
  baseUrl?: string;
  /**
   * The search model to use.
   * 'keyword' is for traditional keyword-based search.
   * 'embeddings' is for semantic search.
   * @default 'keyword'
   */
  model?: 'keyword' | 'embeddings';
  /**
   * If true, includes the extracted content of the search results.
   * @default false
   */
  includeContents?: boolean;
}

/**
 * @internal
 * Default base URL for Exa API
 */
const DEFAULT_BASE_URL = 'https://api.exa.ai/search';

/**
 * Creates a new instance of the Exa search provider.
 * This function is typically used through the `exa.configure()` method.
 *
 * @param {ExaConfig} config - The configuration options for Exa.
 * @returns {SearchProvider} A configured Exa provider instance.
 * @throws {Error} If the API key is missing.
 * @internal
 */
export function createExaProvider(config: ExaConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Exa requires an API key');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'exa',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, timeout, debug: debugOptions } = options;
      
      const headers = {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      };
      
      const requestBody = {
        query,
        numResults: maxResults,
        useAutoprompt: true,
      };
      
      debug.logRequest(debugOptions, 'Exa Search request', {
        url: baseUrl,
        headers: { 'x-api-key': '***' },
        body: requestBody
      });
      
      try {
        const response = await post<ExaSearchResponse>(baseUrl, requestBody, { 
          headers,
          timeout,
        });
        
        debug.logResponse(debugOptions, 'Exa Search raw response', {
          itemCount: response.results?.length || 0,
        });
        
        if (!response.results || response.results.length === 0) {
          debug.log(debugOptions, 'Exa Search returned no results');
          return [];
        }
        
        return response.results.map(result => {
          let domain;
          try {
            domain = new URL(result.url).hostname;
          } catch {
            domain = undefined;
          }
          
          return {
            url: result.url,
            title: result.title,
            snippet: result.text,
            domain,
            publishedDate: result.publish_date,
            provider: 'exa',
            raw: result,
          };
        });
      } catch (error) {
        let errorMessage = 'Exa search failed';
        if (error instanceof HttpError) {
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        }
        
        debug.log(debugOptions, 'Exa Search error', {
          error: error instanceof Error ? error.message : String(error),
        });
        
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * A search provider for the Exa API.
 * This provider allows you to perform both keyword and semantic searches.
 *
 * @example
 * ```typescript
 * import { exa, webSearch } from '@plust/search-sdk';
 *
 * const exaProvider = exa.configure({
 *   apiKey: 'YOUR_EXA_API_KEY',
 *   model: 'keyword'
 * });
 *
 * const results = await webSearch({
 *   query: 'machine learning papers',
 *   provider: [exaProvider]
 * });
 * ```
 */
export const exa: SearchProvider & { configure: (config: ExaConfig) => SearchProvider } = {
  name: 'exa',
  config: { apiKey: '' },
  
  /**
   * Configures a new instance of the Exa provider.
   * An API key is required to use this provider.
   *
   * @param {ExaConfig} config - The configuration options for Exa, including the API key.
   * @returns {SearchProvider} A configured Exa provider instance.
   */
  configure: (config: ExaConfig): SearchProvider => createExaProvider(config),
  
  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Exa provider must be configured before use. Call exa.configure() first.');
  }
};