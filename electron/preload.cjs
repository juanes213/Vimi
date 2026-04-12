"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  platform: process.platform,

  getAutoStart: () => ipcRenderer.invoke("get-auto-start"),
  setAutoStart: (enabled) => ipcRenderer.invoke("set-auto-start", enabled),

  hideWindow: () => ipcRenderer.invoke("hide-window"),

  // Open a URL in the system browser (for Google OAuth, etc.)
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
});
