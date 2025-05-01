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

// Cosmos DB Account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2023-05-15' = {
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
    capabilities: [
      {
        name: 'EnableServerless'
      }
      {
        name: 'VectorSearch'
      }
    ]
  }
}

// Database
resource database 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases@2023-05-15' = {
  parent: cosmosAccount
  name: databaseName
  properties: {
    resource: {
      id: databaseName
    }
  }
}

// Container with vector index for Navy data
resource container 'Microsoft.DocumentDB/databaseAccounts/sqlDatabases/containers@2023-05-15' = {
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
      vectorIndexes: [
        {
          name: 'navyContentVector'
          path: '/embedding'
          type: 'azureOpenAI'
          dimensions: 1536
          properties: [
            {
              path: '/title'
              name: 'title'
            }
            {
              path: '/category'
              name: 'category'
            }
            {
              path: '/path'
              name: 'path'
            }
          ]
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
