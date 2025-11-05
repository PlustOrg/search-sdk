#!/usr/bin/env node

import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import { webSearch } from '../index';
import { SearchProvider } from '../types';
import * as allProviders from '../providers';

// A map to dynamically create provider instances from serialized config
const providerFactory = {
  google: allProviders.createGoogleProvider,
  serpapi: allProviders.createSerpApiProvider,
  brave: allProviders.createBraveProvider,
  exa: allProviders.createExaProvider,
  tavily: allProviders.createTavilyProvider,
  searxng: allProviders.createSearxNGProvider,
  arxiv: allProviders.createArxivProvider,
  duckduckgo: allProviders.createDuckDuckGoProvider,
};

async function main() {
  const configJson = process.env.SEARCH_SDK_MCP_CONFIG;

  if (!configJson) {
    console.error('Error: SEARCH_SDK_MCP_CONFIG environment variable must be set.');
    console.error('It should contain the JSON configuration for your search providers.');
    process.exit(1);
  }

  try {
    const { providers: providerConfigs } = JSON.parse(configJson);

    if (!providerConfigs || providerConfigs.length === 0) {
      throw new Error('The "providers" array in your configuration is empty.');
    }

    // Use the factory to create full provider instances from the config
    const hydratedProviders: SearchProvider[] = providerConfigs.map((p: { name: keyof typeof providerFactory; config: any }) => {
      const create = providerFactory[p.name];
      if (!create) throw new Error(`Unknown provider specified in config: ${p.name}`);
      return create(p.config);
    });

    const server = new FastMCP({
      name: 'Search SDK MCP Server',
      version: '1.0.0',
    });

    // Add the webSearch tool with proper metadata
    server.addTool({
      name: 'webSearch',
      description: 'Performs a web search across configured providers like Google, Brave, etc.',
      parameters: z.object({
        query: z.string().describe('The search query string'),
        maxResults: z.number().optional().describe('The maximum number of results to return'),
        region: z.string().optional().describe('The country code to tailor results for (e.g., "US")'),
        language: z.string().optional().describe('The language code for results (e.g., "en-US")'),
        idList: z.string().optional().describe('A comma-separated list of Arxiv document IDs (for Arxiv provider only)'),
      }),
      execute: async (args) => {
        const results = await webSearch({
          ...args,
          provider: hydratedProviders,
        });
        return JSON.stringify(results, null, 2);
      },
    });

    console.log(`Starting @plust/search-sdk MCP server...`);
    console.log(`Configured providers: ${hydratedProviders.map(p => p.name).join(', ')}`);

    // Start the MCP server with stdio transport
    await server.start({
      transportType: 'stdio',
    });

  } catch (error) {
    console.error('Failed to start MCP server:', error);
    process.exit(1);
  }
}

main();