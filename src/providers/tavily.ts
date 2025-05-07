import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { post, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
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
 * Tavily configuration options
 */
export interface TavilyConfig extends ProviderConfig {
  /** Base URL for Tavily API */
  baseUrl?: string;
  /** Whether to include answers in response */
  includeAnswer?: boolean;
  /** Sort results by relevance or date */
  sortBy?: 'relevance' | 'date';
  /** Search depth (basic or comprehensive) */
  searchDepth?: 'basic' | 'comprehensive';
}

/**
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
 * Default base URL for Tavily API
 */
const DEFAULT_BASE_URL = 'https://api.tavily.com/search';

/**
 * Creates a Tavily provider instance
 * 
 * @param config Configuration options for Tavily
 * @returns A configured Tavily provider
 */
export function createTavilyProvider(config: TavilyConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Tavily requires an API key');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'tavily',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      // Prepare request body
      const requestBody: TavilyRequestBody = {
        api_key: config.apiKey,
        query,
        limit: maxResults,
        include_answer: config.includeAnswer || false,
        search_depth: config.searchDepth || 'basic',
        sort_by: config.sortBy || 'relevance',
      };
      
      // Add optional parameters
      if (language || region) {
        requestBody.locale = region ? 
          `${language || 'en'}-${region.toUpperCase()}` : 
          language;
      }
      
      if (safeSearch && safeSearch !== 'moderate') {
        requestBody.safe_search = safeSearch === 'strict';
      }
      
      if (page > 1) {
        requestBody.page = page;
      }
      
      // Log request details if debugging is enabled
      debug.logRequest(debugOptions, 'Tavily Search request', {
        url: baseUrl,
        body: {
          ...requestBody,
          api_key: '***' // Hide API key in logs
        }
      });
      
      try {
        const response = await post<TavilySearchResponse>(baseUrl, requestBody, { timeout });
        
        // Log response if debugging is enabled
        debug.logResponse(debugOptions, 'Tavily Search raw response', {
          status: 'success',
          itemCount: response.results?.length || 0,
          searchId: response.search_id,
          query: response.query,
          searchDepth: response.search_depth
        });
        
        if (!response.results || response.results.length === 0) {
          debug.log(debugOptions, 'Tavily Search returned no results');
          return [];
        }
        
        // Transform Tavily response to standard SearchResult format
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
            publishedDate: result.published_date,
            provider: 'tavily',
            raw: result,
          };
        });
      } catch (error) {
        // Create detailed error message with diagnostic information
        let errorMessage = 'Tavily search failed';
        let diagnosticInfo = '';
        
        if (error instanceof HttpError) {
          // Handle specific Tavily API error codes
          if (error.statusCode === 401) {
            diagnosticInfo = 'Invalid API key. Check your Tavily API key.';
          } else if (error.statusCode === 403) {
            diagnosticInfo = 'Access denied. Your Tavily API key may have insufficient permissions or has expired.';
          } else if (error.statusCode === 429) {
            diagnosticInfo = 'Rate limit exceeded. You have reached your Tavily API quota or sent too many requests.';
          } else if (error.statusCode === 400) {
            diagnosticInfo = 'Bad request. Check your search parameters, especially the query, limit and search_depth values.';
            
            // Try to extract more detailed error info
            if (error.message.includes('search_depth')) {
              diagnosticInfo += ' Invalid search_depth. Use "basic" or "comprehensive".';
            } else if (error.message.includes('sort_by')) {
              diagnosticInfo += ' Invalid sort_by value. Use "relevance" or "date".';
            }
          } else if (error.statusCode >= 500) {
            diagnosticInfo = 'Tavily server error. The service might be experiencing issues. Try again later.';
          }
          
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
          
          // Check for common error messages
          if (error.message.includes('api_key') || error.message.includes('apiKey')) {
            diagnosticInfo = 'Authentication issue. Check your Tavily API key.';
          } else if (error.message.includes('timeout')) {
            diagnosticInfo = 'The request timed out. Try increasing the timeout value, using "basic" search_depth, or simplifying your query.';
          }
        } else {
          errorMessage = `${errorMessage}: ${String(error)}`;
        }
        
        // Add diagnostic info if available
        if (diagnosticInfo) {
          errorMessage = `${errorMessage}\n\nDiagnostic information: ${diagnosticInfo}\n\nTavily API docs: https://docs.tavily.com/docs/tavily-api/search`;
        }
        
        // Log detailed error information if debugging is enabled
        debug.log(debugOptions, 'Tavily Search error', {
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
 * Pre-configured Tavily provider
 * Note: You must call configure before using this provider
 */
export const tavily = {
  name: 'tavily',
  config: { apiKey: '' },
  
  /**
   * Configure the Tavily provider with your API credentials
   * 
   * @param config Tavily configuration
   * @returns Configured Tavily provider
   */
  configure: (config: TavilyConfig) => createTavilyProvider(config),
  
  /**
   * Search implementation that ensures provider is properly configured before use
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Tavily provider must be configured before use. Call tavily.configure() first.');
  }
};