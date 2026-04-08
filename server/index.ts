import express from "express";
import { createServer } from "http";
import path from "path";
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

let geminiApiKey = (process.env.GEMINI_API_KEY || "").trim();

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

async function fetchGeminiTodos(params: { model: string; rawText: string; apiKey: string }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(params.model)}:generateContent?key=${encodeURIComponent(params.apiKey)}`;
  const response = await fetch(endpoint, {
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
    res.json({ hasKey: Boolean(geminiApiKey) });
  });

  app.post("/api/ai/config", (req, res) => {
    const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey.trim() : "";
    if (!apiKey) {
      res.status(400).json({ error: "API Key 不能为空。" });
      return;
    }
    geminiApiKey = apiKey;
    res.json({ hasKey: true });
  });

  app.post("/api/ai/todos", async (req, res) => {
    try {
      const model = typeof req.body?.model === "string" ? req.body.model.trim() : "";
      const rawText = typeof req.body?.rawText === "string" ? req.body.rawText.trim() : "";
      if (!geminiApiKey) {
        res.status(400).json({ error: "请先在个人中心设置 Gemini API Key。" });
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
