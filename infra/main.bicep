@description('Location for all resources')
param location string = resourceGroup().location

@description('Cosmos DB account name')
param cosmosAccountName string = 'navy-cosmos-${uniqueString(resourceGroup().id)}'

@description('Database name')
param databaseName string = 'NavyDatabase'

@description('Container name for Navy data')
param containerName string = 'NavyData'

@description('Azure AI Services account name')
param aiServicesAccountName string = 'navy-ai-${uniqueString(resourceGroup().id)}'

@description('Storage account name')
param storageAccountName string = 'navystr${uniqueString(resourceGroup().id)}'

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2022-09-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    allowBlobPublicAccess: false
    allowSharedKeyAccess: true
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
  }
}

// Cosmos DB Account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-04-15' = {
  name: cosmosAccountName
  location: location
  kind: 'GlobalDocumentDB'
  properties: {
    consistencyPolicy: {
      defaultConsistencyLevel: 'Session'
    }
    databaseAccountOfferType: 'Standard'
    locations: [
      {
        locationName: location
        failoverPriority: 0
        isZoneRedundant: false
      }
    ]
    enableFreeTier: false // Added property for clarity
  }
}

// Database
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-04-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Container for Navy data
resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-04-15' = {
  parent: database
  name: containerName
  properties: {
    resource: {
      id: containerName
      partitionKey: {
        paths: [
          '/category'
        ]
        kind: 'Hash'
      }
      indexingPolicy: {
        indexingMode: 'consistent'
        automatic: true
        includedPaths: [
          {
            path: '/*'
          }
        ]
        excludedPaths: [
          {
            path: '/"_etag"/?'
          }
        ]
      }
      // Removed vectorIndexes from here as it's not supported directly
    }
  }
}

// Add vector search configuration as a separate resource
resource vectorSearch 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers/vectorSearchProfiles@2023-11-15' = {
  parent: container
  name: 'navyVectorSearchProfile'
  properties: {
    vectorSearchConfiguration: {
      algorithmConfigurationName: 'azureOpenAI'
      vectorIndexType: 'vectorHnsw'
      dimensions: 1536
      includedPaths: [
        {
          path: '/embedding'
          vectorIndexType: 'vectorHnsw'
        }
      ]
      metadataFields: [
        {
          path: '/title'
          fieldName: 'title'
        }
        {
          path: '/category'
          fieldName: 'category'
        }
        {
          path: '/path'
          fieldName: 'path'
        }
      ]
    }
  }
}

// Azure AI Services account for generating embeddings
resource aiServicesAccount 'Microsoft.CognitiveServices/accounts@2023-10-01-preview' = {
  name: aiServicesAccountName
  location: location
  sku: {
    name: 'S0'
  }
  kind: 'CognitiveServices'
  properties: {
    apiProperties: {
      statisticsEnabled: false
    }
  }
}

// Output important values
output cosmosAccountEndpoint string = cosmosAccount.properties.documentEndpoint
output cosmosAccountName string = cosmosAccount.name
output databaseName string = database.name
output containerName string = container.name
output aiServiceName string = aiServicesAccount.name
output aiServiceEndpoint string = aiServicesAccount.properties.endpoint
output storageAccountName string = storageAccount.name
output storageAccountBlobEndpoint string = storageAccount.properties.primaryEndpoints.blob
