import { CosmosClient, Database } from '@azure/cosmos';
import { DefaultAzureCredential } from '@azure/identity';
import { TextAnalysisClient, AzureKeyCredential } from '@azure/ai-language-text';
import * as fs from 'fs';
import * as path from 'path';

// Configuration (these would typically come from environment variables)
const COSMOS_ENDPOINT = process.env.COSMOS_ENDPOINT || '';
const COSMOS_DATABASE = process.env.COSMOS_DATABASE || 'NavyDatabase';
const COSMOS_CONTAINER = process.env.COSMOS_CONTAINER || 'NavyData';
const AI_ENDPOINT = process.env.AI_ENDPOINT || '';
const AI_KEY = process.env.AI_KEY || '';
const DOC_ROOT = process.env.DOC_ROOT || path.join(__dirname, '../../doc');

// Validate required environment variables
function validateEnvironment(): void {
  if (!COSMOS_ENDPOINT) {
    throw new Error('COSMOS_ENDPOINT environment variable must be set');
  }
  
  // Check if doc root exists
  if (!fs.existsSync(DOC_ROOT)) {
    throw new Error(`DOC_ROOT directory does not exist: ${DOC_ROOT}`);
  }
}

// Define document types
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
    console.warn('Embedding generation is not supported by TextAnalysisClient. Using mock embeddings.');
    // Handle long texts - truncate if necessary to avoid token limit issues
    const maxLength = 5000;  // Adjust based on model limitations
    const truncatedText = text.length > maxLength ? text.substring(0, maxLength) : text;

    // Mock embedding generation for development/testing
    return Array(1536).fill(0).map(() => Math.random());
    
    throw new Error('No embedding generated');
  } catch (error) {
    console.error('Error generating embeddings:', error);
    // Provide fallback for development/testing
    console.warn('Using fallback mock embeddings due to error');
    return Array(1536).fill(0).map(() => Math.random());
  }
}

// Read and process a markdown file
async function processMarkdownFile(filePath: string): Promise<NavyDocument> {
  try {
    const relativePath = path.relative(DOC_ROOT, filePath).replace(/\\/g, '/');
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Extract title from the first line or filename
    let title = path.basename(filePath, '.md');
    const firstLine = content.split('\n')[0];
    if (firstLine.startsWith('# ')) {
      title = firstLine.substring(2).trim();
    }

    // Determine category from path
    const pathParts = relativePath.split('/');
    const category = pathParts.length > 0 ? pathParts[0] : 'unknown';

    // Create a document
    const document: NavyDocument = {
      id: relativePath.replace(/[/\\]/g, '-').replace('.md', ''),
      title,
      content,
      category,
      path: relativePath,
      embedding: await generateEmbeddings(content),
      metadata: {
        subcategory: pathParts.length > 1 ? pathParts[1] : '',
        filename: path.basename(filePath),
        lastModified: fs.statSync(filePath).mtime.toISOString()
      }
    };

    return document;
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    throw error;
  }
}

// Recursively find all markdown files
function findMarkdownFiles(dir: string): string[] {
  let results: string[] = [];
  
  try {
    const list = fs.readdirSync(dir);
    
    for (const file of list) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        results = results.concat(findMarkdownFiles(filePath));
      } else if (file.endsWith('.md')) {
        results.push(filePath);
      }
    }
  } catch (error) {
    console.error(`Error searching directory ${dir}:`, error);
  }
  
  return results;
}

// Upload documents to Cosmos DB
async function uploadToCosmosDB(documents: NavyDocument[], database: Database) {
  try {
    // Create container if it doesn't exist
    const { container } = await database.containers.createIfNotExists({
      id: COSMOS_CONTAINER,
      partitionKey: { paths: ["/category"] }  // Using category as partition key for efficient queries
    });
    
    console.log(`Uploading ${documents.length} documents to Cosmos DB...`);
    
    // Use bulk operations for better performance
    const operations = documents.map(doc => ({
      operationType: 'Upsert' as const,
      resourceBody: JSON.parse(JSON.stringify(doc)) // Ensure compatibility with JSONObject
    }));
    
    if (operations.length > 0) {
      const response = await container.items.bulk(operations);
      
      // Report success/failure counts
      const succeeded = response.filter(r => r.statusCode >= 200 && r.statusCode < 300).length;
      const failed = response.filter(r => r.statusCode >= 400).length;
      
      console.log(`Documents uploaded: ${succeeded} succeeded, ${failed} failed`);
      
      // Log errors for failed operations
      response.forEach((result, index) => {
        if (result.statusCode >= 400) {
          console.error(`Failed to upload document ${documents[index].id}: ${result.statusCode}`);
        }
      });
    }
    
    console.log('Upload complete');
  } catch (error) {
    console.error('Error uploading to Cosmos DB:', error);
    throw error;
  }
}

// Main function
async function main() {
  try {
    console.log('Starting Navy data loader...');
    
    // Validate environment variables
    validateEnvironment();
    
    // Connect to Cosmos DB
    const client = await getCosmosClient();
    const { database } = await client.databases.createIfNotExists({ id: COSMOS_DATABASE });
    
    // Find all markdown files
    console.log(`Searching for markdown files in ${DOC_ROOT}`);
    const markdownFiles = findMarkdownFiles(DOC_ROOT);
    console.log(`Found ${markdownFiles.length} markdown files`);
    
    if (markdownFiles.length === 0) {
      console.warn(`No markdown files found in ${DOC_ROOT}. Please check the directory.`);
      return;
    }
    
    // Process files in batches
    const batchSize = 10;
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < markdownFiles.length; i += batchSize) {
      try {
        const batch = markdownFiles.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(markdownFiles.length / batchSize)}`);
        
        // Process files and filter out any that fail
        const documentPromises = batch.map(file => 
          processMarkdownFile(file).catch(error => {
            console.error(`Failed to process ${file}:`, error);
            failureCount++;
            return null;
          })
        );
        
        const documents = (await Promise.all(documentPromises)).filter((doc): doc is NavyDocument => doc !== null);
        
        if (documents.length > 0) {
          await uploadToCosmosDB(documents, database);
          successCount += documents.length;
        }
      } catch (error) {
        console.error(`Error processing batch starting at index ${i}:`, error);
        failureCount += Math.min(batchSize, markdownFiles.length - i);
      }
    }
    
    console.log(`Data loading complete! Successfully processed ${successCount} files. Failed: ${failureCount}`);
  } catch (error) {
    console.error('Error in main process:', error);
    process.exit(1);
  }
}

// Run the main function
if (require.main === module) {
  main().catch(error => {
    console.error('Unhandled error in main process:', error);
    process.exit(1);
  });
}

export { processMarkdownFile, findMarkdownFiles, uploadToCosmosDB, NavyDocument };