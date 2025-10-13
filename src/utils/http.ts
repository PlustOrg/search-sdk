import fetch from 'cross-fetch';

/**
 * Represents the HTTP request methods.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

/**
 * Defines the options for an HTTP request.
 */
export interface HttpRequestOptions {
  /** The HTTP method for the request (e.g., 'GET', 'POST'). */
  method?: HttpMethod;
  /** A record of HTTP request headers. */
  headers?: Record<string, string>;
  /** The body of the request, for methods like POST, PUT, and PATCH. */
  body?: unknown;
  /** The request timeout in milliseconds. */
  timeout?: number;
}

/**
 * A custom error class for handling HTTP-related errors.
 * This error is thrown when an HTTP request fails (e.g., non-2xx status code).
 */
export class HttpError extends Error {
  /** The HTTP status code of the response. */
  statusCode: number;
  /** The original `Response` object from the fetch call. */
  response?: Response;
  /** The raw response body as a string. */
  responseBody?: string;
  /** The parsed response body, if applicable (e.g., JSON). */
  parsedResponseBody?: unknown;

  /**
   * Creates an instance of HttpError.
   * @param {string} message - The error message.
   * @param {number} statusCode - The HTTP status code.
   * @param {Response} [response] - The original `Response` object.
   */
  constructor(message: string, statusCode: number, response?: Response) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.response = response;
  }

  /**
   * Attempts to parse the response body to extract more detailed error information.
   * This method will try to parse the body as JSON, falling back to plain text if unsuccessful.
   * @returns {Promise<unknown>} A promise that resolves to the parsed response body or null if parsing fails.
   */
  async parseResponseBody(): Promise<unknown> {
    if (!this.response) return null;

    try {
      // Only read the body if it hasn't been read yet
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
          // Not JSON, return the text
          return this.responseBody;
        }
      }
    } catch (e) {
      // If the body cannot be read, return null
      return null;
    }

    return null;
  }
}

/**
 * The default timeout for HTTP requests, in milliseconds (15 seconds).
 * @internal
 */
const DEFAULT_TIMEOUT = 15000;

/**
 * A generic function to make an HTTP request.
 *
 * @template T The expected type of the response data.
 * @param {string} url The URL to make the request to.
 * @param {HttpRequestOptions} [options={}] The request options, including method, headers, body, and timeout.
 * @returns {Promise<T>} A promise that resolves to the response data.
 * @throws {HttpError} When the request fails with a non-2xx status code.
 * @throws {Error} When the request times out or a network error occurs.
 */
export async function makeRequest<T>(url: string, options: HttpRequestOptions = {}): Promise<T> {
  const {
    method = 'GET',
    headers = {},
    body,
    timeout = DEFAULT_TIMEOUT,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const requestOptions: RequestInit = {
      method,
      headers: {
        'Accept': 'application/json',
        ...headers,
      },
      signal: controller.signal,
    };

    if (body && method !== 'GET') {
      if (typeof body === 'object') {
        requestOptions.body = JSON.stringify(body);
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

    const response = await fetch(url, requestOptions);

    if (!response.ok) {
      const httpError = new HttpError(
        `Request failed with status: ${response.status} ${response.statusText}`,
        response.status,
        response
      );

      try {
        const errorDetails = await httpError.parseResponseBody();
        if (errorDetails) {
          let errorMessage = '';
          if (typeof errorDetails === 'object' && errorDetails !== null) {
            const errorObj = errorDetails as Record<string, any>;
            if (errorObj.error && typeof errorObj.error.message === 'string') {
              errorMessage = errorObj.error.message;
            } else if (typeof errorObj.message === 'string') {
              errorMessage = errorObj.message;
            } else {
              errorMessage = JSON.stringify(errorDetails);
            }
          } else if (typeof errorDetails === 'string') {
            errorMessage = errorDetails;
          }
          httpError.message += ` - ${errorMessage}`;
        }
      } catch (parseError) {
        // Ignore parsing errors and proceed with the original error
      }
      throw httpError;
    }

    return response.json() as Promise<T>;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Makes a GET request to the specified URL.
 *
 * @template T The expected type of the response data.
 * @param {string} url The URL to make the GET request to.
 * @param {Omit<HttpRequestOptions, 'method'>} [options={}] The request options.
 * @returns {Promise<T>} A promise that resolves to the response data.
 */
export async function get<T>(url:string, options: Omit<HttpRequestOptions, 'method'> = {}): Promise<T> {
  return makeRequest<T>(url, { ...options, method: 'GET' });
}

/**
 * Makes a POST request to the specified URL.
 *
 * @template T The expected type of the response data.
 * @param {string} url The URL to make the POST request to.
 * @param {unknown} body The body of the POST request.
 * @param {Omit<HttpRequestOptions, 'method' | 'body'>} [options={}] The request options.
 * @returns {Promise<T>} A promise that resolves to the response data.
 */
export async function post<T>(
  url: string,
  body: unknown,
  options: Omit<HttpRequestOptions, 'method' | 'body'> = {}
): Promise<T> {
  return makeRequest<T>(url, { ...options, method: 'POST', body });
}

/**
 * Builds a URL with query parameters from a base URL and a parameters object.
 *
 * @param {string} baseUrl The base URL.
 * @param {Record<string, string | number | boolean | undefined>} params A record of query parameters.
 * @returns {string} The full URL with the appended query parameters.
 */
export function buildUrl(baseUrl: string, params: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(baseUrl);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });
  return url.toString();
}