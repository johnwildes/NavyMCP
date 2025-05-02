# Copilot Log Book

## 2023-11-15: Fixed Bicep API version error
- **Prompt Summary**: Fix Bicep deployment error related to CosmosDB API version
- **Rationale**: Updated CosmosDB resource API versions from '2023-05-15' to '2023-04-15' based on error message showing supported versions
- **Changes**: main.bicep:19, main.bicep:46, main.bicep:57 (API version references)

## 2023-11-15: Confirmed East US region compatibility
- **Prompt Summary**: Verification of East US region support for CosmosDB
- **Rationale**: Reviewed error message which confirmed "eastus" is in the list of supported locations
- **Changes**: None needed; East US is a supported region for CosmosDB resources

## 2023-11-20 15:30

**Prompt Summary:** Fix vector index configuration in Cosmos DB Bicep template.

**Rationale:** The `vectorIndexes` property is not supported directly on container resources in Bicep. Replaced with the proper `Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/vectorSearchProfiles` resource type that correctly configures vector search capabilities.

**Changes:**
- main.bicep:38-72 - Removed vectorIndexes from container resource
- main.bicep:73-95 - Added separate vectorSearchProfiles resource for vector search configuration
