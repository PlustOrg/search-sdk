import fetch from 'cross-fetch';

/**
 * HTTP request method types
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Options for HTTP requests
 */
export interface HttpRequestOptions {
  /** HTTP method for the request */
  method?: HttpMethod;
  /** Request headers */
  headers?: Record<string, string>;
  /** Request body (for POST, PUT, PATCH) */
  body?: unknown;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Error thrown when an HTTP request fails
 */
export class HttpError extends Error {
  statusCode: number;
  response?: Response;
  responseBody?: string;
  parsedResponseBody?: unknown;
  
  constructor(message: string, statusCode: number, response?: Response) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.response = response;
  }

  /**
   * Try to extract and parse the response body for more detailed error information
   */
  async parseResponseBody(): Promise<unknown> {
    if (!this.response) return null;
    
    try {
      // Only try to clone and read the body if it hasn't been read yet
      if (!this.responseBody) {
        const clonedResponse = this.response.clone();
        this.responseBody = await clonedResponse.text();
      }
      
      // Try to parse as JSON
      if (this.responseBody) {
        try {
          this.parsedResponseBody = JSON.parse(this.responseBody);
          return this.parsedResponseBody;
        } catch {
          // Not JSON, just return the text
          return this.responseBody;
        }
      }
    } catch (e) {
      // If we can't read the body, just return null
      return null;
    }
    
    return null;
  }
}

/**
 * Default timeout for HTTP requests in milliseconds (15 seconds)
 */
const DEFAULT_TIMEOUT = 15000;

/**
 * Makes an HTTP request to the specified URL with the given options
 * 
 * @param url The URL to make the request to
 * @param options Request options including method, headers, body, and timeout
 * @returns Promise that resolves to the response data
 */
export async function makeRequest<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
  } = options;
  
  // Create abort controller for timeout handling
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    // Prepare request options
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    };
    
    // Add body for non-GET requests
    if (body && method !== 'GET') {
      if (typeof body === 'object') {
        requestOptions.body = JSON.stringify(body);
        // Set content-type if not already set
        if (!headers['Content-Type']) {
          requestOptions.headers = {
            ...requestOptions.headers,
            'Content-Type': 'application/json',
          };
        }
      } else {
        requestOptions.body = body as BodyInit;
      }
    }
    
    // Make the request
    const response = await fetch(url, requestOptions);
    
    // Handle HTTP errors
    if (!response.ok) {
      const httpError = new HttpError(
        `Request failed with status: ${response.status} ${response.statusText}`,
        response.status,
        response
      );
      
      // Try to extract response body for more details
      try {
        const errorDetails = await httpError.parseResponseBody();
        if (errorDetails) {
          // If we have JSON error details, add them to the message
          if (typeof errorDetails === 'object') {
            const errorObj = errorDetails as Record<string, unknown>;
            
            // Try to extract the most meaningful error message
            let errorMessage: string;
            
            // For Google API errors
            if (typeof errorObj.error === 'object' && errorObj.error !== null) {
              const googleError = errorObj.error as Record<string, unknown>;
              if (typeof googleError.message === 'string') {
                errorMessage = googleError.message;
              } else if (Array.isArray(googleError.errors) && googleError.errors.length > 0) {
                const firstError = googleError.errors[0] as Record<string, unknown>;
                errorMessage = `${firstError.reason || 'error'}: ${firstError.message || 'Unknown error'}`;
              } else {
                errorMessage = JSON.stringify(googleError, null, 2);
              }
            } 
            // For standard error messages
            else if (typeof errorObj.error === 'string') {
              errorMessage = errorObj.error;
            } else if (typeof errorObj.message === 'string') {
              errorMessage = errorObj.message;
            } else if (typeof errorObj.description === 'string') {
              errorMessage = errorObj.description;
            } else {
              // Stringify the entire object for debugging
              errorMessage = JSON.stringify(errorDetails, null, 2);
            }
            
            httpError.message += ` - ${errorMessage}`;
          } else if (typeof errorDetails === 'string') {
            // Add the error text if it's a string
            httpError.message += ` - ${errorDetails}`;
          }
        }
      } catch (parseError) {
        // Continue with the original error if we can't parse
      }
      
      throw httpError;
    }
    
    // Parse response as JSON
    const data = await response.json();
    return data as T;
  } catch (error) {
    // Handle timeout errors
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    
    // Re-throw other errors
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Makes a GET request to the specified URL
 */
export async function get<T>(url: string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
  return makeRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * Makes a POST request to the specified URL
 */
export async function post<T>(
  url: string, 
  body: unknown, 
  options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  return makeRequest<T>(url, { ...options, method: 'POST', body });
}

/**
 * Builds a URL with query parameters from a base URL and a params object
 */
export function buildUrl(baseUrl: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(baseUrl);
  
  // Add query parameters to URL
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  
  return url.toString();
}