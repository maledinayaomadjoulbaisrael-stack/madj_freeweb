import { app } from "./app.js";

const PORT = parseInt(process.env.PORT || "10000", 10);

if (!process.env.MCP_API_TOKEN) {
  console.warn(
    "WARNING: MCP_API_TOKEN is not set. The server is running without authentication.",
  );
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`MCP server listening on port ${PORT}`);
});

process.on("SIGINT", () => {
  console.log("Shutting down server...");
  process.exit(0);
});
