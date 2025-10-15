import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { buildUrl, get, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
 * Google Custom Search API response types
 */
interface GoogleSearchItem {
  kind: string;
  title: string;
  htmlTitle: string;
  link: string;
  displayLink: string;
  snippet: string;
  htmlSnippet: string;
  formattedUrl: string;
  htmlFormattedUrl: string;
  pagemap?: {
    cse_thumbnail?: Array<{
      src: string;
      width: string;
      height: string;
    }>;
    metatags?: Array<Record<string, string>>;
    cse_image?: Array<{
      src: string;
    }>;
  };
}

interface GoogleSearchResponse {
  kind: string;
  url: {
    type: string;
    template: string;
  };
  queries: {
    request: Array<{
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
    nextPage?: Array<{
      title: string;
      totalResults: string;
      searchTerms: string;
      count: number;
      startIndex: number;
      inputEncoding: string;
      outputEncoding: string;
      safe: string;
      cx: string;
    }>;
  };
  context: {
    title: string;
  };
  searchInformation: {
    searchTime: number;
    formattedSearchTime: string;
    totalResults: string;
    formattedTotalResults: string;
  };
  items?: GoogleSearchItem[];
}

/**
 * Google Custom Search configuration options
 */
export interface GoogleSearchConfig extends ProviderConfig {
  /** Google Custom Search Engine ID */
  cx: string;
  /** Base URL for Google Custom Search API */
  baseUrl?: string;
}

/**
 * Default base URL for Google Custom Search API
 */
const DEFAULT_BASE_URL = 'https://www.googleapis.com/customsearch/v1';

/**
 * Creates a Google Custom Search API provider instance
 * 
 * @param config Configuration options for Google Custom Search
 * @returns A configured Google Custom Search provider
 */
export function createGoogleProvider(config: GoogleSearchConfig): SearchProvider {
  if (!config.apiKey) {
    throw new Error('Google Custom Search requires an API key');
  }
  
  if (!config.cx) {
    throw new Error('Google Custom Search requires a Search Engine ID (cx)');
  }
  
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;
  
  return {
    name: 'google',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, page = 1, language, region, safeSearch, timeout, debug: debugOptions } = options;
      
      // Calculate start index for pagination
      const start = (page - 1) * maxResults + 1;
      
      // Map SDK parameters to Google API parameters
      const params: Record<string, string | number | undefined> = {
        key: config.apiKey,
        cx: config.cx,
        q: query,
        num: maxResults > 10 ? 10 : maxResults, // Google limits to 10 max results per request
        start,
      };
      
      // Add optional parameters
      if (language) {
        params.lr = `lang_${language}`; // e.g., lang_en
      }
      
      if (region) {
        params.gl = region; // e.g., us
      }
      
      if (safeSearch) {
        params.safe = safeSearch === 'off' ? 'off' : 'active';
      }
      
      const url = buildUrl(baseUrl, params);
      
      // Log request details if debugging is enabled
      debug.logRequest(debugOptions, 'Google Search request', {
        url: config.apiKey ? url.replace(config.apiKey, '***') : url,
        params: {
          ...params,
          key: '***',
        },
      });
      
      try {
        const response = await get<GoogleSearchResponse>(url, { timeout });
        
        // Log response if debugging is enabled
        debug.logResponse(debugOptions, 'Google Search raw response', {
          status: 'success',
          itemCount: response.items?.length || 0,
          totalResults: response.searchInformation?.totalResults || 0,
          searchTime: response.searchInformation?.searchTime || 0,
        });
        
        if (!response.items || response.items.length === 0) {
          debug.log(debugOptions, 'Google Search returned no results');
          return [];
        }
        
        // Transform Google response to standard SearchResult format
        return response.items.map((item) => {
          // Extract domain from the displayLink
          const domain = item.displayLink;
          
          // Attempt to extract published date from metadata if available
          let publishedDate: string | undefined;
          if (item.pagemap?.metatags && item.pagemap.metatags.length > 0) {
            const metatags = item.pagemap.metatags[0];
            publishedDate = metatags['article:published_time'] || 
                            metatags['date'] || 
                            metatags['og:updated_time'];
          }
          
          return {
            url: item.link,
            title: item.title,
            snippet: item.snippet,
            domain,
            publishedDate,
            provider: 'google',
            raw: item,
          };
        });
      } catch (error) {
        // Create detailed error message with diagnostic information
        let errorMessage = 'Google search failed';
        let diagnosticInfo = '';
        
        if (error instanceof HttpError) {
          // Handle specific Google API error codes
          if (error.statusCode === 400) {
            diagnosticInfo = 'Bad request. Check your search parameters, especially cx (Search Engine ID).';
            
            // Try to extract more details from the error response
            if (error.message.includes('Invalid Value')) {
              diagnosticInfo += ' One of your parameter values is invalid.';
            }
          } else if (error.statusCode === 403) {
            if (error.message.includes('API key not valid')) {
              diagnosticInfo = 'Your Google API key is invalid or has expired.';
            } else if (error.message.includes('has not been used')) {
              diagnosticInfo = 'The API key has not been activated for the Custom Search API. Enable it in your Google Cloud Console.';
            } else if (error.message.includes('dailyLimit')) {
              diagnosticInfo = 'You have exceeded your daily quota for the Google Custom Search API.';
            } else if (error.message.includes('userRateLimitExceeded')) {
              diagnosticInfo = 'You are sending too many requests too quickly. Implement rate limiting in your application.';
            } else {
              diagnosticInfo = 'Authorization failed. Verify your API key and search engine ID.';
            }
          }
          
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
        } else {
          errorMessage = `${errorMessage}: ${String(error)}`;
        }
        
        // Add diagnostic info if available
        if (diagnosticInfo) {
          errorMessage = `${errorMessage}\n\nDiagnostic information: ${diagnosticInfo}\n\nGoogle Custom Search API docs: https://developers.google.com/custom-search/v1/introduction`;
        }
        
        // Log detailed error information if debugging is enabled
        debug.log(debugOptions, 'Google Search error', {
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
 * Pre-configured Google Custom Search provider
 * Note: You must call configure before using this provider
 */
export const google = {
  name: 'google',
  config: { apiKey: '', cx: '' },
  
  /**
   * Configure the Google Custom Search provider with your API credentials
   * 
   * @param config Google Custom Search configuration
   * @returns Configured Google Custom Search provider
   */
  configure: (config: GoogleSearchConfig) => createGoogleProvider(config),
  
  /**
   * Search implementation that ensures provider is properly configured before use
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Google provider must be configured before use. Call google.configure() first.');
  }
};