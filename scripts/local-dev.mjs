/**
 * Local UI + real compiler proxy.
 * Serves frontend/examples and routes /api/* through api/compile + api/status
 * (same handlers as Vercel), using COMPILER_BASE_URL from .env.
 */
import http from "node:http";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

function loadEnvFile(filename) {
  const filePath = path.join(root, filename);
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local");

const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".lua", "text/plain; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
]);

const compileHandler = (
  await import(pathToFileURL(path.join(root, "api/compile.js")).href)
).default;
const statusHandler = (
  await import(pathToFileURL(path.join(root, "api/status/[id].js")).href)
).default;

function compilerHostLabel() {
  try {
    return new URL(process.env.COMPILER_BASE_URL || "").host || "(unset)";
  } catch {
    return "(invalid COMPILER_BASE_URL)";
  }
}

async function serveStatic(pathname, res) {
  let relative = pathname;
  if (relative === "/") relative = "/frontend/index.html";
  else if (relative === "/frontend" || relative === "/frontend/") {
    relative = "/frontend/index.html";
  } else if (
    !relative.startsWith("/frontend/") &&
    !relative.startsWith("/examples/") &&
    !relative.startsWith("/api/")
  ) {
    relative = `/frontend${relative}`;
  }

  const filePath = path.resolve(root, `.${relative}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) {
    res.writeHead(400).end("Bad path");
    return;
  }
  const info = await stat(filePath);
  if (!info.isFile()) {
    res.writeHead(404).end("Not found");
    return;
  }
  const contents = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type":
      contentTypes.get(path.extname(filePath)) || "application/octet-stream",
    "Cache-Control": "no-store",
  });
  res.end(contents);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  try {
    if (url.pathname === "/api/compile") {
      console.log(
        `[compile] ${req.method} → proxy ${compilerHostLabel()}`,
      );
      await compileHandler(req, res);
      return;
    }
    const statusMatch = url.pathname.match(/^\/api\/status\/([^/]+)$/);
    if (statusMatch) {
      req.query = { id: decodeURIComponent(statusMatch[1]) };
      console.log(`[status] ${req.method} ${req.query.id}`);
      await statusHandler(req, res);
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405).end("Method not allowed");
      return;
    }
    await serveStatic(decodeURIComponent(url.pathname), res);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      res.end(
        JSON.stringify({
          error: error.message || "Local dev server error",
        }),
      );
    }
  }
});

server.listen(port, host, () => {
  console.log(`Local server: http://${host}:${port}/`);
  console.log(`Execute Final JSON: http://${host}:${port}/#execute-final`);
  console.log(`Compiler proxy: ${compilerHostLabel()}`);
  if (!process.env.COMPILER_BASE_URL) {
    console.warn("WARNING: COMPILER_BASE_URL is not set in .env");
  }
});
