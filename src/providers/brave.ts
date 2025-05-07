import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
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
 * Brave Search configuration options
 */
export interface BraveSearchConfig extends ProviderConfig {
  /** Base URL for Brave Search API */
  baseUrl?: string;
}

/**
 * Default base URL for Brave Search API
 */
const DEFAULT_BASE_URL = 'https://api.search.brave.com/res/v1/web/search';

/**
 * Creates a Brave Search provider instance
 * 
 * @param config Configuration options for Brave Search
 * @returns A configured Brave Search provider
 */
export function createBraveProvider(config: BraveSearchConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Brave Search requires an API key');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'brave',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      // Calculate offset for pagination
      const offset = (page - 1) * maxResults;
      
      // Build query parameters
      const searchUrl = new URL(baseUrl);
      searchUrl.searchParams.append('q', query);
      searchUrl.searchParams.append('size', maxResults.toString());
      
      if (offset > 0) {
        searchUrl.searchParams.append('offset', offset.toString());
      }
      
      // Add language and region if available
      if (language) {
        searchUrl.searchParams.append('language', language);
      }
      
      if (region) {
        searchUrl.searchParams.append('country', region);
      }
      
      // Map safe search setting (0=off, 1=moderate, 2=strict)
      if (safeSearch) {
        const safeValue = safeSearch === 'off' ? '0' : 
                          safeSearch === 'moderate' ? '1' : '2';
        searchUrl.searchParams.append('safe', safeValue);
      }
      
      // Set up headers with API token
      const headers = {
        'Accept': 'application/json',
        'X-Subscription-Token': config.apiKey,
      };
      
      // Log request details if debugging is enabled
      debug.logRequest(debugOptions, 'Brave Search request', {
        url: searchUrl.toString(),
        params: {
          q: query,
          size: maxResults,
          offset,
          language,
          country: region,
          safe: safeSearch ? (safeSearch === 'off' ? '0' : safeSearch === 'moderate' ? '1' : '2') : undefined
        }
      });
      
      try {
        const response = await get<BraveSearchResponse>(searchUrl.toString(), { 
          headers,
          timeout,
        });
        
        // Log response if debugging is enabled
        debug.logResponse(debugOptions, 'Brave Search raw response', {
          status: 'success',
          itemCount: response.web?.results?.length || 0,
          totalCount: response.count || 0,
          queryInfo: response.query
        });
        
        // Use web results if available
        const results = response.web?.results || [];
        
        if (results.length === 0) {
          debug.log(debugOptions, 'Brave Search returned no results');
          return [];
        }
        
        // Transform Brave response to standard SearchResult format
        return results.map((item) => {
          // Extract domain from URL
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
        // Create detailed error message with diagnostic information
        let errorMessage = 'Brave search failed';
        let diagnosticInfo = '';
        
        if (error instanceof HttpError) {
          // Handle specific Brave API error codes
          if (error.statusCode === 401) {
            diagnosticInfo = 'Invalid API key. Check your Brave API token (X-Subscription-Token).';
          } else if (error.statusCode === 403) {
            diagnosticInfo = 'Access denied. Your Brave API subscription may have insufficient permissions or has expired.';
          } else if (error.statusCode === 429) {
            diagnosticInfo = 'Rate limit exceeded. You\'ve sent too many requests. Check your Brave API usage limits.';
          } else if (error.statusCode === 400) {
            diagnosticInfo = 'Bad request. Check your search parameters for invalid values.';
          } else if (error.statusCode >= 500) {
            diagnosticInfo = 'Brave Search API server error. The service might be experiencing issues. Try again later.';
          }
          
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
          
          // Check for common error messages
          if (error.message.includes('token') || error.message.includes('key')) {
            diagnosticInfo = 'Invalid or missing API token. Check your Brave API token.';
          }
        } else {
          errorMessage = `${errorMessage}: ${String(error)}`;
        }
        
        // Add diagnostic info if available
        if (diagnosticInfo) {
          errorMessage = `${errorMessage}\n\nDiagnostic information: ${diagnosticInfo}\n\nBrave Search API docs: https://api.search.brave.com/app/documentation`;
        }
        
        // Log detailed error information if debugging is enabled
        debug.log(debugOptions, 'Brave Search error', {
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
 * Pre-configured Brave Search provider
 * Note: You must call configure before using this provider
 */
export const brave = {
  name: 'brave',
  config: { apiKey: '' },
  
  /**
   * Configure the Brave Search provider with your API credentials
   * 
   * @param config Brave Search configuration
   * @returns Configured Brave Search provider
   */
  configure: (config: BraveSearchConfig) => createBraveProvider(config),
  
  /**
   * Search implementation that ensures provider is properly configured before use
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Brave Search provider must be configured before use. Call brave.configure() first.');
  }
};