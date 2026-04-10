import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { post, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * Perplexity Search API response types
 */
interface PerplexitySearchResult {
  title: string;
  url: string;
  snippet: string;
  date: string; // Date page was crawled and added to Perplexity's index
  last_updated: string; // Date page was last updated in Perplexity's index
}

interface PerplexitySearchResponse {
  results: PerplexitySearchResult[];
}

/**
 * Perplexity API configuration options
 */
export interface PerplexityConfig extends ProviderConfig {
  /** Base URL for Perplexity API */
  baseUrl?: string;
  /** Maximum number of tokens to return across all search results (default: 25000) */
  maxTokens?: number;
  /** Maximum number of tokens retrieved from each webpage (default: 2048) */
  maxTokensPerPage?: number;
  /** Country code to filter search results by geographic location. Use ISO 3166-1 alpha-2 country codes (e.g., “US”, “GB”, “DE”, “JP”) */
  country?: string;
  /** Search domain filter - list of domains/URLs to limit search results to (max 20). You can also exclude specific domains from search results. (e.g.,  ["science.org", "pnas.org", "-reddit.com"])  */
  searchDomainFilter?: string[];
  /** Search recency filter (day, week, month, year) */
  searchRecencyFilter?: 'day' | 'week' | 'month' | 'year';
  /** Filter results after a specific date (format: MM/DD/YYYY) */
  searchAfterDate?: string;
  /** Filter results before a specific date (format: MM/DD/YYYY) */
  searchBeforeDate?: string;
  /** Filter search results by language(s) using ISO 639-1 language codes (e.g., ["en", "fr", "de"]) */
  searchLanguageFilter?: string[];
}

/**
 * Perplexity request body interface
 */
interface PerplexityRequestBody {
  query: string;
  max_results?: number;
  max_tokens?: number;
  search_domain_filter?: string[];
  max_tokens_per_page?: number;
  country?: string;
  search_recency_filter?: 'day' | 'week' | 'month' | 'year';
  search_after_date?: string;
  search_before_date?: string;
  search_language_filter?: string[];
}

/**
 * Default base URL for Perplexity API
 */
const DEFAULT_BASE_URL = 'https://api.perplexity.ai/search';

/**
 * Creates a Perplexity provider instance
 * 
 * @param config Configuration options for Perplexity
 * @returns A configured Perplexity provider
 */
export function createPerplexityProvider(config: PerplexityConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Perplexity requires an API key');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'perplexity',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { 
        query, 
        maxResults = 10, 
        region, 
        language, 
        timeout, 
        debug: debugOptions 
      } = options;
      
      if (!query) {
        throw new Error('Perplexity search requires a query.');
      }
      
      // Prepare request body with Perplexity-specific parameters
      const requestBody: PerplexityRequestBody = {
        query: query,
      };
      
      // Add Perplexity-specific parameters from config and options
      if (maxResults !== undefined) {
        // Ensure maxResults is within the valid range for Perplexity (1-20)
        const validMaxResults = Math.max(1, Math.min(20, maxResults));
        requestBody.max_results = validMaxResults;
      }
      
      if (config.maxTokens !== undefined) {
        requestBody.max_tokens = config.maxTokens;
      }
      
      if (config.searchDomainFilter) {
        requestBody.search_domain_filter = config.searchDomainFilter;
      }
      
      if (config.maxTokensPerPage !== undefined) {
        requestBody.max_tokens_per_page = config.maxTokensPerPage;
      }
      
      if (region) {
        requestBody.country = region;
      } else if (config.country) {
        requestBody.country = config.country;
      }
      
      if (config.searchRecencyFilter) {
        requestBody.search_recency_filter = config.searchRecencyFilter;
      }
      
      if (config.searchAfterDate) {
        requestBody.search_after_date = config.searchAfterDate;
      }
      
      if (config.searchBeforeDate) {
        requestBody.search_before_date = config.searchBeforeDate;
      }
      
      // Add language filter if specified in config or options
      if (config.searchLanguageFilter) {
        requestBody.search_language_filter = config.searchLanguageFilter;
      } else if (language) {
        // If language is provided in options, use it as the search language filter
        requestBody.search_language_filter = [language];
      }
      
      // Log request details if debugging is enabled
      debug.logRequest(debugOptions, 'Perplexity Search request', {
        url: baseUrl,
        body: {
          ...requestBody,
          apiKey: '***' // Hide API key in logs
        }
      });
      
      try {
        const response = await post<PerplexitySearchResponse>(baseUrl, requestBody, { 
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout,
        });
        
        // Log response if debugging is enabled
        debug.logResponse(debugOptions, 'Perplexity Search raw response', {
          status: 'success',
          itemCount: response.results?.length || 0,
          query: query,
        });
        
        if (!response.results || response.results.length === 0) {
          debug.log(debugOptions, 'Perplexity Search returned no results');
          return [];
        }
        
        // Transform Perplexity response to standard SearchResult format
        return response.results.map(result => {
          // Extract domain from URL
          let domain;
          try {
            domain = new URL(result.url).hostname;
          } catch {
            domain = undefined;
          }
          
          // Use the most appropriate date field available
          const publishedDate = result.last_updated || result.date;
          
          return {
            url: result.url,
            title: result.title,
            snippet: result.snippet,
            domain,
            publishedDate,
            provider: 'perplexity',
            raw: result,
          };
        });
      } catch (error) {
        // Create detailed error message with diagnostic information
        let errorMessage = 'Perplexity search failed';
        let diagnosticInfo = '';
        
        if (error instanceof HttpError) {
          // Handle specific Perplexity API error codes
          if (error.statusCode === 401) {
            diagnosticInfo = 'Invalid API key. Check your Perplexity API key.';
          } else if (error.statusCode === 403) {
            diagnosticInfo = 'Access denied. Your Perplexity API key may have insufficient permissions or has expired.';
          } else if (error.statusCode === 429) {
            diagnosticInfo = 'Rate limit exceeded. You have reached your Perplexity API quota or sent too many requests.';
          } else if (error.statusCode === 400) {
            diagnosticInfo = 'Bad request. Check your search parameters.';
            
            // Try to extract more detailed error info
            if (error.message.includes('max_results')) {
              diagnosticInfo += ' Invalid max_results value. Must be between 1 and 20.';
            } else if (error.message.includes('search_recency_filter')) {
              diagnosticInfo += ' Invalid search_recency_filter. Use "day", "week", "month", or "year".';
            } else if (error.message.includes('search_after_date') || error.message.includes('search_before_date')) {
              diagnosticInfo += ' Invalid date format. Use MM/DD/YYYY format.';
            }
          } else if (error.statusCode >= 500) {
            diagnosticInfo = 'Perplexity server error. The service might be experiencing issues. Try again later.';
          }
          
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
          
          // Check for common error messages
          if (error.message.includes('api_key') || error.message.includes('apiKey')) {
            diagnosticInfo = 'Authentication issue. Check your Perplexity API key.';
          } else if (error.message.includes('timeout')) {
            diagnosticInfo = 'The request timed out. Try increasing the timeout value or simplifying your query.';
          }
        } else {
          errorMessage = `${errorMessage}: ${String(error)}`;
        }
        
        // Add diagnostic info if available
        if (diagnosticInfo) {
          errorMessage = `${errorMessage}\n\nDiagnostic information: ${diagnosticInfo}\n\nPerplexity API docs: https://docs.perplexity.ai/api-reference`;
        }
        
        // Log detailed error information if debugging is enabled
        debug.log(debugOptions, 'Perplexity Search error', {
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
 * Pre-configured Perplexity provider
 * Note: You must call configure before using this provider
 */
export const perplexity = {
  name: 'perplexity',
  config: { apiKey: '' },
  
  /**
   * Configure the Perplexity provider with your API credentials
   * 
   * @param config Perplexity configuration
   * @returns Configured Perplexity provider
   */
  configure: (config: PerplexityConfig) => createPerplexityProvider(config),
  
  /**
   * Search implementation that ensures provider is properly configured before use
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Perplexity provider must be configured before use. Call perplexity.configure() first.');
  }
};
