import { SearchResult, WebSearchOptions } from './types';
import { debug } from './utils/debug';
import { HttpError } from './utils/http';

/**
 * Get provider-specific troubleshooting information based on error and status code
 * 
 * @param providerName Name of the search provider
 * @param error The error that occurred
 * @param statusCode HTTP status code if available
 * @returns Troubleshooting suggestions
 */
function getTroubleshootingInfo(providerName: string, error: Error, statusCode?: number): string {
  let suggestions = '';
  
  // Common troubleshooting steps based on status code
  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      suggestions = 'This is likely an authentication issue. Check your API key and make sure it\'s valid and has the correct permissions.';
    } else if (statusCode === 400) {
      suggestions = 'This is likely due to invalid request parameters. Check your query and other search options.';
    } else if (statusCode === 429) {
      suggestions = 'You\'ve exceeded the rate limit for this API. Try again later or reduce your request frequency.';
    } else if (statusCode >= 500) {
      suggestions = 'The search provider is experiencing server issues. Try again later.';
    }
  }
  
  // If the error message contains [object Object], try to improve the formatting
  if (error.message.includes('[object Object]')) {
    suggestions += '\n\nThe error response contains complex data that wasn\'t properly formatted. ' +
      'Try enabling debug mode to see the full response details: { debug: { enabled: true, logResponses: true } }';
  }
  
  // Provider-specific troubleshooting
  switch (providerName) {
    case 'google':
      if (error.message.includes('API key')) {
        suggestions = 'Make sure your Google API key is valid and has the Custom Search API enabled. Also check if your Search Engine ID (cx) is correct.';
      } else if (error.message.includes('quota')) {
        suggestions = 'You\'ve exceeded your Google Custom Search API quota. Check your Google Cloud Console for quota information.';
      }
      break;
    case 'serpapi':
      if (error.message.includes('apiKey')) {
        suggestions = 'Check that your SerpAPI key is valid. Verify that you have enough credits remaining in your SerpAPI account.';
      }
      break;
    case 'brave':
      if (error.message.includes('token')) {
        suggestions = 'Ensure your Brave Search API token is valid. Check your subscription status in the Brave Developer Hub.';
      }
      break;
    case 'searxng':
      if (error.message.includes('not found') || statusCode === 404) {
        suggestions = 'Check if your SearXNG instance URL is correct and that the server is running. Verify the format of your search URL.';
      }
      break;
    default:
      // Generic suggestions if no specific ones are available
      if (!suggestions) {
        suggestions = `Check your ${providerName} API credentials and make sure your search request is valid.`;
      }
  }
  
  return suggestions;
}

/**
 * Main search function that queries a web search provider and returns standardized results
 * 
 * @param options Search options including provider, query and other parameters
 * @returns Promise that resolves to an array of search results
 */
export async function webSearch(options: WebSearchOptions): Promise<SearchResult[]> {
  const { provider, debug: debugOptions, ...searchOptions } = options;
  
  // Validate required options
  if (!provider) {
    throw new Error('A search provider is required');
  }
  
  if (!options.query) {
    throw new Error('A search query is required');
  }
  
  // Log search parameters if debugging is enabled
  debug.log(debugOptions, `Performing search with provider: ${provider.name}`, {
    query: options.query,
    maxResults: options.maxResults,
    provider: provider.name,
    providerConfig: { ...provider.config, apiKey: provider.config.apiKey ? '***' : undefined },
  });
  
  try {
    // Forward debug options to the provider's search method
    const results = await provider.search({ ...searchOptions, debug: debugOptions });
    
    // Log results if debugging is enabled
    debug.logResponse(debugOptions, `Received ${results.length} results from ${provider.name}`);
    
    return results;
  } catch (error) {
    // Extract more information for better error messages
    let statusCode: number | undefined;
    let errorMessage = '';
    
    if (error instanceof HttpError) {
      statusCode = error.statusCode;
      errorMessage = error.message;
    } else if (error instanceof Error) {
      errorMessage = error.message;
    } else {
      errorMessage = String(error);
    }
    
    // Get troubleshooting information
    const troubleshooting = getTroubleshootingInfo(provider.name, 
      error instanceof Error ? error : new Error(String(error)), 
      statusCode);
    
    // Create a detailed error message that ensures troubleshooting is included
    let detailedErrorMessage = `Search with provider '${provider.name}' failed: ${errorMessage}`;
    
    // Only add the diagnostic info and troubleshooting if they exist
    if (troubleshooting && troubleshooting.trim() !== '') {
      detailedErrorMessage += `\n\nTroubleshooting: ${troubleshooting}`;
    }
    
    const detailedError = new Error(detailedErrorMessage);
    
    // Log error details if debugging is enabled
    debug.log(debugOptions, `Search error with provider ${provider.name}`, {
      error: errorMessage,
      statusCode,
      troubleshooting,
      provider: provider.name,
      query: options.query,
      rawError: error instanceof HttpError ? error.parsedResponseBody : undefined
    });
    
    throw detailedError;
  }
}

// Export type definitions
export * from './types';

// Export providers
export * from './providers';

// Export debug utilities
export { debug } from './utils/debug';