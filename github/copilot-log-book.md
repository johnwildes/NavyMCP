## 2023-07-11 14:30

### Prompt Summary
Add a storage account to Azure Bicep template

### Rationale
Added a standard Azure Storage Account (StorageV2) with LRS redundancy and security best practices including HTTPS-only traffic, TLS 1.2, and disabled public blob access.

### Changes Made
- main.bicep:6-16 - Added storage account parameter
- main.bicep:19-30 - Added storage account resource
- main.bicep:63-64 - Added storage account outputs
