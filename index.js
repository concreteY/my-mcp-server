import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod"; 
import cors from "cors"; 

const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST', 'OPTIONS'], 
    allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
}));

const server = new McpServer({
  name: "My Remote MCP Server",
  version: "1.0.0",
});

server.tool(
  "add_numbers",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => {
    return {
      content: [{ type: "text", text: String(a + b) }],
    };
  }
);

const transports = new Map(); 

app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");
  const transport = new SSEServerTransport("/messages", res);
  
  console.log("Session created:", transport.sessionId);
  transports.set(transport.sessionId, transport);

  await server.connect(transport);

  res.on("close", () => {
    console.log("Connection closed for session:", transport.sessionId);
    transports.delete(transport.sessionId);
  });
});

// *************** 수정된 부분 ***************
// express.json() 미들웨어를 제거했습니다.
app.post("/messages", async (req, res) => {
  const sessionId = req.query.sessionId;
  
  console.log(`Received message for session: ${sessionId}`); // 디버깅용 로그

  const transport = transports.get(sessionId);

  if (!transport) {
    console.error("Session not found:", sessionId);
    res.status(404).send("Session not found");
    return;
  }

  try {
    // SDK가 직접 req 스트림을 처리하도록 합니다.
    await transport.handlePostMessage(req, res);
  } catch (error) {
    console.error("Error handling message:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
// *******************************************

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
});