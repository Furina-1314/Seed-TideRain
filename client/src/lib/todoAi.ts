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

function normalizeAiError(error: unknown): Error {
  if (error instanceof TypeError) {
    return new Error("网络请求失败（fetch failed）。请检查后端服务是否运行，以及当前网络是否可访问 Gemini API。");
  }
  if (error instanceof Error && /fetch failed|failed to fetch/i.test(error.message)) {
    return new Error("网络请求失败（fetch failed）。请检查后端服务是否运行，以及当前网络是否可访问 Gemini API。");
  }
  return error instanceof Error ? error : new Error("AI 导入失败，请稍后重试。");
}

function normalizeDueDate(input: unknown): string | undefined {
  if (typeof input !== "string" || !input.trim()) return undefined;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

export async function generateTodosByGemini(params: {
  model: GeminiModel | string;
  rawText: string;
}): Promise<AiParsedTodo[]> {
  try {
    const { model, rawText } = params;
    if (!rawText.trim()) throw new Error("请输入要提取待办的聊天记录。");

    if (window.desktop?.isElectron && window.desktop.ai?.generateTodos) {
      const result = await window.desktop.ai.generateTodos({ model, rawText });
      if (!Array.isArray(result) || result.length === 0) {
        throw new Error("未识别到有效待办事项，请检查输入文本。");
      }
      return result
        .map((item: { content: string; dueDate?: string }) => ({
          content: typeof item.content === "string" ? item.content.trim() : "",
          dueDate: normalizeDueDate(item.dueDate),
        }))
        .filter((item) => item.content.length > 0);
    }

    const response = await fetch("/api/ai/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, rawText }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const backendError = typeof data?.error === "string" ? data.error : "";
      if (/fetch failed|failed to fetch/i.test(backendError)) {
        throw new Error("后端到 Gemini 的网络请求失败（fetch failed）。请检查代理/网络连通性。");
      }
      throw new Error(backendError || `AI 导入失败（${response.status}）`);
    }

    const todos = Array.isArray(data?.todos) ? data.todos : [];
    if (todos.length === 0) {
      throw new Error("未识别到有效待办事项，请检查输入文本。");
    }

    return (todos as Array<{ content?: unknown; dueDate?: unknown }>)
      .map((item) => ({
        content: typeof item.content === "string" ? item.content.trim() : "",
        dueDate: normalizeDueDate(item.dueDate),
      }))
      .filter((item) => item.content.length > 0);
  } catch (error) {
    throw normalizeAiError(error);
  }
}
