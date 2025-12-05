import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod"; // 데이터 검증용 (SDK에 포함됨)
import cors from "cors"; // cors module import 


const app = express();

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Mcp-Session-Id'],
}));

// MCP 서버 인스턴스 생성
const server = new McpServer({
  name: "My Remote MCP Server",
  version: "1.0.0",
});

// 간단한 도구(Tool) 추가: 두 숫자를 더하기
server.tool(
  "add_numbers",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => {
    return {
      content: [{ type: "text", text: String(a + b) }],
    };
  }
);

// SSE 연결을 저장할 변수 (간단한 구현을 위함)
let transport;

// SSE 엔드포인트: 클라이언트(Claude 등)가 처음 연결하는 곳
app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");
  transport = new SSEServerTransport("/messages", res);
  await server.connect(transport);
});


// 메시지 수신 엔드포인트: 클라이언트가 명령을 보내는 곳
app.post("/messages", express.json(), async (req, res) => {
  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    res.status(400).send("No active connection");
  }
});

// 이 라인이 Express 앱의 모든 라우트(GET, POST 등)를 처리하는 가장 마지막 부분
app.use("/", server);

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
});