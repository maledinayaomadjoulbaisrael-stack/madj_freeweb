import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";

const MCP_API_TOKEN = process.env.MCP_API_TOKEN;

// Called per request — stateless mode means no session persistence,
// which is required for horizontally scaled deployments.
export function createServer(): McpServer {
  const server = new McpServer(
    { name: "my-mcp-server", version: "1.0.0" },
    { capabilities: { logging: {} } },
  );

  // Add tools here. `description` is surfaced to LLMs; Zod schemas
  // in `inputSchema` are converted to JSON Schema automatically.
  server.registerTool(
    "hello",
    {
      description: "Say hello to someone",
      inputSchema: { name: z.string() },
    },
    async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    }),
  );

  return server;
}

const RENDER_EXTERNAL_HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME;

export const app = createMcpExpressApp({
  host: "0.0.0.0",
  allowedHosts: RENDER_EXTERNAL_HOSTNAME ? [RENDER_EXTERNAL_HOSTNAME] : undefined,
});

// Simple bearer token auth. For multi-user or production setups,
// consider upgrading to the MCP SDK's built-in OAuth 2.1 support.
// When no token is set (local dev), auth is disabled entirely.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/health" || !MCP_API_TOKEN) {
    next();
    return;
  }

  const auth = req.headers.authorization ?? "";
  const expected = `Bearer ${MCP_API_TOKEN}`;
  // timingSafeEqual requires equal-length buffers, so check length first
  if (
    auth.length === expected.length &&
    timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
  ) {
    next();
    return;
  }

  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message: "Unauthorized" },
    id: null,
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  const server = createServer();
  try {
    // sessionIdGenerator: undefined → stateless (no session tracking)
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    res.on("close", () => {
      transport.close();
      server.close();
    });
  } catch (error) {
    console.error("Error handling MCP request:", error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

// GET and DELETE on /mcp are part of the Streamable HTTP spec but
// only apply to stateful servers. Reject explicitly for clarity.
app.get("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});

app.delete("/mcp", (_req: Request, res: Response) => {
  res.status(405).json({
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
});
