import { debug, HttpError, get } from '../utils';
import { SearchProvider, SearchResult, SearchOptions, ProviderConfig } from '../types';
import { parseStringPromise } from 'xml2js';

/**
 * Arxiv API (Atom 1.0 XML) feed structure.
 * Based on http://export.arxiv.org/api_help/docs/user-manual.html#_response_format
 */
interface ArxivAtomLink {
  _attributes: {
    href: string;
    rel: string;
    type?: string;
    title?: string;
  };
}

interface ArxivAtomAuthor {
  name: string | { _text: string }; // Sometimes it's just a string, sometimes an object
}

interface ArxivAtomCategory {
  _attributes: {
    term: string;
    scheme?: string;
  };
}

interface ArxivAtomEntry {
  id: string | { _text: string }; // Typically a URL string like http://arxiv.org/abs/2305.02392v1
  updated: string | { _text: string };
  published: string | { _text: string };
  title: string | { _text: string };
  summary: string | { _text: string }; // Abstract
  author: ArxivAtomAuthor | ArxivAtomAuthor[];
  link: ArxivAtomLink | ArxivAtomLink[];
  primary_category?: ArxivAtomCategory; // Added based on Arxiv documentation
  category?: ArxivAtomCategory | ArxivAtomCategory[];
  comment?: string | { _text: string }; // e.g., number of pages, figures
  journal_ref?: string | { _text: string }; // Journal reference if published
  doi?: string | { _text: string }; // DOI if available
}

interface ArxivAtomFeed {
  entry?: ArxivAtomEntry | ArxivAtomEntry[];
  'opensearch:totalResults': string | { _text: string };
  'opensearch:startIndex': string | { _text: string };
  'opensearch:itemsPerPage': string | { _text: string };
  // Other Atom feed elements like title, id, updated, link, author etc.
}

interface ArxivParsedXml {
  feed: ArxivAtomFeed;
}

/**
 * Arxiv configuration options
 */
export interface ArxivConfig extends ProviderConfig {
  /** Base URL for Arxiv API query endpoint */
  baseUrl?: string;
  /** Sort order for results (relevance, lastUpdatedDate, submittedDate) */
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  /** Sort direction (ascending or descending) */
  sortOrder?: 'ascending' | 'descending';
}

/**
 * Default base URL for Arxiv API
 */
const DEFAULT_BASE_URL = 'http://export.arxiv.org/api/query';

/**
 * Helper to extract text from a potentially object-wrapped string from xml2js
 */
function getText(value: string | { _text: string } | undefined): string {
  if (typeof value === 'string') {
    return value;
  }
  if (value && typeof value === 'object' && '_text' in value) {
    return value._text;
  }
  return '';
}

/**
 * Creates an Arxiv provider instance
 *
 * @param config Configuration options for Arxiv
 * @returns A configured Arxiv provider
 */
export function createArxivProvider(config: ArxivConfig = {}): SearchProvider { // Add default empty object for config
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  return {
    name: 'arxiv',
    // Ensure apiKey is explicitly set or handled if optional in ProviderConfig
    config: { ...config, apiKey: config.apiKey || '' }, 
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, idList, maxResults = 10, start = 0, sortBy = 'relevance', sortOrder = 'descending', debug: debugOptions, timeout } = options;

      if (!query && !idList) {
        throw new Error('Arxiv search requires either a "query" or an "idList".');
      }

      const params = new URLSearchParams();
      if (query) {
        // Arxiv uses specific prefixes for fields, e.g., ti: for title, au: for author
        // For a general query, no prefix is needed.
        params.append('search_query', query);
      }
      if (idList) {
        params.append('id_list', idList);
      }
      params.append('start', start.toString());
      params.append('max_results', maxResults.toString());
      params.append('sortBy', sortBy);
      params.append('sortOrder', sortOrder);

      const url = `${baseUrl}?${params.toString()}`;

      debug.logRequest(debugOptions, 'Arxiv Search request', { url });

      try {
        const responseXmlText = await get<string>(url, { timeout });
        debug.log(debugOptions, 'Arxiv raw XML response received', { length: responseXmlText.length });

        const parsedXml: ArxivParsedXml = await parseStringPromise(responseXmlText, {
          explicitArray: false, // Makes accessing single elements easier
          explicitRoot: false,   // Removes the root 'feed' element if it's the only one
          tagNameProcessors: [key => key.replace('arxiv:', '')] // Remove arxiv: prefix if present
        });
        
        debug.log(debugOptions, 'Arxiv XML parsed successfully');

        if (!parsedXml || !parsedXml.feed) {
          debug.log(debugOptions, 'Arxiv parsed data is empty or malformed', { parsedXml });
          return [];
        }
        
        const feed = parsedXml.feed;
        const entries = feed.entry ? (Array.isArray(feed.entry) ? feed.entry : [feed.entry]) : [];

        if (entries.length === 0) {
          debug.log(debugOptions, 'No entries found in Arxiv response');
          return [];
        }

        const results: SearchResult[] = entries.map(entry => {
          let pdfLink = '';
          const links = entry.link ? (Array.isArray(entry.link) ? entry.link : [entry.link]) : [];
          const alternateLink = links.find(l => l._attributes.rel === 'alternate' && l._attributes.type === 'text/html');
          const pdfLinkObj = links.find(l => l._attributes.title === 'pdf');
          
          if (pdfLinkObj) {
            pdfLink = pdfLinkObj._attributes.href;
          } else if (alternateLink) {
            // Convert abstract link to PDF link if PDF link is not directly available
            // e.g., http://arxiv.org/abs/xxxx.xxxxx -> http://arxiv.org/pdf/xxxx.xxxxx
            pdfLink = getText(alternateLink._attributes.href).replace('/abs/', '/pdf/');
          }


          const authors = entry.author ? (Array.isArray(entry.author) ? entry.author.map(a => getText(a.name)) : [getText(entry.author.name)]) : [];

          return {
            url: pdfLink || getText(entry.id), // Prefer PDF link, fallback to entry ID (usually abstract page)
            title: getText(entry.title).replace(/\n\s*/g, ' ').trim(), // Clean up title
            snippet: getText(entry.summary).replace(/\n\s*/g, ' ').trim(), // Clean up summary
            publishedDate: getText(entry.published) || getText(entry.updated),
            provider: 'arxiv',
            raw: entry, // Store the raw entry for more details
            authors: authors,
            categories: entry.category ? (Array.isArray(entry.category) ? entry.category.map(c => c._attributes.term) : [entry.category._attributes.term]) : (entry.primary_category ? [entry.primary_category._attributes.term] : []),
          };
        });
        
        const totalResults = parseInt(getText(feed['opensearch:totalResults']), 10) || 0;
        debug.logResponse(debugOptions, 'Arxiv Search successful', {
            status: 'success',
            itemCount: results.length,
            totalResults: totalResults,
        });
        return results;

      } catch (error: unknown) { 
        let errorMessage = 'Arxiv search failed';
        let statusCode: number | undefined;

        // Define a type guard for HTTP errors
        if (error instanceof HttpError) {
          errorMessage = `Arxiv API error: ${error.statusCode} - ${error.message}`;
          statusCode = error.statusCode;
          if (error.parsedResponseBody) {
            errorMessage += `\nResponse: ${JSON.stringify(error.parsedResponseBody)}`;
          }
        } 
        // Check for Axios-like error objects (avoiding 'any' type)
        else if (typeof error === 'object' && error !== null && 'response' in error) {
          // Use a properly typed interface for axios-like errors
          interface AxiosLikeError {
            response?: {
              status?: number;
              data?: unknown;
              message?: string;
            };
          }
          
          // Use the interface for type assertion
          const axiosError = error as AxiosLikeError;
          const errResponse = axiosError.response;
          
          if (errResponse && typeof errResponse === 'object') {
            if (errResponse.status && 'data' in errResponse && errResponse.data !== undefined) {
              errorMessage = `Arxiv API error: ${errResponse.status} - ${JSON.stringify(errResponse.data)}`;
              statusCode = errResponse.status;
            } else if (errResponse.status && 'message' in errResponse && typeof errResponse.message === 'string') {
              errorMessage = `Arxiv API error: ${errResponse.status} - ${errResponse.message}`;
              statusCode = errResponse.status;
            } else if (errResponse.status) {
              errorMessage = `Arxiv API error: ${errResponse.status}`;
              statusCode = errResponse.status;
            } else if (error instanceof Error) {
                errorMessage = `Arxiv search failed: ${error.message}`;
            }
          } else if (error instanceof Error) {
            errorMessage = `Arxiv search failed: ${error.message}`;
          }
        } 
        // Standard Error object
        else if (error instanceof Error) {
            errorMessage = `Arxiv search failed: ${error.message}`;
        } 
        // Fallback for unknown error types
        else {
          errorMessage = `Arxiv search failed: ${String(error)}`;
        }

        debug.log(debugOptions, 'Arxiv Search error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          statusCode: statusCode,
          url,
        });
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * Pre-configured Arxiv provider.
 * Call `arxiv.configure({})` before use, though no API key is strictly needed,
 * it standardizes provider setup and allows overriding baseUrl or other defaults.
 */
export const arxiv = {
  name: 'arxiv',
  config: { apiKey: '' }, // No API key needed for Arxiv's public API

  /**
   * Configure the Arxiv provider.
   *
   * @param config Arxiv configuration options (e.g., baseUrl, sortBy, sortOrder)
   * @returns Configured Arxiv provider
   */
  configure: (config: ArxivConfig = {}): SearchProvider => createArxivProvider(config), // Added return type

  /**
   * Search implementation that ensures provider is properly configured before use.
   * This is a placeholder and will be overridden by `configure`.
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    // This initial search function on the non-configured provider should guide the user.
    // The actual search logic is in `createArxivProvider`.
    throw new Error('Arxiv provider must be configured before use. Call arxiv.configure() first, even with empty options if defaults are fine.');
  }
};
