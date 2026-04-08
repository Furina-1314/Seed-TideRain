import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
  ai: {
    getConfig: () => ipcRenderer.invoke("ai:config:get"),
    setApiKey: (apiKey) => ipcRenderer.invoke("ai:config:set", { apiKey }),
    generateTodos: (params) => ipcRenderer.invoke("ai:todos:generate", params),
  },
});
