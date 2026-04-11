const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const net = require("net");

let mainWindow;
let nextProcess;
let port = 3000;

function findFreePort(startPort) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
    server.on("error", () => resolve(findFreePort(startPort + 1)));
  });
}

function waitForServer(url, retries = 60) {
  return new Promise((resolve, reject) => {
    const check = (n) => {
      const http = require("http");
      http.get(url, (res) => {
        resolve(true);
      }).on("error", () => {
        if (n <= 0) return reject(new Error("Server did not start"));
        setTimeout(() => check(n - 1), 500);
      });
    };
    check(retries);
  });
}

async function startNextServer() {
  port = await findFreePort(3000);

  const isDev = !app.isPackaged;
  const appDir = isDev ? __dirname.replace(/\/electron$/, "") : path.join(process.resourcesPath, "app");

  if (isDev) {
    nextProcess = spawn("npx", ["next", "start", "-p", String(port)], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port) },
      stdio: "pipe",
      shell: true,
    });
  } else {
    nextProcess = spawn("node", [path.join(appDir, ".next/standalone/server.js")], {
      cwd: appDir,
      env: { ...process.env, PORT: String(port) },
      stdio: "pipe",
    });
  }

  nextProcess.stdout?.on("data", (d) => console.log("[next]", d.toString()));
  nextProcess.stderr?.on("data", (d) => console.error("[next]", d.toString()));

  await waitForServer(`http://localhost:${port}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: "Coach Platform",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://localhost:${port}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await startNextServer();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess && !nextProcess.killed) {
    nextProcess.kill();
  }
});
