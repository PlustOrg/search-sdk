import { SearchProvider } from '../types';

export interface McpProcessConfig {
  command: string;
  args: string[];
  env: { [key: string]: string };
}

/**
 * Transforms configured search providers into an MCP process configuration
 * for use with `@browserbasehq/stagehand` or other MCP clients.
 *
 * @param {SearchProvider[]} providers An array of configured search providers.
 * @returns {McpProcessConfig} A configuration object for `connectToMCPServer`.
 *
 */
export function asMcp(providers: SearchProvider[]): McpProcessConfig {
  if (!providers || providers.length === 0) {
    throw new Error('asMcp requires at least one configured search provider.');
  }

  // Serialize provider configurations to pass via an environment variable
  const serializableConfig = {
    providers: providers.map(p => ({
      name: p.name,
      config: p.config,
    })),
  };

  // For local development, point directly to the built CLI file
  // In production, this would use npx with the published package
  const path = require('path');
  const cliPath = path.join(__dirname, 'cli.js');

  return {
    command: 'node',
    args: [cliPath],
    env: {
      SEARCH_SDK_MCP_CONFIG: JSON.stringify(serializableConfig),
    },
  };
}