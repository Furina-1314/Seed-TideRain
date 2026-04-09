import express from "express";
import { createServer } from "http";
import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "path";
import tls from "node:tls";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TODO_EXTRACTION_PROMPT = `你是“待办提取助手”。
请从给定的群聊文本中抽取“需要执行的任务事项”，忽略通知、宣传、背景介绍、无行动要求内容。

输出必须是 JSON（不要 markdown 代码块），结构如下：
{
  "todos": [
    {
      "content": "简洁待办内容",
      "dueDate": "ISO-8601日期时间字符串或null"
    }
  ]
}

规则：
1) content 必须简洁，10~40字，使用中文。
2) 若文本里明确出现截止时间/完成时间要求，dueDate 输出对应的 ISO-8601 时间（例如 2026-04-02T17:00:00+08:00）。
3) 若没有明确截止时间，dueDate 设为 null。
4) 只保留真正需要执行的事项，不要输出解释。`;

function readEnvValueFromEnvFile(envPath: string, key: string): string {
  if (!fs.existsSync(envPath)) return "";
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(new RegExp(`^${key}\\s*=\\s*(.*)$`));
    if (!match) continue;
    return match[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return "";
}

function getEnvCandidates(): string[] {
  return [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env"),
  ];
}

function getEnvValue(key: string): string {
  const directEnv = (process.env[key] || "").trim();
  if (directEnv) return directEnv;

  for (const envPath of getEnvCandidates()) {
    const value = readEnvValueFromEnvFile(envPath, key).trim();
    if (value) return value;
  }

  return "";
}

function getGeminiApiKey(): string {
  return getEnvValue("GEMINI_API_KEY");
}

function getProxyConfig() {
  const httpsProxy = getEnvValue("HTTPS_PROXY");
  const httpProxy = getEnvValue("HTTP_PROXY") || httpsProxy;
  const nodeUseEnvProxy = getEnvValue("NODE_USE_ENV_PROXY");

  return {
    httpProxy,
    httpsProxy: httpsProxy || httpProxy,
    nodeUseEnvProxy,
  };
}

function shouldUseConfiguredProxy(): boolean {
  const raw = getProxyConfig().nodeUseEnvProxy.trim();
  if (!raw) return true;
  return /^(1|true|yes|on)$/i.test(raw);
}

function upsertGeminiApiKeyInEnvFile(envPath: string, apiKey: string) {
  const normalizedKey = apiKey.trim();
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  const lines = existing.length > 0 ? existing.split("\n") : [];
  const filtered = lines.filter((line) => !line.trim().match(/^GEMINI_API_KEY\s*=/));
  filtered.push(`GEMINI_API_KEY=${normalizedKey}`);
  const nextContent = `${filtered.join("\n").replace(/\n+$/g, "")}\n`;
  fs.writeFileSync(envPath, nextContent, "utf-8");
}

function normalizeDueDate(input: unknown): string | undefined {
  if (typeof input !== "string" || !input.trim()) return undefined;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function extractJsonObject(raw: string): string {
  const trimmed = raw.trim();
  const markdownJson = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (markdownJson?.[1]) return markdownJson[1].trim();
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function getProxyUrlForEndpoint(endpoint: string): string {
  if (!shouldUseConfiguredProxy()) return "";

  const { protocol } = new URL(endpoint);
  const { httpProxy, httpsProxy } = getProxyConfig();
  if (protocol === "https:") return httpsProxy || httpProxy;
  return httpProxy || httpsProxy;
}

function buildProxyAuthHeader(proxyUrl: URL): string | undefined {
  if (!proxyUrl.username && !proxyUrl.password) return undefined;
  const credentials = `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`;
  return `Basic ${Buffer.from(credentials).toString("base64")}`;
}

function decodeChunkedBody(bodyBuffer: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < bodyBuffer.length) {
    const lineEnd = bodyBuffer.indexOf("\r\n", offset, "utf-8");
    if (lineEnd < 0) {
      throw new Error("Invalid chunked response");
    }

    const sizeHex = bodyBuffer
      .slice(offset, lineEnd)
      .toString("utf-8")
      .split(";", 1)[0]
      .trim();
    const chunkSize = Number.parseInt(sizeHex, 16);
    if (Number.isNaN(chunkSize)) {
      throw new Error(`Invalid chunk size: ${sizeHex}`);
    }

    offset = lineEnd + 2;
    if (chunkSize === 0) {
      return Buffer.concat(chunks);
    }

    const chunkEnd = offset + chunkSize;
    if (chunkEnd > bodyBuffer.length) {
      throw new Error("Chunk exceeds body length");
    }

    chunks.push(bodyBuffer.slice(offset, chunkEnd));
    offset = chunkEnd + 2;
  }

  return Buffer.concat(chunks);
}

async function requestGeminiViaProxy(params: {
  endpoint: string;
  body: string;
  proxyUrl: string;
}): Promise<string> {
  const targetUrl = new URL(params.endpoint);
  const proxy = new URL(params.proxyUrl);
  const proxyModule = proxy.protocol === "https:" ? https : http;
  const proxyPort = proxy.port ? Number(proxy.port) : proxy.protocol === "https:" ? 443 : 80;
  const targetPort = targetUrl.port ? Number(targetUrl.port) : 443;
  const proxyAuth = buildProxyAuthHeader(proxy);

  return new Promise((resolve, reject) => {
    const connectReq = proxyModule.request({
      host: proxy.hostname,
      port: proxyPort,
      method: "CONNECT",
      path: `${targetUrl.hostname}:${targetPort}`,
      headers: {
        Host: `${targetUrl.hostname}:${targetPort}`,
        ...(proxyAuth ? { "Proxy-Authorization": proxyAuth } : {}),
      },
    });

    connectReq.once("connect", (res, socket, head) => {
      if ((res.statusCode || 500) !== 200) {
        socket.destroy();
        reject(new Error(`Proxy CONNECT failed with status ${res.statusCode || 500}`));
        return;
      }

      if (head.length > 0) socket.unshift(head);

      const tlsSocket = tls.connect({
        socket,
        servername: targetUrl.hostname,
      });

      const chunks: Buffer[] = [];
      tlsSocket.once("secureConnect", () => {
        const requestLines = [
          `POST ${targetUrl.pathname}${targetUrl.search} HTTP/1.1`,
          `Host: ${targetUrl.hostname}`,
          "Content-Type: application/json",
          `Content-Length: ${Buffer.byteLength(params.body)}`,
          "Accept-Encoding: identity",
          "Connection: close",
          "",
          params.body,
        ];
        tlsSocket.write(requestLines.join("\r\n"));
      });

      tlsSocket.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      tlsSocket.on("end", () => {
        const rawResponse = Buffer.concat(chunks);
        const headerEndIndex = rawResponse.indexOf("\r\n\r\n", 0, "utf-8");
        if (headerEndIndex < 0) {
          reject(new Error("Invalid proxy response"));
          return;
        }

        const headerText = rawResponse.slice(0, headerEndIndex).toString("utf-8");
        let bodyBuffer: Uint8Array = rawResponse.subarray(headerEndIndex + 4);
        const statusMatch = headerText.match(/^HTTP\/1\.\d\s+(\d{3})/);
        const status = statusMatch ? Number(statusMatch[1]) : 500;
        const isChunked = /transfer-encoding:\s*chunked/i.test(headerText);

        if (isChunked) {
          try {
            bodyBuffer = decodeChunkedBody(Buffer.from(bodyBuffer));
          } catch (error) {
            reject(error);
            return;
          }
        }

        const bodyText = Buffer.from(bodyBuffer).toString("utf-8");

        if (status < 200 || status >= 300) {
          reject(new Error(`Gemini request failed (${status}): ${bodyText || "unknown error"}`));
          return;
        }

        resolve(bodyText);
      });
      tlsSocket.on("error", reject);
    });

    connectReq.on("error", reject);
    connectReq.end();
  });
}

async function fetchGeminiTodos(params: { model: string; rawText: string; apiKey: string }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const proxyUrl = getProxyUrlForEndpoint(endpoint);
  if (proxyUrl) {
    const responseText = await requestGeminiViaProxy({
      endpoint,
      proxyUrl,
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${TODO_EXTRACTION_PROMPT}\n\n群聊文本如下：\n${params.rawText}`,
              },
            ],
          },
        ],
      }),
    }).catch((error) => {
      const details = error instanceof Error ? ` (${error.message})` : "";
      throw new Error(`无法连接 Gemini API（网络或代理异常）。请检查网络、代理设置，或确认当前网络可访问 Google AI 服务。${details}`);
    });

    const data = JSON.parse(responseText) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== "string" || !text.trim()) {
      throw new Error("Gemini 未返回可解析文本。");
    }

    const normalizedText = extractJsonObject(text);
    const parsed = JSON.parse(normalizedText) as { todos?: Array<{ content?: unknown; dueDate?: unknown }> };
    if (!Array.isArray(parsed.todos)) {
      throw new Error("Gemini 返回格式不符合预期。");
    }

    const todos = parsed.todos
      .map((item) => ({
        content: typeof item.content === "string" ? item.content.trim() : "",
        dueDate: normalizeDueDate(item.dueDate),
      }))
      .filter((item) => item.content.length > 0);

    if (todos.length === 0) {
      throw new Error("未识别到有效待办事项，请检查输入文本。");
    }

    return todos;
  }

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `${TODO_EXTRACTION_PROMPT}\n\n群聊文本如下：\n${params.rawText}`,
              },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new Error("无法连接 Gemini API（网络或代理异常）。请检查网络、代理设置，或确认当前网络可访问 Google AI 服务。");
  }

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini 请求失败（${response.status}）：${errText || "未知错误"}`);
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error("Gemini 未返回可解析文本。");
  }

  const normalizedText = extractJsonObject(text);
  const parsed = JSON.parse(normalizedText) as { todos?: Array<{ content?: unknown; dueDate?: unknown }> };
  if (!Array.isArray(parsed.todos)) {
    throw new Error("Gemini 返回格式不符合预期。");
  }

  const todos = parsed.todos
    .map((item) => ({
      content: typeof item.content === "string" ? item.content.trim() : "",
      dueDate: normalizeDueDate(item.dueDate),
    }))
    .filter((item) => item.content.length > 0);

  if (todos.length === 0) {
    throw new Error("未识别到有效待办事项，请检查输入文本。");
  }

  return todos;
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/ai/config", (_req, res) => {
    res.json({ hasKey: Boolean(getGeminiApiKey()) });
  });

  app.post("/api/ai/config", (req, res) => {
    try {
      const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
      if (!apiKey) {
        res.status(400).json({ error: "API Key 不能为空。" });
        return;
      }
      const envPath = path.resolve(process.cwd(), ".env");
      upsertGeminiApiKeyInEnvFile(envPath, apiKey);
      process.env.GEMINI_API_KEY = apiKey;
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "保存配置失败" });
    }
  });

  app.post("/api/ai/todos", async (req, res) => {
    try {
      const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
      const rawText = typeof req.body?.rawText === "string" ? req.body.rawText.trim() : "";
      const geminiApiKey = getGeminiApiKey();
      if (!geminiApiKey) {
        res.status(400).json({ error: "请先在服务端 .env 或环境变量中配置 GEMINI_API_KEY。" });
        return;
      }
      if (!model || !rawText) {
        res.status(400).json({ error: "模型和文本内容不能为空。" });
        return;
      }
      const todos = await fetchGeminiTodos({ model, rawText, apiKey: geminiApiKey });
      res.json({ todos });
    } catch (error) {
      res.status(500).json({ error: error instanceof Error ? error.message : "AI 导入失败" });
    }
  });

  // Serve static files from dist/public in production
  const staticPath =
    process.env.NODE_ENV === "production"
      ? path.resolve(__dirname, "public")
      : path.resolve(__dirname, "..", "dist", "public");

  app.use(express.static(staticPath));

  // Handle client-side routing - serve index.html for all routes
  app.get("*", (_req, res) => {
    res.sendFile(path.join(staticPath, "index.html"));
  });

  const port = process.env.PORT || 3000;

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
