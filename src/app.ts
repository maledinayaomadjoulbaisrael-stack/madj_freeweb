import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { Request, Response, NextFunction } from "express";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod/v4";

// Import des outils de freeweb-mcp
import { webSearch, searchAndBrowse, browsePage } from "freeweb-mcp";

const MCP_API_TOKEN = process.env.MCP_API_TOKEN;

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "madj-freeweb", version: "1.0.0" },
    { capabilities: { logging: {} } },
  );

  // Outil 1 : Recherche web simple
  server.registerTool(
    "web_search",
    {
      description: "Search the public web without API keys. Returns a list of results (title, URL, snippet).",
      inputSchema: {
        query: z.string().describe("The search query"),
        maxResults: z.number().optional().default(10).describe("Maximum number of results (1-50)"),
      },
    },
    async ({ query, maxResults }) => {
      const results = await webSearch(query, { maxResults });
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // Outil 2 : Recherche + lecture des pages
  server.registerTool(
    "search_and_browse",
    {
      description: "Search the web, open the best hits, extract readable content, and return a synthesis.",
      inputSchema: {
        query: z.string().describe("The search query"),
        maxResults: z.number().optional().default(3).describe("Number of pages to browse (1-10)"),
      },
    },
    async ({ query, maxResults }) => {
      const results = await searchAndBrowse(query, { maxResults });
      return {
        content: [{ type: "text", text: JSON.stringify(results, null, 2) }],
      };
    },
  );

  // Outil 3 : Lire une page spécifique
  server.registerTool(
    "browse_page",
    {
      description: "Visit a URL, read it, and extract the main readable content.",
      inputSchema: {
        url: z.string().url().describe("The URL to fetch"),
      },
    },
    async ({ url }) => {
      const content = await browsePage(url);
      return {
        content: [{ type: "text", text: content }],
      };
    },
  );

  return server;
}

// Le reste du fichier (auth, express app, routes /mcp, /health) ne change pas
const RENDER_EXTERNAL_HOSTNAME = process.env.RENDER_EXTERNAL_HOSTNAME;

export const app = createMcpExpressApp({
  host: "0.0.0.0",
  allowedHosts: RENDER_EXTERNAL_HOSTNAME ? [RENDER_EXTERNAL_HOSTNAME] : undefined,
});

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path === "/health" || !MCP_API_TOKEN) {
    next();
    return;
  }

  const auth = req.headers.authorization ?? "";
  const expected = `Bearer ${MCP_API_TOKEN}`;
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