import { app, BrowserWindow, Menu, shell, dialog } from "electron";
import { join } from "node:path";
import { startServer } from "./server";
import { publicUrl } from "./network";

app.setName("Reedar");
let runtime: Awaited<ReturnType<typeof startServer>> | undefined;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => {
    const window = BrowserWindow.getAllWindows()[0];
    if (window?.isMinimized()) window.restore();
    window?.focus();
  });
  void app.whenReady().then(async () => {
    runtime = await startServer({ dataDirectory: join(app.getPath("appData"), "Reedar"), staticDirectory: join(app.getAppPath(), "dist", "web") });
    const window = new BrowserWindow({
      title: "Reedar", width: 1380, height: 900, minWidth: 920, minHeight: 620,
      backgroundColor: "#1b1c21", titleBarStyle: "hiddenInset", trafficLightPosition: { x: 18, y: 18 },
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true },
    });
    window.webContents.setWindowOpenHandler(({ url }) => {
      try { void shell.openExternal(publicUrl(url).href); } catch { /* Never open non-web schemes. */ }
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      if (runtime && new URL(url).origin === runtime.origin) return;
      event.preventDefault();
      try { void shell.openExternal(publicUrl(url).href); } catch { /* Keep untrusted schemes out of the host. */ }
    });
    window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { label: "Reedar", submenu: [{ role: "about" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { type: "separator" }, { role: "quit" }] },
      { label: "編集", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
      { label: "表示", submenu: [{ role: "reload" }, { role: "togglefullscreen" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }] },
      { label: "ウィンドウ", submenu: [{ role: "minimize" }, { role: "zoom" }] },
    ]));
    await window.loadURL(runtime.url);
  }).catch((error: unknown) => {
    dialog.showErrorBox("Reedarを起動できませんでした", error instanceof Error ? error.message : "起動エラー");
    app.quit();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (!runtime || quitting) return;
    event.preventDefault(); quitting = true;
    void runtime.close().finally(() => app.quit());
  });
}
