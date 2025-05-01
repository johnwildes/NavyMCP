# Navy Data Search with Cosmos DB Vector Search and MCP Server

A complete system for storing Navy Markdown documents in Cosmos DB with vector search capabilities, and a Model Context Protocol (MCP) server for searching through the data.

## Project Overview

This project creates a searchable knowledge base of Navy data using Azure Cosmos DB's vector search capabilities and presents it through a modern web interface connected to an MCP server.

### Key Components

1. **Infrastructure setup** (`infra/main.bicep`):
   - Cosmos DB account with vector search capability
   - Azure AI Services account for generating embeddings
   - Both resources are configured for optimal vector search performance

2. **Data Loader** (`src/loader/index.ts`):
   - Processes all Navy Markdown files from the doc directory
   - Extracts metadata and content from each file
   - Generates vector embeddings for the text content
   - Uploads documents to Cosmos DB with appropriate partitioning

3. **MCP Server** (`src/mcp-server/index.ts`):
   - Implements Model Context Protocol (MCP) for standardized communication
   - Provides endpoints for searching Navy data by similarity
   - Includes functions for category filtering and document retrieval
   - Performs vector similarity search using Cosmos DB's vector capabilities

4. **Frontend UI** (`src/frontend/index.html`):
   - Modern, responsive web interface for searching Navy data
   - Category filtering to narrow down search results
   - Detailed view of individual documents
   - Clean, intuitive design with Navy-themed styling

## How to Run the System

Follow these steps to deploy and run the system:

### 1. Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli)
- Azure subscription with permissions to create resources

### 2. Deploy the Azure Infrastructure

```bash
# Login to Azure
az login

# Create a resource group
az group create --name navy-data-search --location eastus

# Deploy Bicep template
az deployment group create --resource-group navy-data-search --template-file infra/main.bicep --parameters infra/main.parameters.json
```

### 3. Set Environment Variables

After deployment completes, set these environment variables with the output values:

```powershell
# Windows PowerShell
$env:COSMOS_ENDPOINT="<cosmos-account-endpoint-from-output>"
$env:COSMOS_DATABASE="NavyDatabase"
$env:COSMOS_CONTAINER="NavyData"
$env:AI_ENDPOINT="<ai-service-endpoint-from-output>"
$env:AI_KEY="<ai-service-key>" # Get this from Azure Portal
```

For Windows Command Prompt:
```cmd
set COSMOS_ENDPOINT=<cosmos-account-endpoint-from-output>
set COSMOS_DATABASE=NavyDatabase
set COSMOS_CONTAINER=NavyData
set AI_ENDPOINT=<ai-service-endpoint-from-output>
set AI_KEY=<ai-service-key>
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Load the Data

```bash
npx ts-node src/loader/index.ts
```

This script will:
- Find all Markdown (.md) files in the `doc` directory
- Process each file to extract metadata
- Generate vector embeddings for the text content
- Upload the documents to Cosmos DB

### 6. Start the MCP Server

```bash
npx ts-node src/mcp-server/index.ts
```

The MCP server will start on port 3000 by default.

### 7. Open the Frontend

Open the HTML file in your browser:

```bash
# For Windows
start src/frontend/index.html
```

## Security Considerations

- The default implementation uses DefaultAzureCredential for authentication to Azure services
- For production environments, consider adding authentication to the MCP server
- Review and restrict CORS settings in the MCP server for production use

## Next Steps and Enhancements

Potential enhancements to consider:

1. Add authentication to the MCP server to control access
2. Implement chunking for long documents to improve search quality
3. Add a document refresh mechanism to keep Cosmos DB updated
4. Create a more sophisticated frontend with React or Vue.js
5. Add analytics to track popular searches
6. Implement a feedback mechanism to improve search results over time

## License

ISC - As specified in package.json

## Further Documentation

For more information on the technologies used:

- [Azure Cosmos DB Vector Search](https://docs.microsoft.com/en-us/azure/cosmos-db/vector-search)
- [Model Context Protocol](https://modelcontextprotocol.github.io/)
- [Azure AI Services](https://azure.microsoft.com/en-us/products/ai-services)