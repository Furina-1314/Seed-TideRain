const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("desktop", {
  isElectron: true,
  platform: process.platform,
  ai: {
    getConfig: () => ipcRenderer.invoke("ai:config:get"),
    setConfig: (params) => ipcRenderer.invoke("ai:config:set", params),
    generateTodos: (params) => ipcRenderer.invoke("ai:todos:generate", params),
  },
});
