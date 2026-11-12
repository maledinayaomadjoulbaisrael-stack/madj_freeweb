import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import request from "supertest";
import type { Express } from "express";

const MCP_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json, text/event-stream",
};

const INIT_BODY = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "test", version: "1.0.0" },
  },
};

function parseSseData(text: string): Record<string, unknown> {
  for (const line of text.trim().split("\n")) {
    if (line.startsWith("data: ")) {
      return JSON.parse(line.slice("data: ".length));
    }
  }
  throw new Error(`No data line in SSE response: ${text}`);
}

describe("with MCP_API_TOKEN set", () => {
  let app: Express;

  beforeAll(async () => {
    process.env.MCP_API_TOKEN = "test-token";
    vi.resetModules();
    const mod = await import("../src/app.js");
    app = mod.app;
  });

  it("health returns 200 without auth", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("mcp rejects without token", async () => {
    const res = await request(app)
      .post("/mcp")
      .set(MCP_HEADERS)
      .send(INIT_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe(-32001);
  });

  it("mcp rejects wrong token", async () => {
    const res = await request(app)
      .post("/mcp")
      .set({ ...MCP_HEADERS, Authorization: "Bearer wrong-token" })
      .send(INIT_BODY);
    expect(res.status).toBe(401);
  });

  it("mcp accepts correct token", async () => {
    const res = await request(app)
      .post("/mcp")
      .set({ ...MCP_HEADERS, Authorization: "Bearer test-token" })
      .send(INIT_BODY);
    expect(res.status).toBe(200);
    const data = parseSseData(res.text);
    expect((data as any).result.serverInfo.name).toBe("my-mcp-server");
  });

  it("tool call returns result", async () => {
    const toolBody = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "hello", arguments: { name: "World" } },
    };
    const res = await request(app)
      .post("/mcp")
      .set({ ...MCP_HEADERS, Authorization: "Bearer test-token" })
      .send(toolBody);
    expect(res.status).toBe(200);
    const data = parseSseData(res.text);
    expect((data as any).result.content[0].text).toBe("Hello, World!");
  });
});

describe("without MCP_API_TOKEN", () => {
  let app: Express;

  beforeEach(async () => {
    delete process.env.MCP_API_TOKEN;
    vi.resetModules();
    const mod = await import("../src/app.js");
    app = mod.app;
  });

  it("mcp is open when no token set", async () => {
    const res = await request(app)
      .post("/mcp")
      .set(MCP_HEADERS)
      .send(INIT_BODY);
    expect(res.status).toBe(200);
  });
});
