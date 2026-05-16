# Railway Manager CLI

A CLI tool to manage your Railway account end-to-end using Railway's GraphQL API.

## Setup

```bash
cd railway-manager
npm install
npm run build
```

## Authentication

Get your API token from: https://railway.com/account/tokens

```bash
node dist/index.js auth login -t YOUR_TOKEN
# or interactively:
node dist/index.js auth login
```

## Commands

### Auth
```bash
rw auth login          # Set API token
rw auth logout         # Remove token
rw auth whoami         # Show current user
```

### Projects
```bash
rw projects list                    # List all projects
rw projects create -n "My App"      # Create project
rw projects delete <projectId>      # Delete project
```

### Services
```bash
rw services list <projectId>                          # List services
rw services create -p <projectId> -n "API"            # Empty service
rw services create -p <projectId> -n "Redis" --image redis:7-alpine  # From image
rw services create -p <projectId> -n "App" --repo user/repo          # From GitHub
rw services delete <serviceId>                        # Delete service
rw services restart <serviceId> -e <envId>            # Restart
```

### Deployments
```bash
rw deployments list -p <projectId> -s <serviceId> -e <envId>   # List deployments
rw deployments redeploy <deploymentId>                          # Redeploy
rw deployments rollback <deploymentId>                          # Rollback
rw deployments remove <deploymentId>                            # Remove
```

### Variables
```bash
rw variables list -p <projectId> -s <serviceId> -e <envId>              # List vars
rw variables set -p <projectId> -s <serviceId> -e <envId> -k KEY -v VAL # Set var
rw variables delete -p <projectId> -s <serviceId> -e <envId> -k KEY     # Delete var
```

### Domains
```bash
rw domains list -s <serviceId> -e <envId>                              # List domains
rw domains create -s <serviceId> -e <envId>                            # Generate Railway domain
rw domains add-custom -s <serviceId> -e <envId> -d api.example.com     # Add custom domain
rw domains delete <domainId>                                           # Delete domain
```

### Environments
```bash
rw environments list <projectId>                    # List environments
rw environments create -p <projectId> -n "staging"  # Create environment
rw environments delete <envId>                      # Delete environment
```

## Tips

- Use `Cmd+K` in Railway dashboard to quickly copy resource IDs
- Project ID, Service ID, Environment ID are all UUIDs
- Rate limits: 1000 req/hr (Hobby), 10000 req/hr (Pro)
