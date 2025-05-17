import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { buildUrl, get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
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
 * SerpAPI configuration options
 */
export interface SerpApiConfig extends ProviderConfig {
  /** Search engine to use (e.g., google, bing, yahoo) */
  engine?: string;
  /** Base URL for SerpAPI */
  baseUrl?: string;
}

/**
 * Default base URL for SerpAPI
 */
const DEFAULT_BASE_URL = 'https://serpapi.com/search.json';

/**
 * Creates a SerpAPI provider instance
 * 
 * @param config Configuration options for SerpAPI
 * @returns A configured SerpAPI provider
 */
export function createSerpApiProvider(config: SerpApiConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('SerpAPI requires an API key');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  const engine = config.engine || 'google';
  
  return {
    name: 'serpapi',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      // Map SDK parameters to SerpAPI parameters
      const params: Record<string, string | number | boolean | undefined> = {
        engine,
        api_key: config.apiKey,
        q: query,
        num: maxResults,
        start: page > 1 ? (page - 1) * maxResults + 1 : undefined,
      };
      
      // Add optional parameters
      if (language) {
        params.hl = language; // Interface language
      }
      
      if (region) {
        params.gl = region; // Country/region
      }
      
      if (safeSearch) {
        params.safe = safeSearch;
      }
      
      const url = buildUrl(baseUrl, params);
      
      // Log request details if debugging is enabled
      debug.logRequest(debugOptions, 'SerpAPI request', {
        url: config.apiKey ? url.replace(config.apiKey, '***') : url,
        params: {
          ...params,
          api_key: '***',
        },
      });
      
      try {
        const response = await get<SerpApiResponse>(url, { timeout });
        
        // Log response if debugging is enabled
        debug.logResponse(debugOptions, 'SerpAPI raw response', {
          status: response.error ? 'error' : 'success',
          itemCount: response.organic_results?.length || 0,
          totalResults: response.search_information?.total_results || 0,
          metadata: response.search_metadata,
        });
        
        if (response.error) {
          throw new Error(`SerpAPI error: ${response.error}`);
        }
        
        if (!response.organic_results || response.organic_results.length === 0) {
          debug.log(debugOptions, 'SerpAPI returned no results');
          return [];
        }
        
        // Transform SerpAPI response to standard SearchResult format
        return response.organic_results.map((result) => {
          // Extract domain from displayed_link
          const domain = result.displayed_link?.split('/')[0];
          
          return {
            url: result.link,
            title: result.title,
            snippet: result.snippet,
            domain,
            publishedDate: result.date,
            provider: 'serpapi',
            raw: result,
          };
        });
      } catch (error) {
        // Create detailed error message with diagnostic information
        let errorMessage = 'SerpAPI search failed';
        let diagnosticInfo = '';
        
        if (error instanceof HttpError) {
          // Handle specific SerpAPI error codes
          if (error.statusCode === 401 || error.statusCode === 403) {
            diagnosticInfo = 'Invalid API key or unauthorized access. Check your SerpAPI key.';
          } else if (error.statusCode === 429) {
            diagnosticInfo = 'Rate limit exceeded. You have reached your SerpAPI usage limit. Check your subscription plan.';
          } else if (error.statusCode === 400) {
            diagnosticInfo = 'Bad request. Check your search parameters, especially the engine value.';
            
            // Try to extract more detailed error info
            if (error.message.includes('parameter is missing')) {
              diagnosticInfo += ' A required parameter is missing from your request.';
            }
          } else if (error.statusCode >= 500) {
            diagnosticInfo = 'SerpAPI server error. The service might be experiencing issues. Try again later.';
          }
          
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
          
          // Check for common error messages
          if (error.message.includes('API key')) {
            diagnosticInfo = 'Invalid or missing API key. Check your SerpAPI key.';
          } else if (error.message.includes('quota') || error.message.includes('limit')) {
            diagnosticInfo = 'You have reached your SerpAPI usage limit. Check your subscription plan.';
          }
        } else {
          errorMessage = `${errorMessage}: ${String(error)}`;
        }
        
        // Add diagnostic info if available
        if (diagnosticInfo) {
          errorMessage = `${errorMessage}\n\nDiagnostic information: ${diagnosticInfo}\n\nSerpAPI docs: https://serpapi.com/search-api`;
        }
        
        // Log detailed error information if debugging is enabled
        debug.log(debugOptions, 'SerpAPI error', {
          error: error instanceof Error ? error.message : String(error),
          statusCode: error instanceof HttpError ? error.statusCode : undefined,
          diagnosticInfo,
        });
        
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * Pre-configured SerpAPI provider
 * Note: You must call configure before using this provider
 */
export const serpapi = {
  name: 'serpapi',
  config: { apiKey: '' },
  
  /**
   * Configure the SerpAPI provider with your API credentials
   * 
   * @param config SerpAPI configuration
   * @returns Configured SerpAPI provider
   */
  configure: (config: SerpApiConfig) => createSerpApiProvider(config),
  
  /**
   * Search implementation that ensures provider is properly configured before use
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('SerpAPI provider must be configured before use. Call serpapi.configure() first.');
  }
};