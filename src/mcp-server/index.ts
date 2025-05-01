import { Server } from '@modelcontextprotocol/sdk';
import { CosmosClient } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { TextAnalysisClient, AzureKeyCredential } from '@azure/ai-language-text';
import { z } from 'zod';

// Configuration (these would typically come from environment variables)
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || '';
const COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'NavyDatabase';
const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER || 'NavyData';
const AI_ENDPOINT = process.env.AI_ENDPOINT || '';
const AI_KEY = process.env.AI_KEY || '';
const SERVER_PORT = parseInt(process.env.SERVER_PORT || '3000', 10);

// Define document types from loader
interface NavyDocument {
  id: string;
  title: string;
  content: string;
  category: string;
  path: string;
  embedding: number[];
  metadata: Record<string, any>;
}

// Initialize Cosmos DB client
async function getCosmosClient() {
  try {
    // Use DefaultAzureCredential for production environments
    const credential = new DefaultAzureCredential();
    const client = new CosmosClient({
      endpoint: COSMOS_ENDPOINT,
      aadCredentials: credential
    });
    
    console.log('Connected to Cosmos DB');
    return client;
  } catch (error) {
    console.error('Error connecting to Cosmos DB:', error);
    throw error;
  }
}

// Initialize Text Analytics client for embeddings
function getAIClient() {
  if (!AI_ENDPOINT || !AI_KEY) {
    throw new Error('AI_ENDPOINT and AI_KEY environment variables must be set');
  }

  return new TextAnalysisClient(
    AI_ENDPOINT,
    new AzureKeyCredential(AI_KEY)
  );
}

// Generate embeddings for text
async function generateEmbeddings(text: string): Promise<number[]> {
  if (!AI_ENDPOINT || !AI_KEY) {
    // For development without AI service, return mock embedding
    console.warn('Using mock embeddings as AI_ENDPOINT or AI_KEY not provided');
    return Array(1536).fill(0).map(() => Math.random());
  }

  try {
    const response = await fetch(`${AI_ENDPOINT}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AI_KEY}`
      },
      body: JSON.stringify({ input: text })
    });

    if (!response.ok) {
      throw new Error(`Failed to generate embeddings: ${response.statusText}`);
    }

    const data = await response.json();
    if (data && data.embedding) {
      return data.embedding;
    }

    throw new Error('No embedding generated in response');
  } catch (error) {
    console.error('Error generating embeddings:', error);
    throw error;
  }
}

// Define search schema for MCP server
const SearchSchema = z.object({
  query: z.string().describe('Search query to find Navy information'),
  category: z.string().optional().describe('Optional category to filter results (aircraft, bases, carriers, destroyers, fleets)'),
  limit: z.number().optional().default(5).describe('Maximum number of results to return')
});

// Main function to start the MCP server
async function main() {
  try {
    console.log('Starting Navy MCP server...');

    // Connect to Cosmos DB
    const client = await getCosmosClient();
    const database = client.database(COSMOS_DATABASE);
    const container = database.container(COSMOS_CONTAINER);

    // Create MCP server
    const server = new Server({
      name: 'NavyDataSearchMCP',
      description: 'Search Navy information using vector similarity',
      version: '1.0.0',
      port: SERVER_PORT,
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    });

    // Register search function
    server.registerFunction({
      name: 'searchNavyData',
      description: 'Search Navy data using natural language queries',
      parameters: SearchSchema,
      handler: async ({ query, category, limit = 5 }) => {
        console.log(`Searching for: ${query} in category ${category || 'all'}`);

        try {
          // Generate embeddings for the query
          const queryEmbedding = await generateEmbeddings(query);

          // Build Cosmos DB query
          let cosmosQuery = {
            query: `
              SELECT TOP @limit
                c.id,
                c.title,
                c.content,
                c.category,
                c.path,
                c.metadata
              FROM c 
              ${category ? 'WHERE c.category = @category' : ''}
              ORDER BY VECTOR_DISTANCE(c.embedding, @embedding)
            `,
            parameters: [
              {
                name: '@limit',
                value: limit
              },
              {
                name: '@embedding',
                value: queryEmbedding
              }
            ]
          };
          
          // Add category parameter if provided
          if (category) {
            cosmosQuery.parameters.push({
              name: '@category',
              value: category
            });
          }

          // Execute query
          const { resources } = await container.items.query(cosmosQuery).fetchAll();

          // Format results
          return resources.map(doc => {
            // Remove embedding from result to reduce payload size
            const { embedding, ...result } = doc;
            return result;
          });
        } catch (error) {
          console.error('Search error:', error);
          throw new Error(`Search failed: ${error.message}`);
        }
      }
    });

    // Register categories function for UI filtering
    server.registerFunction({
      name: 'getCategories',
      description: 'Get all available categories in the Navy data',
      parameters: z.object({}),
      handler: async () => {
        try {
          const query = {
            query: 'SELECT DISTINCT VALUE c.category FROM c'
          };
          
          const { resources } = await container.items.query(query).fetchAll();
          return resources;
        } catch (error) {
          console.error('Error fetching categories:', error);
          throw new Error(`Failed to fetch categories: ${error.message}`);
        }
      }
    });

    // Register document details function
    server.registerFunction({
      name: 'getDocumentById',
      description: 'Get detailed information about a specific document',
      parameters: z.object({
        id: z.string().describe('Document ID to retrieve')
      }),
      handler: async ({ id }) => {
        try {
          const { resource } = await container.item(id).read();
          
          if (!resource) {
            throw new Error(`Document with ID ${id} not found`);
          }
          
          // Remove embedding from result to reduce payload size
          const { embedding, ...result } = resource;
          return result;
        } catch (error) {
          console.error(`Error fetching document ${id}:`, error);
          throw new Error(`Failed to fetch document: ${error.message}`);
        }
      }
    });

    // Start the server
    await server.listen();
    console.log(`MCP Server running on port ${SERVER_PORT}`);
  } catch (error) {
    console.error('Error starting MCP server:', error);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(console.error);
}

export { main };