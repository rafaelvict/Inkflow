import { app, BrowserWindow, ipcMain, dialog, session } from "electron";
import path from "node:path";
import { registerIpcHandlers } from "./ipc-handlers";
import { buildMenu } from "./menu";
import { ensureWorkspace } from "./workspace";
import { initUpdater } from "./updater";
import { refreshWorkspacePath } from "./workspace";
import { startWatcher } from "./watcher";

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let forceClose = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    frame: true,
    title: "Inkflow",
    backgroundColor: "#202020",
    show: false,
    icon: path.join(__dirname, "../../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  // --- CSP: prod sem CDN externo, dev permissivo ---
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;
    const csp = isDev
      ? [
          "default-src 'self'",
          "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data: https://esm.sh",
          "img-src 'self' data: blob:",
          "connect-src 'self' ws: wss: https://esm.sh https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudfunctions.net https://*.stripe.com",
        ].join("; ")
      : [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline'",
          "font-src 'self' data:",
          "img-src 'self' data: blob:",
          "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.cloudfunctions.net https://*.stripe.com",
        ].join("; ");

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
      },
    });
  });

  // --- Close guard: save-then-ack, sem setTimeout ---
  mainWindow.on("close", (event) => {
    if (forceClose) return;
    event.preventDefault();

    ipcMain.once(
      "app:can-close-response",
      (_e: Electron.IpcMainEvent, isDirty: boolean) => {
        if (!isDirty) {
          forceClose = true;
          mainWindow?.close();
          return;
        }

        const choice = dialog.showMessageBoxSync(mainWindow!, {
          type: "question",
          buttons: ["Salvar e fechar", "Descartar alterações", "Cancelar"],
          defaultId: 0,
          cancelId: 2,
          title: "Alterações não salvas",
          message: "Há alterações não salvas. O que deseja fazer?",
        });

        if (choice === 0) {
          // Wait for renderer to confirm save completed
          ipcMain.once("app:saved", () => {
            forceClose = true;
            mainWindow?.close();
          });
          mainWindow!.webContents.send("menu-action", "save-note-and-ack");
        } else if (choice === 1) {
          forceClose = true;
          mainWindow?.close();
        }
        // choice 2: cancel — do nothing
      },
    );

    mainWindow!.webContents.send("app:check-before-close");
  });

  // Block navigation to external URLs
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const parsed = new URL(url);
    if (parsed.protocol === "http:" && parsed.hostname !== "localhost") {
      event.preventDefault();
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "file:") {
      event.preventDefault();
    }
  });

  // Show window once content is ready (avoids white flash)
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  // Block popup windows
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  // Load renderer
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }

  return mainWindow;
}

app.whenReady().then(async () => {
  await refreshWorkspacePath(); // load workspace path from store before anything else
  await ensureWorkspace();
  registerIpcHandlers();
  const win = createWindow();
  buildMenu(() => win);
  initUpdater(win);
  startWatcher(win); // fire-and-forget, logs errors internally

  // Handle .note file opened via double-click (Windows argv)
  const fileArg = process.argv.find((arg) => arg.endsWith(".note"));
  if (fileArg) {
    win.webContents.once("did-finish-load", () => {
      win.webContents.send("menu-action", "import-note-file:" + fileArg);
    });
  }
});

app.on("second-instance", (_event, argv) => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();

    // Handle .note file opened when app is already running
    const fileArg = argv.find((arg) => arg.endsWith(".note"));
    if (fileArg) {
      mainWindow.webContents.send("menu-action", "import-note-file:" + fileArg);
    }
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

// Electron Forge Vite plugin injects these globals
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
