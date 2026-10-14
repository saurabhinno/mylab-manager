const { contextBridge, ipcRenderer } = require("electron");

/**
 * Native window.alert / window.confirm break keyboard input in Electron
 * (Chromium bug). Route through main-process dialogs instead.
 */
contextBridge.exposeInMainWorld("mylab", {
  isDesktop: true,
  alert: (message) =>
    ipcRenderer.sendSync("dialog:alert", String(message ?? "")),
  confirm: (message) =>
    ipcRenderer.sendSync("dialog:confirm", String(message ?? "")),
  restoreInputFocus: () => ipcRenderer.send("dialog:restore-focus"),
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
