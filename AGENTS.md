# MCP Server (TypeScript) — Agent Guide

This is a remote MCP server built with the [official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and Express, deployed on [Render](https://render.com). It uses Streamable HTTP transport and runs stateless — a fresh server instance handles each request.

## Project layout

- `src/app.ts` — app setup: tool registration, auth middleware, Express routes
- `src/server.ts` — entrypoint: imports app and starts listening
- `package.json` — dependencies and scripts
- `tsconfig.json` — TypeScript compiler configuration
- `render.yaml` — Render Blueprint for deployment

## Authentication

The server uses bearer token auth controlled by the `MCP_API_TOKEN` environment variable. When set, all requests to `/mcp` must include `Authorization: Bearer <token>`. The `/health` endpoint is always unauthenticated.

When `MCP_API_TOKEN` is not set, auth is disabled entirely — this is the default for local development. Do not remove the auth middleware from `src/server.ts`.

## Adding a tool

Add tools inside the `createServer()` function in `src/app.ts`. Insert new `server.registerTool()` calls **after the existing tool registrations and before `return server`**.

### Pattern

```typescript
server.registerTool(
  "your-tool-name",
  {
    description: "One-line description of what this tool does (shown to LLMs)",
    inputSchema: {
      param: z.string(),
      count: z.number().default(10),
    },
  },
  async ({ param, count }) => ({
    content: [{ type: "text", text: "result" }],
  }),
);
```

### Rules

- **kebab-case** for tool names
- Always include a **description** — MCP clients surface it to LLMs
- Define inputs with **Zod schemas** in `inputSchema` — the SDK generates JSON schema from them
- Parameters with `.default()` or `.optional()` become optional in the schema
- Return `{ content: [{ type: "text", text: "..." }] }` — wrap structured data with `JSON.stringify()`
- Import `z` from `"zod"` (already imported at the top of the file)

### Examples

Simple tool with required parameters:

```typescript
server.registerTool(
  "add",
  {
    description: "Add two numbers together",
    inputSchema: { a: z.number(), b: z.number() },
  },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }],
  }),
);
```

Tool with optional parameters:

```typescript
server.registerTool(
  "search-docs",
  {
    description: "Search the documentation for a query string",
    inputSchema: {
      query: z.string(),
      maxResults: z.number().default(5),
    },
  },
  async ({ query, maxResults }) => {
    const results = await doSearch(query, maxResults);
    return {
      content: [{ type: "text", text: JSON.stringify(results) }],
    };
  },
);
```

Tool that calls an external API:

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
  async ({ city }) => {
    const resp = await fetch(`https://wttr.in/${city}?format=j1`);
    const text = await resp.text();
    return { content: [{ type: "text", text }] };
  },
);
```

## Adding dependencies

```bash
npm install <package-name>
```

This updates `package.json` automatically. On Render, the build command (`npm install && npm run build`) installs and compiles everything.

## Deployment

Push to the GitHub repo connected to your Render Blueprint. Render builds and deploys automatically (unless `autoDeploy` is set to `false` in `render.yaml`, in which case trigger a deploy from the Render Dashboard).

## Tests

Tests live in `tests/server.test.ts` and use vitest with supertest. Run them with `npm test`.

When adding a new tool, add a corresponding test case that calls the tool via MCP and checks the response. Follow the pattern in the `tool call returns result` test — send a `tools/call` JSON-RPC request and assert on the result content.

## Key files not to remove

- `render.yaml` — required for Render Blueprint deploys
- The `/health` route in `src/server.ts` — used by Render's health checks
- `tsconfig.json` — required for the build step

## References

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP specification](https://spec.modelcontextprotocol.io/)
- [Render Blueprints](https://render.com/docs/infrastructure-as-code)
