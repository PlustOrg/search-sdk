import { SearchResult, WebSearchOptions } from './types';
import { debug } from './utils/debug';
import { HttpError } from './utils/http';

/**
 * Generates provider-specific troubleshooting information based on an error.
 * This function provides helpful suggestions for common issues related to API keys,
 * request parameters, and rate limits.
 *
 * @param {string} providerName - The name of the search provider (e.g., 'google', 'serpapi').
 * @param {Error} error - The error object thrown by the search provider.
 * @param {number} [statusCode] - The HTTP status code of the error response, if available.
 * @returns {string} A string containing troubleshooting suggestions.
 * @internal
 */
function getTroubleshootingInfo(providerName: string, error: Error, statusCode?: number): string {
  let suggestions = '';
  
  if (statusCode) {
    if (statusCode === 401 || statusCode === 403) {
      suggestions = 'This is likely an authentication issue. Check your API key and ensure it has the correct permissions.';
    } else if (statusCode === 400) {
      suggestions = 'This is likely due to invalid request parameters. Check your query and other search options.';
    } else if (statusCode === 429) {
      suggestions = 'You\'ve exceeded the rate limit for this API. Try again later or reduce your request frequency.';
    } else if (statusCode >= 500) {
      suggestions = 'The search provider is experiencing server issues. Try again later.';
    }
  }
  
  if (error.message.includes('[object Object]')) {
    suggestions += '\n\nThe error response contains complex data that wasn\'t properly formatted. ' +
      'Try enabling debug mode to see the full response: { debug: { enabled: true, logResponses: true } }';
  }
  
  switch (providerName) {
    case 'google':
      suggestions = 'Make sure your Google API key is valid and the Custom Search API is enabled. Also, check if your Search Engine ID (cx) is correct.';
      break;
    case 'serpapi':
      suggestions = 'Check that your SerpAPI key is valid and that you have enough credits in your account.';
      break;
    case 'brave':
      suggestions = 'Ensure your Brave Search API token is valid and your subscription is active.';
      break;
    case 'searxng':
      suggestions = 'Check if your SearXNG instance URL is correct and the server is running.';
      break;
    case 'duckduckgo':
      suggestions = 'DuckDuckGo scraping can be unreliable. This may be a temporary issue. Try again later.';
      break;
  }
  
  return suggestions;
}

/**
 * Performs a web search by querying one or more search providers in parallel.
 * This function aggregates results from the specified providers and returns them
 * in a standardized format. It handles errors gracefully, ensuring that a failure
 * from one provider does not prevent others from returning results.
 *
 * @param {WebSearchOptions} options - The search options, including the query, providers, and other parameters.
 * @returns {Promise<SearchResult[]>} A promise that resolves to an array of search results from all successful providers.
 * @throws {Error} If no search providers are specified, or if all providers fail.
 *
 * @example
 * ```typescript
 * import { google, brave, webSearch } from '@plust/search-sdk';
 *
 * const googleProvider = google.configure({ apiKey: 'YOUR_GOOGLE_KEY', cx: 'YOUR_CX' });
 * const braveProvider = brave.configure({ apiKey: 'YOUR_BRAVE_KEY' });
 *
 * const results = await webSearch({
 *   query: 'TypeScript best practices',
 *   provider: [googleProvider, braveProvider],
 *   maxResults: 5
 * });
 *
 * console.log(results);
 * ```
 */
export async function webSearch(options: WebSearchOptions): Promise<SearchResult[]> {
  const { provider, debug: debugOptions, ...searchOptions } = options;

  if (!provider || provider.length === 0) {
    throw new Error('At least one search provider is required.');
  }

  const hasArxivProvider = provider.some(p => p.name === 'arxiv');
  if (!options.query && !(hasArxivProvider && options.idList)) {
    throw new Error('A search query or ID list (for Arxiv) is required.');
  }

  debug.log(debugOptions, `Performing search with ${provider.length} provider(s): ${provider.map(p => p.name).join(', ')}`);

  const searchPromises = provider.map(async (p) => {
    try {
      const results = await p.search({ ...searchOptions, debug: debugOptions });
      debug.logResponse(debugOptions, `Received ${results.length} results from ${p.name}`);
      return { provider: p.name, results, error: null };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const statusCode = error instanceof HttpError ? error.statusCode : undefined;
      const troubleshooting = getTroubleshootingInfo(p.name, error instanceof Error ? error : new Error(errorMessage), statusCode);

      let detailedErrorMessage = `Search with provider '${p.name}' failed: ${errorMessage}`;
      if (troubleshooting) {
        detailedErrorMessage += `\n\nTroubleshooting: ${troubleshooting}`;
      }

      debug.log(debugOptions, `Search error with provider ${p.name}`, { error: errorMessage, statusCode, troubleshooting });
      return { provider: p.name, results: [], error: new Error(detailedErrorMessage) };
    }
  });

  const searchResults = await Promise.all(searchPromises);

  const allResults: SearchResult[] = [];
  const errors: string[] = [];

  for (const { provider: providerName, results, error } of searchResults) {
    if (error) {
      errors.push(error.message);
    } else {
      allResults.push(...results);
    }
  }

  debug.log(debugOptions, `Search complete: ${allResults.length} total results from ${searchResults.length - errors.length}/${searchResults.length} providers.`);

  if (allResults.length === 0 && errors.length > 0) {
    throw new Error(`All ${provider.length} provider(s) failed:\n\n${errors.join('\n\n')}`);
  }

  return allResults;
}

// Export type definitions
export * from './types';

// Export providers
export * from './providers';

// Export debug utilities
export { debug } from './utils/debug';