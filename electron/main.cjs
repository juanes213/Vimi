"use strict";

const { app, BrowserWindow, Tray, Menu, globalShortcut, ipcMain, shell, nativeImage, session } = require("electron");
const path = require("path");
const fs = require("fs");

// ── Simple JSON settings store (no external deps) ─────────────────────────────

function createStore() {
  let settingsPath = null;

  function load() {
    try {
      return JSON.parse(fs.readFileSync(settingsPath, "utf8"));
    } catch {
      return {};
    }
  }

  function save(data) {
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("[store] save failed", e);
    }
  }

  return {
    init() {
      settingsPath = path.join(app.getPath("userData"), "vimi-settings.json");
    },
    get(key, fallback) {
      const data = load();
      return key in data ? data[key] : fallback;
    },
    set(key, value) {
      const data = load();
      data[key] = value;
      save(data);
    },
  };
}

const store = createStore();
const isDev = process.env.NODE_ENV === "development";
const ICON_PATH = path.join(__dirname, "icons", "icon.ico");

let win = null;
let tray = null;
let isQuitting = false;

// ── Window ────────────────────────────────────────────────────────────────────

function createWindow() {
  const icon = nativeImage.createFromPath(ICON_PATH);

  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    icon: icon.isEmpty() ? undefined : icon,
    title: "Vimi",
    backgroundColor: "#0d0b1a",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // required for mic/audio permissions on some Windows configs
    },
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Hide instead of close — keeps the app alive in the tray
  win.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });
}

// ── Tray ──────────────────────────────────────────────────────────────────────

function createTray() {
  const icon = nativeImage.createFromPath(ICON_PATH);
  const trayIcon = icon.isEmpty() ? nativeImage.createEmpty() : icon;

  if (tray) {
    tray.destroy();
  }
  tray = new Tray(trayIcon);
  tray.setToolTip("Vimi");

  const menu = Menu.buildFromTemplate([
    {
      label: "Open Vimi",
      click: () => {
        win.show();
        win.focus();
      },
    },
    { type: "separator" },
    {
      label: "Start with Windows",
      type: "checkbox",
      checked: store.get("autoStart", false),
      click: (item) => {
        const enabled = item.checked;
        store.set("autoStart", enabled);
        if (app.isPackaged) {
          app.setLoginItemSettings({ openAtLogin: enabled });
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit Vimi",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(menu);
  tray.on("double-click", () => {
    win.show();
    win.focus();
  });
}

// ── CSP & permissions ─────────────────────────────────────────────────────────

function setupSession() {
  // Auto-approve mic/audio permission requests
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = ["media", "audioCapture", "microphone"].includes(permission);
    callback(allowed);
  });

  // Set permissive CSP that allows Convex + ElevenLabs
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          [
            "default-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "connect-src 'self' https://*.convex.cloud https://*.convex.site wss://*.convex.cloud wss://*.convex.site https://api.elevenlabs.io wss://api.elevenlabs.io https://api.openai.com https://*.googleapis.com",
            "media-src 'self' blob: data:",
            "img-src 'self' data: blob: https:",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
            "style-src 'self' 'unsafe-inline'",
          ].join("; "),
        ],
      },
    });
  });
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function setupIPC() {
  ipcMain.handle("get-auto-start", () => {
    return store.get("autoStart", false);
  });

  ipcMain.handle("set-auto-start", (_event, enabled) => {
    store.set("autoStart", enabled);
    if (app.isPackaged) {
      app.setLoginItemSettings({ openAtLogin: enabled });
    }
    // Refresh tray menu checkbox
    createTray();
  });

  ipcMain.handle("hide-window", () => {
    win?.hide();
  });

  ipcMain.handle("open-external", (_event, url) => {
    void shell.openExternal(url);
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.setAppUserModelId("com.vimi.app");

app.whenReady().then(() => {
  store.init();
  setupSession();
  createWindow();
  createTray();
  setupIPC();

  // Global hotkey: Ctrl+Shift+Space → toggle window
  globalShortcut.register("CommandOrControl+Shift+Space", () => {
    if (win.isVisible() && win.isFocused()) {
      win.hide();
    } else {
      win.show();
      win.focus();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});

app.on("before-quit", () => {
  isQuitting = true;
});

// On Windows, closing all windows should not quit the app (it lives in tray)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !isQuitting) {
    // keep running in tray
  } else {
    app.quit();
  }
});
