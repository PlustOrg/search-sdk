import { DebugOptions } from '../types';

/**
 * @internal
 * Default debug options used when no custom options are provided.
 */
const defaultDebugOptions: DebugOptions = {
  enabled: false,
  logRequests: false,
  logResponses: false,
  logger: (message, data) => {
    if (data) {
      console.log(`[@plust/search-sdk] ${message}`, data);
    } else {
      console.log(`[@plust/search-sdk] ${message}`);
    }
  }
};

/**
 * A utility object for handling debugging and logging within the SDK.
 * This object provides methods to log messages, requests, and responses
 * based on the provided {@link DebugOptions}.
 */
export const debug = {
  /**
   * Logs a general message if debugging is enabled.
   *
   * @param {DebugOptions | undefined} options - The debug options from the search request.
   * @param {string} message - The message to log.
   * @param {unknown} [data] - Optional data to include with the log entry.
   */
  log(options: DebugOptions | undefined, message: string, data?: unknown): void {
    const opts = { ...defaultDebugOptions, ...options };
    if (opts.enabled) {
      const logger = opts.logger || defaultDebugOptions.logger;
      if (logger) {
        logger(message, data);
      }
    }
  },

  /**
   * Logs HTTP request details if debugging and request logging are enabled.
   *
   * @param {DebugOptions | undefined} options - The debug options from the search request.
   * @param {string} message - A descriptive message for the request being logged.
   * @param {unknown} [data] - Optional data related to the request (e.g., headers, body).
   */
  logRequest(options: DebugOptions | undefined, message: string, data?: unknown): void {
    const opts = { ...defaultDebugOptions, ...options };
    if (opts.enabled && opts.logRequests) {
      const logger = opts.logger || defaultDebugOptions.logger;
      if (logger) {
        logger(`REQUEST: ${message}`, data);
      }
    }
  },

  /**
   * Logs HTTP response details if debugging and response logging are enabled.
   *
   * @param {DebugOptions | undefined} options - The debug options from the search request.
   * @param {string} message - A descriptive message for the response being logged.
   * @param {unknown} [data] - Optional data related to the response (e.g., status code, body).
   */
  logResponse(options: DebugOptions | undefined, message: string, data?: unknown): void {
    const opts = { ...defaultDebugOptions, ...options };
    if (opts.enabled && opts.logResponses) {
      const logger = opts.logger || defaultDebugOptions.logger;
      if (logger) {
        logger(`RESPONSE: ${message}`, data);
      }
    }
  }
};