import { debug, HttpError, get } from '../utils';
import { SearchProvider, SearchResult, SearchOptions, ProviderConfig } from '../types';
import { parseStringPromise } from 'xml2js';

/**
 * @internal
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

/**
 * @internal
 */
interface ArxivAtomAuthor {
  name: string | { _text: string }; // Sometimes it's just a string, sometimes an object
}

/**
 * @internal
 */
interface ArxivAtomCategory {
  _attributes: {
    term: string;
    scheme?: string;
  };
}

/**
 * @internal
 */
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

/**
 * @internal
 */
interface ArxivAtomFeed {
  entry?: ArxivAtomEntry | ArxivAtomEntry[];
  'opensearch:totalResults': string | { _text: string };
  'opensearch:startIndex': string | { _text: string };
  'opensearch:itemsPerPage': string | { _text: string };
  // Other Atom feed elements like title, id, updated, link, author etc.
}

/**
 * @internal
 */
interface ArxivParsedXml {
  feed: ArxivAtomFeed;
}

/**
 * Defines the configuration options for the Arxiv search provider.
 */
export interface ArxivConfig extends ProviderConfig {
  /**
   * The base URL for the Arxiv API query endpoint.
   * @default 'http://export.arxiv.org/api/query'
   */
  baseUrl?: string;
  /**
   * The sorting criteria for the search results.
   * @default 'relevance'
   */
  sortBy?: 'relevance' | 'lastUpdatedDate' | 'submittedDate';
  /**
   * The sorting direction for the search results.
   * @default 'descending'
   */
  sortOrder?: 'ascending' | 'descending';
}

/**
 * @internal
 * Default base URL for Arxiv API
 */
const DEFAULT_BASE_URL = 'http://export.arxiv.org/api/query';

/**
 * @internal
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
 * Creates a new instance of the Arxiv search provider.
 * This function is typically used through the `arxiv.configure()` method.
 *
 * @param {ArxivConfig} [config={}] - The configuration options for the Arxiv provider.
 * @returns {SearchProvider} A configured Arxiv provider instance.
 * @internal
 */
export function createArxivProvider(config: ArxivConfig = {}): SearchProvider { // Add default empty object for config
  const baseUrl = config.baseUrl || DEFAULT_BASE_URL;

  return {
    name: 'arxiv',
    config: { ...config, apiKey: config.apiKey || '' }, 
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, idList, maxResults = 10, start = 0, sortBy = 'relevance', sortOrder = 'descending', debug: debugOptions, timeout } = options;

      if (!query && !idList) {
        throw new Error('Arxiv search requires either a "query" or an "idList".');
      }

      const params = new URLSearchParams();
      if (query) {
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
          explicitArray: false,
          explicitRoot: false,
          tagNameProcessors: [key => key.replace('arxiv:', '')]
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
            pdfLink = getText(alternateLink._attributes.href).replace('/abs/', '/pdf/');
          }

          return {
            url: pdfLink || getText(entry.id),
            title: getText(entry.title).replace(/\n\s*/g, ' ').trim(),
            snippet: getText(entry.summary).replace(/\n\s*/g, ' ').trim(),
            publishedDate: getText(entry.published) || getText(entry.updated),
            provider: 'arxiv',
            raw: entry,
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
        if (error instanceof HttpError) {
          errorMessage = `Arxiv API error: ${error.statusCode} - ${error.message}`;
        } else if (error instanceof Error) {
            errorMessage = `Arxiv search failed: ${error.message}`;
        }

        debug.log(debugOptions, 'Arxiv Search error', {
          error: error instanceof Error ? error.message : String(error),
          url,
        });
        throw new Error(errorMessage);
      }
    },
  };
}

/**
 * A search provider for the Arxiv repository of scientific papers.
 * This provider allows searching for papers by query or by a list of Arxiv IDs.
 *
 * @example
 * ```typescript
 * import { arxiv, webSearch } from '@plust/search-sdk';
 *
 * const arxivProvider = arxiv.configure({
 *   sortBy: 'submittedDate',
 *   sortOrder: 'descending'
 * });
 *
 * const results = await webSearch({
 *   query: 'cat:cs.AI AND ti:transformer',
 *   provider: [arxivProvider],
 *   maxResults: 5
 * });
 * ```
 */
export const arxiv: SearchProvider & { configure: (config?: ArxivConfig) => SearchProvider } = {
  name: 'arxiv',
  config: { apiKey: '' },

  /**
   * Configures a new instance of the Arxiv provider.
   * While Arxiv does not require an API key, this method allows for setting custom options.
   *
   * @param {ArxivConfig} [config={}] - The configuration options for Arxiv.
   * @returns {SearchProvider} A configured Arxiv provider instance.
   */
  configure: (config: ArxivConfig = {}): SearchProvider => createArxivProvider(config),

  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('Arxiv provider must be configured before use. Call arxiv.configure() first.');
  }
};