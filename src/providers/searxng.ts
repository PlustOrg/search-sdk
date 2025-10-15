import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
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

interface SearxNGResponse {
  query: string;
  number_of_results: number;
  results: SearxNGResult[];
}

/**
 * SearXNG configuration options
 */
export interface SearxNGConfig extends ProviderConfig {
  /** Base URL for SearXNG instance (without query params) */
  baseUrl: string;
  /** Additional request parameters */
  additionalParams?: Record<string, string>;
}

/**
 * Creates a SearXNG provider instance
 * 
 * @param config Configuration options for SearXNG
 * @returns A configured SearXNG provider
 */
export function createSearxNGProvider(config: SearxNGConfig): SearchProvider {
  if (!config.baseUrl) {
    throw new Error('SearXNG requires a base URL');
  }
  
  return {
    name: 'searxng',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, language, safeSearch, timeout, debug: debugOptions } = options;
      
      // Build query parameters
      const searchUrl = new URL(config.baseUrl);
      searchUrl.searchParams.append('q', query || '');
      searchUrl.searchParams.append('format', 'json');
      
      if (maxResults) {
        searchUrl.searchParams.append('count', maxResults.toString());
      }
      
      if (language) {
        searchUrl.searchParams.append('language', language);
      }
      
      // Map safe search (0=off, 1=moderate, 2=strict)
      if (safeSearch) {
        const safeValue = safeSearch === 'off' ? '0' : 
                          safeSearch === 'moderate' ? '1' : '2';
        searchUrl.searchParams.append('safesearch', safeValue);
      }
      
      // Add any additional parameters
      if (config.additionalParams) {
        Object.entries(config.additionalParams).forEach(([key, value]) => {
          searchUrl.searchParams.append(key, value);
        });
      }
      
      // Add API key if provided (some instances require it)
      if (config.apiKey) {
        searchUrl.searchParams.append('api_key', config.apiKey);
      }
      
      // Log request details if debugging is enabled
      debug.logRequest(debugOptions, 'SearxNG Search request', {
        url: searchUrl.toString().replace(/api_key=([^&]*)/, 'api_key=***'),
        params: {
          q: query,
          count: maxResults,
          language,
          safesearch: safeSearch ? (safeSearch === 'off' ? '0' : safeSearch === 'moderate' ? '1' : '2') : undefined,
          ...config.additionalParams
        }
      });
      
      try {
        const response = await get<SearxNGResponse>(searchUrl.toString(), { timeout });
        
        // Log response if debugging is enabled
        debug.logResponse(debugOptions, 'SearxNG Search raw response', {
          status: 'success',
          itemCount: response.results?.length || 0,
          totalResults: response.number_of_results || 0,
          query: response.query
        });
        
        if (!response.results || response.results.length === 0) {
          debug.log(debugOptions, 'SearxNG Search returned no results');
          return [];
        }
        
        // Transform SearxNG response to standard SearchResult format
        return response.results.map(result => {
          // Extract domain from URL
          let domain;
          try {
            domain = new URL(result.url).hostname;
          } catch {
            domain = undefined;
          }
          
          return {
            url: result.url,
            title: result.title,
            snippet: result.content,
            domain,
            publishedDate: result.publishedDate || undefined,
            provider: 'searxng',
            raw: result,
          };
        });
      } catch (error) {
        // Create detailed error message with diagnostic information
        let errorMessage = 'SearxNG search failed';
        let diagnosticInfo = '';
        
        if (error instanceof HttpError) {
          // Handle specific SearxNG error codes
          if (error.statusCode === 401 || error.statusCode === 403) {
            diagnosticInfo = 'Authentication failed. If your SearxNG instance requires an API key, make sure it\'s correctly configured.';
          } else if (error.statusCode === 429) {
            diagnosticInfo = 'Rate limit exceeded. Your SearxNG instance may have rate limiting enabled.';
          } else if (error.statusCode === 404) {
            diagnosticInfo = 'SearxNG endpoint not found. Check your base URL - it should point to the search endpoint (usually ending with /search).';
          } else if (error.statusCode === 400) {
            diagnosticInfo = 'Bad request. Check your search parameters.';
          } else if (error.statusCode >= 500) {
            diagnosticInfo = 'SearxNG server error. Your instance might be experiencing issues.';
          }
          
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
          
          // Check for common network errors
          if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
            diagnosticInfo = 'Could not connect to SearxNG server. Verify that your SearxNG instance is running and the URL is correct.';
          } else if (error.message.includes('timeout')) {
            diagnosticInfo = 'The request timed out. Your SearxNG instance may be overloaded or unreachable.';
          }
        } else {
          errorMessage = `${errorMessage}: ${String(error)}`;
        }
        
        // Add diagnostic info if available
        if (diagnosticInfo) {
          errorMessage = `${errorMessage}\n\nDiagnostic information: ${diagnosticInfo}\n\nSearxNG docs: https://docs.searxng.org/`;
        }
        
        // Log detailed error information if debugging is enabled
        debug.log(debugOptions, 'SearxNG Search error', {
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
 * Pre-configured SearXNG provider
 * Note: You must call configure before using this provider
 */
export const searxng = {
  name: 'searxng',
  config: { baseUrl: '', apiKey: '' },
  
  /**
   * Configure the SearxNG provider with your instance URL and optional API key
   * 
   * @param config SearxNG configuration
   * @returns Configured SearXNG provider
   */
  configure: (config: SearxNGConfig) => createSearxNGProvider(config),
  
  /**
   * Search implementation that ensures provider is properly configured before use
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('SearxNG provider must be configured before use. Call searxng.configure() first.');
  }
};