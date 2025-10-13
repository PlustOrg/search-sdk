import { debug, HttpError, get, post } from '../utils';
import { SearchProvider, SearchResult, SearchOptions, ProviderConfig, DebugOptions } from '../types';

/**
 * @internal
 * DuckDuckGo image search result
 */
interface DuckDuckGoImageResult {
  title: string;
  image: string;
  thumbnail: string;
  url: string;
  height: number;
  width: number;
  source: string;
}

/**
 * @internal
 * DuckDuckGo image search response
 */
interface DuckDuckGoImagesResponse {
  results: DuckDuckGoImageResult[];
  next?: string;
}

/**
 * @internal
 * DuckDuckGo news search result
 */
interface DuckDuckGoNewsResult {
  date: string;
  title: string;
  body: string;
  url: string;
  image?: string;
  source: string;
}

/**
 * @internal
 * DuckDuckGo news search response
 */
interface DuckDuckGoNewsResponse {
  results: DuckDuckGoNewsResult[];
  next?: string;
}

/**
 * Defines the configuration options for the DuckDuckGo search provider.
 */
export interface DuckDuckGoConfig extends ProviderConfig {
  /**
   * The base URL for the DuckDuckGo API. This is not typically needed.
   */
  baseUrl?: string;
  /**
   * The type of search to perform.
   * @default 'text'
   */
  searchType?: 'text' | 'images' | 'news';
  /**
   * If true, uses the lighter, HTML-only version of DuckDuckGo.
   * @default false
   */
  useLite?: boolean;
  /**
   * The User-Agent string to use for HTTP requests.
   */
  userAgent?: string;
}

/**
 * @internal
 * Extended SearchOptions with DuckDuckGo-specific options
 */
interface DuckDuckGoSearchOptions extends SearchOptions {
  searchType?: 'text' | 'images' | 'news';
}

/**
 * @internal
 * Default base URLs for DuckDuckGo search
 */
const DEFAULT_BASE_URLS = {
  text: 'https://html.duckduckgo.com/html',
  lite: 'https://lite.duckduckgo.com/lite/',
  images: 'https://duckduckgo.com/i.js',
  news: 'https://duckduckgo.com/news.js',
};

/**
 * @internal
 * Normalizes text by removing excess whitespace and line breaks
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * @internal
 * Normalizes URLs by ensuring they start with http/https
 */
function normalizeUrl(url: string): string {
  if (!url) return '';
  if (url.startsWith('//')) {
    return `https:${url}`;
  }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
}

/**
 * @internal
 * Extract the "vqd" parameter required for some DuckDuckGo API endpoints
 */
function extractVqd(html: string): string | null {
  const match = html.match(/vqd=['"]([^'"]+)['"]/);
  return match ? match[1] : null;
}

/**
 * Creates a new instance of the DuckDuckGo search provider.
 * This function is typically used through the `duckduckgo.configure()` method.
 *
 * @param {DuckDuckGoConfig} [config={}] - The configuration options for DuckDuckGo.
 * @returns {SearchProvider} A configured DuckDuckGo provider instance.
 * @internal
 */
export function createDuckDuckGoProvider(config: DuckDuckGoConfig = {}): SearchProvider {
  const searchType = config.searchType || 'text';
  const useLite = config.useLite || false;
  
  const baseUrls = {
    text: config.baseUrl || (useLite ? DEFAULT_BASE_URLS.lite : DEFAULT_BASE_URLS.text),
    images: config.baseUrl || DEFAULT_BASE_URLS.images,
    news: config.baseUrl || DEFAULT_BASE_URLS.news,
  };

  const headers = {
    'User-Agent': config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  };

  return {
    name: 'duckduckgo',
    config,
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { query, maxResults = 10, region = 'wt-wt', safeSearch = 'moderate', debug: debugOptions, timeout } = options;
      const duckOptions = options as DuckDuckGoSearchOptions;
      const effectiveSearchType = duckOptions.searchType || searchType;

      if (!query) {
        throw new Error('DuckDuckGo search requires a query.');
      }

      try {
        if (effectiveSearchType === 'images') {
          return await searchImages(query, region, safeSearch, maxResults, debugOptions, timeout);
        } else if (effectiveSearchType === 'news') {
          return await searchNews(query, region, safeSearch, maxResults, debugOptions, timeout);
        } else {
          return await searchText(query, maxResults, debugOptions, timeout);
        }
      } catch (error) {
        let errorMessage = 'DuckDuckGo search failed';
        if (error instanceof HttpError) {
          errorMessage = `DuckDuckGo API error: ${error.message}`;
        } else if (error instanceof Error) {
          errorMessage = `DuckDuckGo search failed: ${error.message}`;
        }

        debug.log(debugOptions, 'DuckDuckGo Search error', { error: String(error) });
        throw new Error(errorMessage);
      }
    },
  };

  async function searchText(query: string, maxResults: number, debugOptions?: DebugOptions, timeout?: number): Promise<SearchResult[]> {
    const url = useLite ? baseUrls.text : baseUrls.text;
    debug.logRequest(debugOptions, 'DuckDuckGo Text Search', { url, query });

    const response = await get<string>(url, { headers, timeout, params: { q: query } });
    debug.log(debugOptions, 'DuckDuckGo Text Search response received');

    // NOTE: This is a simplified parser and may break if DDG changes their HTML structure.
    const results: SearchResult[] = [];
    const resultRegex = /<a class="result__a" href="([^"]+)">(.*?)<\/a>.*?<a class="result__snippet"[^>]+>(.*?)<\/a>/gs;
    let match;
    while ((match = resultRegex.exec(response)) !== null && results.length < maxResults) {
      results.push({
        url: normalizeUrl(match[1]),
        title: normalizeText(match[2]),
        snippet: normalizeText(match[3]),
        provider: 'duckduckgo',
      });
    }
    return results;
  }

  async function searchImages(query: string, region: string, safeSearch: string, maxResults: number, debugOptions?: DebugOptions, timeout?: number): Promise<SearchResult[]> {
    const initialResponse = await get<string>('https://duckduckgo.com/', { headers, timeout, params: { q: query } });
    const vqd = extractVqd(initialResponse);
    if (!vqd) throw new Error('Failed to extract VQD for image search.');

    const safesearchMap = { 'off': '-2', 'moderate': '-1', 'strict': '1' };
    const params = { l: region, o: 'json', q: query, vqd, f: ',,,', p: safesearchMap[safeSearch] || '-1' };
    
    debug.logRequest(debugOptions, 'DuckDuckGo Image Search', { url: baseUrls.images, params });
    const response = await get<DuckDuckGoImagesResponse>(baseUrls.images, { headers, timeout, params });

    return response.results.slice(0, maxResults).map(r => ({
      url: r.url,
      title: r.title,
      snippet: `${r.width}x${r.height} image from ${r.source}`,
      provider: 'duckduckgo',
      raw: r,
    }));
  }

  async function searchNews(query: string, region: string, safeSearch: string, maxResults: number, debugOptions?: DebugOptions, timeout?: number): Promise<SearchResult[]> {
    const initialResponse = await get<string>('https://duckduckgo.com/', { headers, timeout, params: { q: query } });
    const vqd = extractVqd(initialResponse);
    if (!vqd) throw new Error('Failed to extract VQD for news search.');

    const safesearchMap = { 'off': '-2', 'moderate': '-1', 'strict': '1' };
    const params = { l: region, o: 'json', noamp: '1', q: query, vqd, p: safesearchMap[safeSearch] || '-1' };

    debug.logRequest(debugOptions, 'DuckDuckGo News Search', { url: baseUrls.news, params });
    const response = await get<DuckDuckGoNewsResponse>(baseUrls.news, { headers, timeout, params });

    return response.results.slice(0, maxResults).map(r => ({
      url: r.url,
      title: r.title,
      snippet: r.body,
      publishedDate: new Date(r.date * 1000).toISOString(),
      provider: 'duckduckgo',
      raw: r,
    }));
  }
}

/**
 * A search provider for DuckDuckGo.
 * This provider does not require an API key and performs searches by scraping HTML results.
 * It supports text, image, and news searches.
 *
 * @example
 * ```typescript
 * import { duckduckgo, webSearch } from '@plust/search-sdk';
 *
 * // Text search
 * const textProvider = duckduckgo.configure();
 * const textResults = await webSearch({
 *   query: 'privacy focused search',
 *   provider: [textProvider]
 * });
 *
 * // Image search
 * const imageProvider = duckduckgo.configure({ searchType: 'images' });
 * const imageResults = await webSearch({
 *   query: 'landscape photography',
 *   provider: [imageProvider]
 * });
 * ```
 */
export const duckduckgo: SearchProvider & { configure: (config?: DuckDuckGoConfig) => SearchProvider } = {
  name: 'duckduckgo',
  config: { apiKey: '' },

  /**
   * Configures a new instance of the DuckDuckGo provider.
   *
   * @param {DuckDuckGoConfig} [config={}] - The configuration options for DuckDuckGo.
   * @returns {SearchProvider} A configured DuckDuckGo provider instance.
   */
  configure: (config: DuckDuckGoConfig = {}): SearchProvider => createDuckDuckGoProvider(config),

  /**
   * The search method for the unconfigured provider.
   * This will throw an error and guide the user to configure the provider first.
   * @internal
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('DuckDuckGo provider must be configured before use. Call duckduckgo.configure() first.');
  }
};