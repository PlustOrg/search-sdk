import { SearchOptions, SearchProvider, SearchResult, ProviderConfig } from '../types';
import { post, HttpError } from '../utils/http';
import { debug } from '../utils/debug';

/**
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

interface ExaSearchResponse {
  results: ExaSearchResult[];
  query: string;
}

/**
 * Exa configuration options
 */
export interface ExaConfig extends ProviderConfig {
  /** Base URL for Exa API */
  baseUrl?: string;
  /** Search model to use (keyword or embeddings) */
  model?: 'keyword' | 'embeddings';
  /** Whether to include content extraction */
  includeContents?: boolean;
}

/**
 * Default base URL for Exa API
 */
const DEFAULT_BASE_URL = 'https://api.exa.ai/search';

/**
 * Creates an Exa provider instance
 * 
 * @param config Configuration options for Exa
 * @returns A configured Exa provider
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
      
      // Prepare headers with authorization token
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      };
      
      // Prepare request body
      const requestBody = {
        query,
        max_results: maxResults,
        model: config.model || 'keyword',
        include_contents: config.includeContents || false,
        timeout: timeout || undefined,
      };
      
      // Log request details if debugging is enabled
      debug.logRequest(debugOptions, 'Exa Search request', {
        url: baseUrl,
        headers: { Authorization: 'Bearer ***' },
        body: requestBody
      });
      
      try {
        const response = await post<ExaSearchResponse>(baseUrl, requestBody, { 
          headers,
          timeout,
        });
        
        // Log response if debugging is enabled
        debug.logResponse(debugOptions, 'Exa Search raw response', {
          status: 'success',
          itemCount: response.results?.length || 0,
          query: response.query
        });
        
        if (!response.results || response.results.length === 0) {
          debug.log(debugOptions, 'Exa Search returned no results');
          return [];
        }
        
        // Transform Exa response to standard SearchResult format
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
            snippet: result.text,
            domain,
            publishedDate: result.publish_date,
            provider: 'exa',
            raw: result,
          };
        });
      } catch (error) {
        // Create detailed error message with diagnostic information
        let errorMessage = 'Exa search failed';
        let diagnosticInfo = '';
        
        if (error instanceof HttpError) {
          // Handle specific Exa API error codes
          if (error.statusCode === 401) {
            diagnosticInfo = 'Invalid API key. Check your Exa API token in the Authorization header.';
          } else if (error.statusCode === 403) {
            diagnosticInfo = 'Access denied. Your Exa API token may have insufficient permissions or has expired.';
          } else if (error.statusCode === 429) {
            diagnosticInfo = 'Rate limit exceeded. You have reached your Exa API quota or sent too many requests.';
          } else if (error.statusCode === 400) {
            diagnosticInfo = 'Bad request. Check your search parameters, especially the query and model values.';
            
            // Try to extract more detailed error info
            if (error.message.includes('model')) {
              diagnosticInfo += ' Invalid model specified. Use "keyword" or "embeddings".';
            } else if (error.message.includes('max_results')) {
              diagnosticInfo += ' Invalid max_results value. Make sure it\'s a positive number.';
            }
          } else if (error.statusCode >= 500) {
            diagnosticInfo = 'Exa server error. The service might be experiencing issues. Try again later.';
          }
          
          errorMessage = `${errorMessage}: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `${errorMessage}: ${error.message}`;
          
          // Check for common error messages
          if (error.message.includes('token') || error.message.includes('key')) {
            diagnosticInfo = 'Authentication issue. Check your Exa API token.';
          } else if (error.message.includes('timeout')) {
            diagnosticInfo = 'The request timed out. Try increasing the timeout value or simplifying your query.';
          }
        } else {
          errorMessage = `${errorMessage}: ${String(error)}`;
        }
        
        // Add diagnostic info if available
        if (diagnosticInfo) {
          errorMessage = `${errorMessage}\n\nDiagnostic information: ${diagnosticInfo}\n\nExa API docs: https://docs.exa.ai/reference/search`;
        }
        
        // Log detailed error information if debugging is enabled
        debug.log(debugOptions, 'Exa Search error', {
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
 * Pre-configured Exa provider
 * Note: You must call configure before using this provider
 */
export const exa = {
  name: 'exa',
  config: { apiKey: '' },
  
  /**
   * Configure the Exa provider with your API credentials
   * 
   * @param config Exa configuration
   * @returns Configured Exa provider
   */
  configure: (config: ExaConfig) => createExaProvider(config),
  
  /**
   * Search implementation that ensures provider is properly configured before use
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Exa provider must be configured before use. Call exa.configure() first.');
  }
};