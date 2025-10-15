import { debug, HttpError, get, post } from '../utils';
import { SearchProvider, SearchResult, SearchOptions, ProviderConfig, DebugOptions } from '../types';

/**
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
 * DuckDuckGo image search response
 */
interface DuckDuckGoImagesResponse {
  results: DuckDuckGoImageResult[];
  next?: string;
}

/**
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
 * DuckDuckGo news search response
 */
interface DuckDuckGoNewsResponse {
  results: DuckDuckGoNewsResult[];
  next?: string;
}

/**
 * DuckDuckGo configuration options
 */
export interface DuckDuckGoConfig extends ProviderConfig {
  /** Base URL for DuckDuckGo API (defaults to HTML version) */
  baseUrl?: string;
  /** Search type: 'text', 'images', or 'news' */
  searchType?: 'text' | 'images' | 'news';
  /** Whether to use lite version (lighter weight HTML results) */
  useLite?: boolean;
  /** User agent to use for requests */
  userAgent?: string;
  /** Optional proxy configuration */
  proxy?: string;
}

/**
 * Extended SearchOptions with DuckDuckGo-specific options
 */
interface DuckDuckGoSearchOptions extends SearchOptions {
  /** Search type override at query time */
  searchType?: 'text' | 'images' | 'news';
}

/**
 * Default base URLs for DuckDuckGo search
 */
const DEFAULT_BASE_URLS = {
  text: 'https://html.duckduckgo.com/html',
  lite: 'https://lite.duckduckgo.com/lite/',
  images: 'https://duckduckgo.com/i.js',
  news: 'https://duckduckgo.com/news.js',
};

/**
 * Normalizes text by removing excess whitespace and line breaks
 */
function normalizeText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
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
 * Extract the "vqd" parameter required for some DuckDuckGo API endpoints
 * This is a temporary value that is embedded in the search HTML response
 */
function extractVqd(html: string, _keywords: string): string | null {
  try {
    const regex = new RegExp(`vqd=['"]([^'"]+)['"]`, 'i');
    const match = html.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Creates a DuckDuckGo search provider instance
 *
 * @param config Configuration options for DuckDuckGo
 * @returns A configured DuckDuckGo provider
 */
export function createDuckDuckGoProvider(config: DuckDuckGoConfig = {}): SearchProvider {
  // DuckDuckGo doesn't require an API key
  const searchType = config.searchType || 'text';
  const useLite = config.useLite || false;
  
  const baseUrls = {
    text: config.baseUrl || (useLite ? DEFAULT_BASE_URLS.lite : DEFAULT_BASE_URLS.text),
    images: config.baseUrl || DEFAULT_BASE_URLS.images,
    news: config.baseUrl || DEFAULT_BASE_URLS.news,
  };

  // Default headers for requests
  const headers = {
    'User-Agent': config.userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Referer': useLite ? 'https://lite.duckduckgo.com/' : 'https://html.duckduckgo.com/',
    'Sec-Fetch-User': '?1',
  };

  return {
    name: 'duckduckgo',
    config: { ...config, apiKey: config.apiKey || '' },
    search: async (options: SearchOptions): Promise<SearchResult[]> => {
      const { 
        query, 
        maxResults = 10, 
        region = 'wt-wt', 
        safeSearch = 'moderate', 
        debug: debugOptions, 
        timeout,
      } = options;
      
      // Cast to access DuckDuckGo-specific options
      const duckOptions = options as DuckDuckGoSearchOptions;
      const effectiveSearchType = duckOptions.searchType || searchType;

      if (!query) {
        throw new Error('DuckDuckGo search requires a query.');
      }

      try {
        // Select search method based on type
        if (effectiveSearchType === 'images') {
          return await searchImages(query, region, safeSearch, maxResults, debugOptions, timeout);
        } else if (effectiveSearchType === 'news') {
          return await searchNews(query, region, safeSearch, maxResults, debugOptions, timeout);
        } else {
          // Default to text search
          return await searchText(query, region, safeSearch, maxResults, debugOptions, timeout);
        }
      } catch (error: unknown) {
        let errorMessage = 'DuckDuckGo search failed';
        let statusCode: number | undefined;

        if (error instanceof HttpError) {
          errorMessage = `DuckDuckGo API error: ${error.statusCode} - ${error.message}`;
          statusCode = error.statusCode;
          if (error.parsedResponseBody) {
            errorMessage += `\\nResponse: ${JSON.stringify(error.parsedResponseBody)}`;
          }
        } else if (error instanceof Error) {
          errorMessage = `DuckDuckGo search failed: ${error.message}`;
        } else {
          errorMessage = `DuckDuckGo search failed: ${String(error)}`;
        }

        debug.log(debugOptions, 'DuckDuckGo Search error', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          statusCode,
        });
        throw new Error(errorMessage);
      }
    },
  };

  /**
   * Performs a text search using DuckDuckGo's HTML interface
   */
  async function searchText(
    query: string, 
    region: string, 
    safeSearch: string,
    maxResults: number,
    debugOptions?: DebugOptions, 
    timeout?: number
  ): Promise<SearchResult[]> {
    const baseUrl = useLite ? DEFAULT_BASE_URLS.lite : baseUrls.text;
    debug.logRequest(debugOptions, 'DuckDuckGo Text Search request', { baseUrl, query, region });

    // Set up initial request payload
    const payload = {
      q: query,
      b: '',
      kl: region
    };
    
    // Perform the search request
    const response = await post<string>(
      baseUrl, 
      payload, 
      { 
        headers,
        timeout,
      }
    );

    debug.log(debugOptions, 'DuckDuckGo Text Search raw response received', { length: response.length });

    // Parse the HTML response
    const results: SearchResult[] = [];
    const cache = new Set<string>();

    if (useLite) {
      // Parse lite version HTML
      // This is simplified placeholder implementation - would need HTML parsing library for complete implementation
      const resultsRegex = /<a href="([^"]+)"[^>]*>([^<]+)<\/a>.*?<td class="result-snippet">(.*?)<\/td>/gs;
      let match;
      
      while ((match = resultsRegex.exec(response)) !== null && results.length < maxResults) {
        const href = match[1];
        if (!cache.has(href) && !href.includes('google.com/search') && !href.includes('duckduckgo.com/y.js')) {
          cache.add(href);
          results.push({
            url: normalizeUrl(href),
            title: normalizeText(match[2]),
            snippet: normalizeText(match[3]),
            provider: 'duckduckgo',
          });
        }
      }
    } else {
      // Parse standard HTML version
      const resultsRegex = /<h2.*?><a .*?href="([^"]+)"[^>]*>(.*?)<\/a><\/h2>.*?<a .*?>(.*?)<\/a>/gs;
      let match;
      
      while ((match = resultsRegex.exec(response)) !== null && results.length < maxResults) {
        const href = match[1];
        if (!cache.has(href) && !href.includes('google.com/search') && !href.includes('duckduckgo.com/y.js')) {
          cache.add(href);
          results.push({
            url: normalizeUrl(href),
            title: normalizeText(match[2]),
            snippet: normalizeText(match[3]),
            provider: 'duckduckgo',
          });
        }
      }
    }

    debug.logResponse(debugOptions, 'DuckDuckGo Text Search successful', {
      status: 'success',
      itemCount: results.length,
    });

    return results;
  }

  /**
   * Performs an image search using DuckDuckGo's API
   */
  async function searchImages(
    query: string, 
    region: string, 
    safeSearch: string,
    maxResults: number,
    debugOptions?: DebugOptions, 
    timeout?: number
  ): Promise<SearchResult[]> {
    debug.logRequest(debugOptions, 'DuckDuckGo Images Search request', { query, region });

    // First, get the vqd parameter by making a request to the main search page
    const initialResponse = await get<string>('https://duckduckgo.com', {
      headers: {
        ...headers,
        'Referer': 'https://duckduckgo.com/',
      },
      timeout,
    });
    
    const vqd = extractVqd(initialResponse, query);
    if (!vqd) {
      throw new Error('Failed to extract vqd parameter for DuckDuckGo Images Search');
    }

    // Map safesearch to DuckDuckGo's format
    const safesearchMapping: Record<string, string> = {
      'on': '1',
      'moderate': '1',
      'off': '-1'
    };

    // Get the URL with parameters
    const searchUrl = new URL(baseUrls.images);
    searchUrl.searchParams.append('l', region);
    searchUrl.searchParams.append('o', 'json');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('vqd', vqd);
    searchUrl.searchParams.append('p', safesearchMapping[safeSearch.toLowerCase()] || '1');

    // Perform the image search request
    const response = await get<DuckDuckGoImagesResponse>(searchUrl.toString(), {
      headers: {
        ...headers,
        'Referer': 'https://duckduckgo.com/',
      },
      timeout,
    });

    const results: SearchResult[] = [];
    const cache = new Set<string>();

    if (response.results) {
      for (const img of response.results) {
        if (!cache.has(img.image) && results.length < maxResults) {
          cache.add(img.image);
          results.push({
            url: normalizeUrl(img.url),
            title: img.title,
            snippet: `${img.width}x${img.height} image from ${img.source}`,
            provider: 'duckduckgo',
            raw: img,
          });
        }
      }
    }

    debug.logResponse(debugOptions, 'DuckDuckGo Images Search successful', {
      status: 'success',
      itemCount: results.length,
    });

    return results;
  }

  /**
   * Performs a news search using DuckDuckGo's API
   */
  async function searchNews(
    query: string, 
    region: string, 
    safeSearch: string,
    maxResults: number,
    debugOptions?: DebugOptions, 
    timeout?: number
  ): Promise<SearchResult[]> {
    debug.logRequest(debugOptions, 'DuckDuckGo News Search request', { query, region });

    // First, get the vqd parameter by making a request to the main search page
    const initialResponse = await get<string>('https://duckduckgo.com', {
      headers: {
        ...headers,
        'Referer': 'https://duckduckgo.com/',
      },
      timeout,
    });
    
    const vqd = extractVqd(initialResponse, query);
    if (!vqd) {
      throw new Error('Failed to extract vqd parameter for DuckDuckGo News Search');
    }

    // Map safesearch to DuckDuckGo's format
    const safesearchMapping: Record<string, string> = {
      'on': '1',
      'moderate': '-1',
      'off': '-2'
    };

    // Get the URL with parameters
    const searchUrl = new URL(baseUrls.news);
    searchUrl.searchParams.append('l', region);
    searchUrl.searchParams.append('o', 'json');
    searchUrl.searchParams.append('noamp', '1');
    searchUrl.searchParams.append('q', query);
    searchUrl.searchParams.append('vqd', vqd);
    searchUrl.searchParams.append('p', safesearchMapping[safeSearch.toLowerCase()] || '-1');

    // Perform the news search request
    const response = await get<DuckDuckGoNewsResponse>(searchUrl.toString(), {
      headers,
      timeout,
    });

    const results: SearchResult[] = [];
    const cache = new Set<string>();

    if (response.results) {
      for (const news of response.results) {
        if (!cache.has(news.url) && results.length < maxResults) {
          cache.add(news.url);
          results.push({
            url: normalizeUrl(news.url),
            title: news.title,
            snippet: news.body,
            publishedDate: news.date,
            provider: 'duckduckgo',
            raw: {
              ...news,
              image: news.image ? normalizeUrl(news.image) : undefined,
            },
          });
        }
      }
    }

    debug.logResponse(debugOptions, 'DuckDuckGo News Search successful', {
      status: 'success',
      itemCount: results.length,
    });

    return results;
  }
}

/**
 * Pre-configured DuckDuckGo search provider.
 * DuckDuckGo does not require an API key, but you can configure other options.
 */
export const duckduckgo = {
  name: 'duckduckgo',
  config: { apiKey: '' }, // No API key needed for DuckDuckGo

  /**
   * Configure the DuckDuckGo provider
   *
   * @param config DuckDuckGo configuration options
   * @returns Configured DuckDuckGo provider
   */
  configure: (config: DuckDuckGoConfig = {}): SearchProvider => createDuckDuckGoProvider(config),

  /**
   * Search implementation that ensures provider is properly configured before use
   * This is a placeholder and will be overridden by `configure`
   */
  search: async (_options: SearchOptions): Promise<SearchResult[]> => {
    throw new Error('DuckDuckGo provider must be configured before use. Call duckduckgo.configure() first, even with empty options if defaults are fine.');
  }
};
