const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mylab", {
  isDesktop: true,
  drive: {
    getStatus: () => ipcRenderer.invoke("drive:getStatus"),
    backupNow: () => ipcRenderer.invoke("drive:backupNow"),
    restore: () => ipcRenderer.invoke("drive:restore"),
  },
  updates: {
    getStatus: () => ipcRenderer.invoke("updates:getStatus"),
    check: () => ipcRenderer.invoke("updates:check"),
    download: () => ipcRenderer.invoke("updates:download"),
    install: () => ipcRenderer.invoke("updates:install"),
    getVersion: () => ipcRenderer.invoke("updates:getVersion"),
    onStatus: (callback) => {
      const handler = (_event, status) => callback(status);
      ipcRenderer.on("updates:status", handler);
      return () => ipcRenderer.removeListener("updates:status", handler);
    },
  },
});
