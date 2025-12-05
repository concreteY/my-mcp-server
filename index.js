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
//let transport;
const transports = new Map(); 

// SSE 엔드포인트: 클라이언트(Claude 등)가 처음 연결하는 곳
app.get("/sse", async (req, res) => {
  console.log("New SSE connection established");
  const transport = new SSEServerTransport("/messages", res);

// transport 객체에는 고유한 sessionId가 생성되어 있습니다.
  console.log("Session created:", transport.sessionId);
  transports.set(transport.sessionId, transport);

  await server.connect(transport);

// [변경점 3] 연결이 끊어지면 Map에서 제거 (메모리 누수 방지)
  res.on("close", () => {
    console.log("Connection closed for session:", transport.sessionId);
    transports.delete(transport.sessionId);
});


// 메시지 수신 엔드포인트: 클라이언트가 명령을 보내는 곳
app.post("/messages", express.json(), async (req, res) => {
// [변경점 4] URL의 쿼리 파라미터에서 sessionId를 가져옴
  const sessionId = req.query.sessionId;
  
  // 해당 세션 ID에 맞는 transport를 Map에서 찾음
  const transport = transports.get(sessionId);

  if (transport) {
    await transport.handlePostMessage(req, res);
  } else {
    // 세션을 찾지 못하면 에러 반환
    console.error("Session not found:", sessionId);
    res.status(404).send("Session not found");
  }
});

// 이 라인이 Express 앱의 모든 라우트(GET, POST 등)를 처리하는 가장 마지막 부분
//app.use(server.router);

// 서버 시작
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP Server running on port ${PORT}`);
  console.log(`SSE Endpoint: http://localhost:${PORT}/sse`);
});