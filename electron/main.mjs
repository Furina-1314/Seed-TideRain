import { app, BrowserWindow, shell, ipcMain, net, session } from "electron";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
const DEV_URL = "http://127.0.0.1:3000";

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

function readEnvValueFromEnvFile(envPath, key) {
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

function getEnvCandidates() {
  const envCandidates = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(__dirname, "..", ".env"),
  ];

  if (app.isPackaged) {
    envCandidates.unshift(path.resolve(path.dirname(process.execPath), ".env"));
  }

  if (app.isReady()) {
    envCandidates.unshift(path.resolve(app.getPath("userData"), ".env"));
  }

  return envCandidates;
}

function getEnvValue(key) {
  const directEnv = (process.env[key] || "").trim();
  if (directEnv) return directEnv;

  for (const envPath of getEnvCandidates()) {
    const value = readEnvValueFromEnvFile(envPath, key).trim();
    if (value) return value;
  }

  return "";
}

function getGeminiApiKey() {
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

function upsertGeminiApiKeyInEnvFile(envPath, apiKey) {
  const normalizedKey = String(apiKey || "").trim();
  const existing = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf-8") : "";
  const lines = existing.length > 0 ? existing.split("\n") : [];
  const filtered = lines.filter((line) => !line.trim().match(/^GEMINI_API_KEY\s*=/));
  filtered.push(`GEMINI_API_KEY=${normalizedKey}`);
  const nextContent = `${filtered.join("\n").replace(/\n+$/g, "")}\n`;
  fs.writeFileSync(envPath, nextContent, "utf-8");
}

function normalizeDueDate(input) {
  if (typeof input !== "string" || !input.trim()) return undefined;
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

function extractJsonObject(raw) {
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

async function configureNetworkProxy() {
  const { httpProxy, httpsProxy, nodeUseEnvProxy } = getProxyConfig();

  if (httpProxy) process.env.HTTP_PROXY = httpProxy;
  if (httpsProxy) process.env.HTTPS_PROXY = httpsProxy;
  if (nodeUseEnvProxy) process.env.NODE_USE_ENV_PROXY = nodeUseEnvProxy;

  const proxyRules = [
    httpProxy ? `http=${httpProxy}` : "",
    httpsProxy ? `https=${httpsProxy}` : "",
  ]
    .filter(Boolean)
    .join(";");

  if (!proxyRules) return;

  await session.defaultSession.setProxy({
    mode: "fixed_servers",
    proxyRules,
  });
}

async function fetchGeminiTodos({ model, rawText, apiKey }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  let response;
  try {
    response = await net.fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        contents: [{ role: "user", parts: [{ text: `${TODO_EXTRACTION_PROMPT}\n\n群聊文本如下：\n${rawText}` }] }],
      }),
    });
  } catch (error) {
    const details = error instanceof Error ? ` (${error.message})` : "";
    throw new Error(`无法连接 Gemini API（网络或代理异常）。请检查网络、代理设置，或确认当前网络可访问 Google AI 服务。${details}`);
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
  const parsed = JSON.parse(normalizedText);
  if (!Array.isArray(parsed?.todos)) {
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

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: "#0f172a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (isDev) {
    win.loadURL(DEV_URL);
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "public", "index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
}

ipcMain.handle("ai:config:get", async () => ({ hasKey: Boolean(getGeminiApiKey()) }));
ipcMain.handle("ai:config:set", async (_event, payload) => {
  const apiKey = typeof payload?.apiKey === "string" ? payload.apiKey.trim() : "";
  if (!apiKey) throw new Error("API Key 不能为空。");
  const envPath = app.isReady()
    ? path.resolve(app.getPath("userData"), ".env")
    : path.resolve(process.cwd(), ".env");
  upsertGeminiApiKeyInEnvFile(envPath, apiKey);
  process.env.GEMINI_API_KEY = apiKey;
  return { ok: true };
});
ipcMain.handle("ai:todos:generate", async (_event, payload) => {
  const model = typeof payload?.model === "string" ? payload.model.trim() : "";
  const rawText = typeof payload?.rawText === "string" ? payload.rawText.trim() : "";
  const geminiApiKey = getGeminiApiKey();

  if (!geminiApiKey) throw new Error("请先在启动应用前配置 GEMINI_API_KEY 环境变量。");
  if (!model || !rawText) throw new Error("模型和文本内容不能为空。");

  return fetchGeminiTodos({ model, rawText, apiKey: geminiApiKey });
});

app.whenReady().then(async () => {
  await configureNetworkProxy();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
