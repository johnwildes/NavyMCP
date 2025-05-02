- **Prompt**: Update this resource to deploy a linux vm running ubuntu 24.04 and add a network card. Use premium ssd.
- **Rationale**: Updated the VM to use Ubuntu 24.04, added a network interface resource, and switched the OS disk to premium SSD for better performance.
- **Changes**:
  - `c:\Code\NavyMCP\infra\phi4-deployment.bicep`: Added `networkInterface` resource and updated `virtualMachine` resource (lines 20-70).

- **Prompt**: Add a virtual network with the address space 10.1.100.0/24 and a subnet called default that uses the entire space. Also add an NSG that allows RDP and SSH.
- **Rationale**: Added a virtual network with the specified address space and subnet, and an NSG to allow RDP and SSH for secure access.
- **Changes**:
  - `c:\Code\NavyMCP\infra\phi4-deployment.bicep`: Added `virtualNetwork` and `networkSecurityGroup` resources, updated `networkInterface` subnet reference (lines 20-90).

- **Prompt**: Break out the CSS in this file and make it an external style sheet.
- **Rationale**: Improved maintainability and separation of concerns by moving inline CSS to an external stylesheet.
- **Changes**:
  - `c:\Code\NavyMCP\src\frontend\index.html`: Linked external stylesheet and removed inline CSS.
  - `c:\Code\NavyMCP\src\frontend\styles.css`: Created new file and added CSS from the HTML file.
