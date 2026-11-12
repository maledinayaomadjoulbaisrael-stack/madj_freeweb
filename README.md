# MCP Server Template (TypeScript)

A minimal [Model Context Protocol](https://modelcontextprotocol.io/) server template for [Render](https://render.com). Fork it, add your own tools, and deploy.

## What's included

- A working MCP server using the [official TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) with Streamable HTTP transport
- Bearer token authentication via `MCP_API_TOKEN` (auto-generated on deploy)
- One example tool (`hello`) to show the pattern
- A `/health` endpoint for Render's health checks
- A `render.yaml` Blueprint for one-click deployment
- An `AGENTS.md` so AI coding assistants can scaffold new tools for you

> **Note:** This template deploys on the free plan by default. Free services spin down after 15 minutes of inactivity, causing cold starts of 30-60 seconds on the next request. MCP clients may time out during this delay. For reliable use, upgrade to a [paid plan](https://render.com/pricing) in the Render Dashboard — the Starter plan keeps your service running continuously.

## Getting started locally

```bash
git clone https://github.com/render-examples/mcp-server-typescript.git
cd mcp-server-typescript
npm install
npm run build
npm start
```

The server starts on `http://localhost:10000`. The MCP endpoint is at `/mcp`.

## Running tests

```bash
npm install
npm test
```

## Authentication

The server authenticates requests using a bearer token. Render's Blueprint auto-generates a random `MCP_API_TOKEN` on first deploy.

To find your token after deploying, go to **Render Dashboard > your service > Environment** and copy the `MCP_API_TOKEN` value.

Clients must include the token in the `Authorization` header:

```
Authorization: Bearer YOUR_TOKEN
```

When `MCP_API_TOKEN` is not set (e.g., during local development), authentication is disabled and all requests are allowed through.

### Managing your token

After the initial deploy, the token is yours to manage:

- **Rotate it** by updating `MCP_API_TOKEN` in the Render Dashboard under **Environment**. The service restarts automatically with the new value.
- **Generate a new token** with any of these:
  - `openssl rand -base64 32`
  - `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`
  - A password manager's generator (1Password, Bitwarden, etc.)
- **Don't commit tokens** to source control. Use environment variables or `.env` files (which are in `.gitignore`).
- For multi-user or production setups, consider upgrading to [OAuth 2.1](https://spec.modelcontextprotocol.io/specification/2025-03-26/basic/authorization/).

## Connecting to your MCP server

After deploying to Render, your MCP endpoint is available at:

```
https://your-service-name.onrender.com/mcp
```

### Cursor

Add to your project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "url": "https://your-service-name.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "my-mcp-server": {
      "type": "streamable-http",
      "url": "https://your-service-name.onrender.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

### Codex

```bash
codex mcp add --transport streamable-http \
  --url https://your-service-name.onrender.com/mcp \
  --header "Authorization: Bearer YOUR_TOKEN" \
  my-mcp-server
```

Or add to `.codex/config.toml`:

```toml
[mcp_servers.my-mcp-server]
url = "https://your-service-name.onrender.com/mcp"
http_headers = { Authorization = "Bearer YOUR_TOKEN" }
```

## Adding tools

Add tools inside the `createServer()` function in `src/app.ts`:

```typescript
server.registerTool(
  "fetch-weather",
  {
    description: "Get the current weather for a city",
    inputSchema: {
      city: z.string(),
      units: z.string().default("celsius"),
    },
  },
  async ({ city, units }) => ({
    content: [{ type: "text", text: `Weather for ${city} in ${units}` }],
  }),
);
```

The `description` is what MCP clients show to LLMs. Always write a clear one.

> This repo includes an `AGENTS.md` file. If you use an AI coding assistant (Cursor, Copilot, Codex, Windsurf, etc.), you can ask it to "add a new tool" and it will follow the conventions in `AGENTS.md` automatically.

## Project structure

```
src/app.ts               App setup: tools, auth middleware, routes
src/server.ts            Entrypoint: imports app and starts listening
package.json             Dependencies and scripts
tsconfig.json            TypeScript compiler configuration
render.yaml              Render Blueprint for deployment
.env.example             Environment variable reference
tests/server.test.ts     Test suite (auth, health, tool calls)
vitest.config.ts         Vitest configuration
AGENTS.md                Instructions for AI coding assistants
CLAUDE.md                Pointer to AGENTS.md for Claude Code
```

## Learn more

- [MCP specification](https://spec.modelcontextprotocol.io/)
- [TypeScript SDK documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [Render Blueprints](https://render.com/docs/infrastructure-as-code)
