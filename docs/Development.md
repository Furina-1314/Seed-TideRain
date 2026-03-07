# Companion-style Focus Tool 开发辅助文档

本文档面向参与本仓库开发的同学，目标是帮助你快速理解项目结构、启动方式和常见改造路径。

## 1. 项目概览

- 项目类型：前后端同仓 + Electron 桌面封装
- 主要能力：专注计时、环境音/音乐、习惯记录、便签与笔记、日历、角色陪伴互动
- 运行形态：
  - Web 开发态：Vite Dev Server（默认 `127.0.0.1:3000`）
  - Web 生产态：Vite 构建静态资源 + Express 托管
  - 桌面端：Electron 加载开发 URL 或生产构建文件

## 2. 技术栈

- 前端：React 19 + TypeScript + Vite + Tailwind
- 路由：wouter + Hash 路由
- 状态：React Context（`GameContext`）
- 后端：Express（主要托管静态资源）
- 桌面端：Electron + electron-builder
- 本地持久化：
  - 业务数据：`localStorage`
  - 音乐文件：IndexedDB（见 `client/src/lib/musicStorage.ts`）

## 3. 目录结构（核心）

```txt
client/                 前端应用
  src/
    components/         功能组件与 UI 组件
    contexts/           全局状态（GameContext、ThemeContext）
    pages/              页面层（Home、NotFound）
    lib/                工具与存储逻辑（如 musicStorage）
electron/               Electron 主进程与 preload
server/                 Express 服务
shared/                 前后端共享常量
scripts/                本地预览脚本（bat/sh）
doc/                    文档
```

## 4. 快速开始

环境建议：

- Node.js 22+
- npm

安装依赖：

```bash
npm install
```

## 5. 常用命令

Web 开发：

```bash
npm run dev
```

Web 构建（只构建前端）：

```bash
npm run build:web
```

Web 生产启动（构建前端 + 打包 server + 启动 Express）：

```bash
npm run build
npm run start
```

桌面开发（Electron + Vite 联调）：

```bash
npm run dev:desktop
```

桌面打包（Windows 安装包）：

```bash
npm run dist:win
```

仅生成 unpacked 目录（用于排查）：

```bash
npm run dist:dir
```

类型检查与格式化：

```bash
npm run check
npm run format
```

## 6. 架构与数据流

### 6.1 前端入口

- `client/src/main.tsx`：应用挂载入口
- `client/src/App.tsx`：Provider 组合、路由挂载、错误边界

### 6.2 路由策略

使用 `wouter + useHashLocation`

### 6.3 全局状态

- `client/src/contexts/GameContext.tsx` 维护主状态，包括：
  - 计时与轮次
  - 习惯/笔记/便签/日历数据
  - 音乐播放状态
  - UI 状态（活动面板、背景等）

### 6.4 存储策略

- 常规数据：`localStorage`
- 音乐文件：`IndexedDB`

## 7. Electron 相关说明

关键文件：

- `electron/main.mjs`：创建窗口，开发态加载 `http://127.0.0.1:3000`，生产态加载 `dist/public/index.html`
- `electron/preload.mjs`：向渲染进程暴露最小桥接对象

配套要点：

- `vite.config.ts` 已配置 `base: "./"`，确保 `file://` 下静态资源可加载
- 路由使用 Hash 模式