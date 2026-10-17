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
  analyzers: {
    listPorts: () => ipcRenderer.invoke("analyzers:listPorts"),
    getStatus: () => ipcRenderer.invoke("analyzers:getStatus"),
    getRaw: () => ipcRenderer.invoke("analyzers:getRaw"),
    clearRaw: () => ipcRenderer.invoke("analyzers:clearRaw"),
    open: (path, options) => ipcRenderer.invoke("analyzers:open", path, options),
    close: () => ipcRenderer.invoke("analyzers:close"),
    startLan: (port) => ipcRenderer.invoke("analyzers:startLan", port),
    stopLan: () => ipcRenderer.invoke("analyzers:stopLan"),
    onPorts: (callback) => {
      const handler = (_event, ports) => callback(ports);
      ipcRenderer.on("analyzers:ports", handler);
      return () => ipcRenderer.removeListener("analyzers:ports", handler);
    },
    onData: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:data", handler);
      return () => ipcRenderer.removeListener("analyzers:data", handler);
    },
    onRaw: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:raw", handler);
      return () => ipcRenderer.removeListener("analyzers:raw", handler);
    },
    onMessage: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:message", handler);
      return () => ipcRenderer.removeListener("analyzers:message", handler);
    },
    onLan: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:lan", handler);
      return () => ipcRenderer.removeListener("analyzers:lan", handler);
    },
    onLanClient: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:lanClient", handler);
      return () => ipcRenderer.removeListener("analyzers:lanClient", handler);
    },
    onOpened: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:opened", handler);
      return () => ipcRenderer.removeListener("analyzers:opened", handler);
    },
    onClosed: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:closed", handler);
      return () => ipcRenderer.removeListener("analyzers:closed", handler);
    },
    onError: (callback) => {
      const handler = (_event, payload) => callback(payload);
      ipcRenderer.on("analyzers:error", handler);
      return () => ipcRenderer.removeListener("analyzers:error", handler);
    },
  },
});
