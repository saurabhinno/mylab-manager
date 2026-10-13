const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("mylab", {
  isDesktop: true,
  drive: {
    getStatus: () => ipcRenderer.invoke("drive:getStatus"),
    backupNow: () => ipcRenderer.invoke("drive:backupNow"),
    restore: () => ipcRenderer.invoke("drive:restore"),
  },
});
