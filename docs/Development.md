# 汐得时雨（Seed: TideRain）开发文档

本文面向参与本仓库开发的同学，目标是帮助你快速理解当前项目结构、启动方式、数据流和 AI 相关链路。

## 1. 项目概览

- 项目类型：前后端同仓 + Electron 桌面端封装
- 前端：React 19 + TypeScript + Vite
- Web 后端：Express，用于托管构建后的静态资源，并提供 AI 接口
- 桌面端：Electron + electron-builder
- 本地持久化：
  - 业务状态保存在 `localStorage`
  - 音乐文件保存在 `IndexedDB`

当前项目有三种主要运行形态：

- 纯前端开发：Vite Dev Server，仅用于页面开发与样式调试
- Web 生产态：Vite 构建产物 + Express 服务
- Electron 桌面端：开发态加载本地 Vite 地址，打包后加载本地静态文件

## 2. 技术栈

- UI：React 19
- 语言：TypeScript
- 构建：Vite 7、esbuild
- 路由：`wouter` + Hash 路由
- 状态管理：React Context + `GameContext.tsx` 中 `useReducer`
- 样式：Tailwind CSS
- 桌面端：Electron 40
- 打包：electron-builder

## 3. 目录结构

```txt
client/                  前端应用
  src/
    components/          业务组件与 UI 组件
    contexts/            全局状态，如 GameContext / ThemeContext
    hooks/               自定义 hooks
    lib/                 工具函数、AI 调用封装、音乐存储等
    pages/               页面级组件
    types/               前端类型声明

electron/                Electron 主进程与 preload
server/                  Express 服务端
shared/                  共享常量或共享逻辑
docs/                    项目文档
patches/                 pnpm patch 产物
dist/                    构建输出
release/                 Electron 打包输出
```

## 4. 环境要求

- Node.js 22+
- npm

安装依赖：

```bash
npm install
```

## 5. 常用命令

纯前端开发：

```bash
npm run dev
```

说明：

- 只启动 Vite
- 适合做 UI、交互和普通前端逻辑调试
- 这时没有 Express AI 接口
- 个人页里 AI 状态显示 `unavailable` 是正常现象

桌面端开发联调：

```bash
npm run dev:desktop
```

说明：

- 同时启动 Vite 和 Electron
- 前端会优先走 `window.desktop.ai.*` 暴露的 IPC 接口
- 适合调试打包前的桌面端 AI 功能

仅构建前端：

```bash
npm run build:web
```

构建 Web 生产产物：

```bash
npm run build
```

说明：

- `build:web` 生成前端静态资源
- `build:server` 用 esbuild 打包 `server/index.ts`

启动 Web 生产态：

```bash
npm run start
```

Windows 打包：

```bash
npm run dist:win
```

仅生成 unpacked 目录：

```bash
npm run dist:dir
```

类型检查与格式化：

```bash
npm run check
npm run format
```

## 6. 前端架构

### 6.1 应用入口

- `client/src/main.tsx`：应用挂载入口
- `client/src/App.tsx`：Provider 组合、路由挂载、全局布局

### 6.2 路由策略

项目使用 `wouter`，并采用 Hash 路由策略，主要目的是兼容 Electron 打包后的本地文件加载。

### 6.3 全局状态

核心状态在 `client/src/contexts/GameContext.tsx` 中维护，主要包括：

- 好感度、植物成长、专注统计
- 番茄钟状态
- 待办、笔记、习惯、日历数据
- 音乐播放与环境音状态
- 个性化设置，如背景、默认 Gemini 模型

状态恢复与持久化方式：

- 主状态保存在 `localStorage["focus-companion-state"]`
- 音频相关状态还会额外保存在 `localStorage["focus-companion-last-audio"]`
- 页面初始化时会从这两处恢复状态

### 6.4 音乐文件存储

音乐文件不直接保存在 `localStorage`，而是使用 IndexedDB 存储，相关逻辑在：

- `client/src/lib/musicStorage.ts`

## 7. AI 功能架构

项目中“AI 批量导入待办”有两条调用链。

### 7.1 前端统一入口

前端统一入口在：

- `client/src/lib/todoAi.ts`

调用逻辑如下：

- 如果检测到 `window.desktop.ai.generateTodos` 存在，则走 Electron IPC
- 否则走 Web 后端接口 `POST /api/ai/todos`

这意味着：

- `npm run dev` 下通常没有 AI 接口
- `npm run dev:desktop` 下走 Electron 主进程
- `npm run build && npm run start` 下走 Express 后端

### 7.2 Web 端 AI 链路

Web 后端文件：

- `server/index.ts`

核心职责：

- 提供 `GET /api/ai/config`
- 提供 `POST /api/ai/config`
- 提供 `POST /api/ai/todos`
- 托管 `dist/public` 下的前端静态资源

Gemini 请求流程：

1. 从环境变量或 `.env` 读取 `GEMINI_API_KEY`
2. 读取请求体中的 `model` 和 `rawText`
3. 向 Gemini `generateContent` 接口发起请求
4. 从 Gemini 响应中提取 JSON 文本
5. 解析出 `todos`
6. 规范化 `dueDate`

### 7.3 Electron AI 链路

关键文件：

- `electron/main.mjs`
- `electron/preload.cjs`

调用流程：

1. preload 通过 `contextBridge` 暴露 `window.desktop.ai`
2. 前端调用 `window.desktop.ai.generateTodos(...)`
3. Electron 主进程中的 `ipcMain.handle("ai:todos:generate")` 接收请求
4. 主进程直接请求 Gemini 并返回解析结果

### 7.4 模型配置

前端可选 Gemini 模型定义在：

- `client/src/lib/todoAi.ts`

当前默认模型存放在全局状态里，字段名为：

- `geminiModel`

## 8. 环境变量与代理

示例文件：

- `.env.example`

当前支持的关键环境变量：

```env
GEMINI_API_KEY=
HTTP_PROXY=
HTTPS_PROXY=
NODE_USE_ENV_PROXY=
```

说明：

- `GEMINI_API_KEY`：Gemini API Key
- `HTTP_PROXY`：HTTP 代理地址
- `HTTPS_PROXY`：HTTPS 代理地址
- `NODE_USE_ENV_PROXY`：是否启用 `.env` 中的代理配置

当前行为：

- Web 后端会从 `.env` 读取代理配置，并在请求 Gemini 时优先使用代理
- Electron 主进程会从 `.env` 读取代理配置，并在应用启动时配置 Electron 网络栈代理
- 如果代理项为空，则默认不额外配置代理

推荐写法：

```env
GEMINI_API_KEY=your_key
HTTP_PROXY=http://127.0.0.1:7890
HTTPS_PROXY=http://127.0.0.1:7890
NODE_USE_ENV_PROXY=1
```

## 9. 打包与运行差异

### 9.1 Web 生产态

`npm run build && npm run start` 后：

- 前端资源来自 `dist/public`
- Express 入口来自 `dist/index.js`
- AI 功能通过 `/api/ai/*` 提供

### 9.2 Electron 开发态

`npm run dev:desktop` 下：

- Electron 加载 `http://127.0.0.1:3000`
- Electron 会自动打开 DevTools
- AI 功能通过 IPC 走主进程

### 9.3 Electron 打包后

打包后：

- Electron 加载本地 `dist/public/index.html`
- 主进程按以下顺序查找 `.env`

1.  userData 目录下的 .env
2. .exe 同目录下的 .env
3. 当前工作目录 .env
4. 安装包/源码相对路径推导出的 .env

## 10. 调试建议

### 10.1 调试前端状态

常见入口：

- `localStorage["focus-companion-state"]`
- `localStorage["focus-companion-last-audio"]`

例如在控制台查看当前好感度：

```js
const state = JSON.parse(localStorage.getItem("focus-companion-state") || "{}");
console.log(state.affection);
```

### 10.2 调试 Web AI 接口

先启动：

```bash
npm run build
npm run start
```

然后可直接用 PowerShell 请求：

```powershell
Invoke-RestMethod -Method Post `
  -Uri "http://127.0.0.1:3000/api/ai/todos" `
  -ContentType "application/json" `
  -Body '{"model":"gemini-3-flash-preview","rawText":"明天下午5点前把周报发给老师，顺便整理实验数据。"}'
```

### 10.3 调试 Electron AI

使用：

```bash
npm run dev:desktop
```

建议同时观察：

- Electron 窗口 DevTools
- 启动 Electron 的终端输出

### 10.4 常见 AI 问题

- `GEMINI_API_KEY` 未配置
- 只运行了 `npm run dev`
- 当前网络无法访问 Gemini
- 代理配置未生效
- Gemini 返回内容不是预期 JSON

## 11. 当前已知注意事项

- `npm run dev` 仅适合前端开发，不适合作为 AI 调试入口
- 如果 `dist/index.js` 被正在运行的 Node 进程占用，`npm run build:server` 可能写入失败
- AI 请求相关报错很多时候不是前端问题，而是 Gemini 网络访问或代理配置问题

## 12. 相关文件索引

- `client/src/contexts/GameContext.tsx`：核心状态管理
- `client/src/lib/todoAi.ts`：前端 AI 入口
- `client/src/lib/musicStorage.ts`：音乐文件 IndexedDB 存储
- `client/src/components/NotesPanel.tsx`：AI 导入待办的主要 UI 入口
- `client/src/components/ProfilePage.tsx`：AI 配置状态展示
- `server/index.ts`：Web 后端与 Gemini 请求
- `electron/main.mjs`：Electron 主进程
- `electron/preload.cjs`：Electron 与渲染进程桥接
