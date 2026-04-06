export interface AiParsedTodo {
  content: string;
  dueDate?: string;
}

export const GEMINI_MODELS = [
  "gemini-3-flash-preview",
  "gemini-3.1-flash-lite-preview",
  "gemini-3.1-pro-preview",
] as const;

export type GeminiModel = (typeof GEMINI_MODELS)[number];

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

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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

function normalizeDueDate(input: unknown): string | undefined {
  if (typeof input !== "string" || !input.trim()) return undefined;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export async function generateTodosByGemini(params: {
  apiKey: string;
  model: GeminiModel | string;
  rawText: string;
}): Promise<AiParsedTodo[]> {
  const { apiKey, model, rawText } = params;
  const key = apiKey.trim();
  if (!key) throw new Error("请先在个人中心设置 Gemini API Key。");
  if (!rawText.trim()) throw new Error("请输入要提取待办的聊天记录。");

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
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
              text: `${TODO_EXTRACTION_PROMPT}\n\n群聊文本如下：\n${rawText}`,
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
  const parsed = safeJsonParse<{ todos?: Array<{ content?: unknown; dueDate?: unknown }> }>(normalizedText);
  if (!parsed || !Array.isArray(parsed.todos)) {
    throw new Error("Gemini 返回格式不符合预期。");
  }

  const todos: AiParsedTodo[] = parsed.todos
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
