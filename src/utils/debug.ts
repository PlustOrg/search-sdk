import { DebugOptions } from '../types';

/**
 * Default debug options
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
 * Debug utility for the search SDK
 */
export const debug = {
  /**
   * Log a message if debugging is enabled
   * 
   * @param options Debug options from search request
   * @param message Message to log
   * @param data Optional data to log
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
   * Log request details if request logging is enabled
   * 
   * @param options Debug options from search request
   * @param message Message to log
   * @param data Request details to log
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
   * Log response details if response logging is enabled
   * 
   * @param options Debug options from search request
   * @param message Message to log
   * @param data Response details to log
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