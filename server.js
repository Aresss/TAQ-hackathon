const fs = require("fs");
const path = require("path");
const http = require("http");
const { URL } = require("url");

const PORT = 8080;
const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, "logs");
const LOG_FILE = path.join(LOG_DIR, "wallet-checks.log");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".rtf": "application/rtf",
  ".txt": "text/plain; charset=utf-8"
};

fs.mkdirSync(LOG_DIR, { recursive: true });

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, { "Content-Type": contentType });
  res.end(body);
}

function safePathname(pathname) {
  const target = pathname === "/" ? "/index.html" : pathname;
  const normalized = path.normalize(target).replace(/^(\.\.[/\\])+/, "");
  return path.join(ROOT, normalized);
}

function serveStatic(req, res, pathname) {
  const filePath = safePathname(pathname);
  if (!filePath.startsWith(ROOT)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      send(res, 404, "Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || "application/octet-stream");
  });
}

function appendLog(req, res) {
  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
    if (body.length > 1024 * 1024) {
      req.socket.destroy();
    }
  });

  req.on("end", () => {
    try {
      const parsed = JSON.parse(body || "{}");
      const line = `${JSON.stringify(parsed)}\n`;
      fs.appendFileSync(LOG_FILE, line, "utf8");
      send(res, 200, JSON.stringify({ ok: true }), MIME[".json"]);
    } catch (_err) {
      send(res, 400, JSON.stringify({ ok: false, error: "Invalid JSON" }), MIME[".json"]);
    }
  });
}

function readLogs(_req, res) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      send(res, 200, "", MIME[".txt"]);
      return;
    }
    const content = fs.readFileSync(LOG_FILE, "utf8");
    send(res, 200, content, MIME[".txt"]);
  } catch (_err) {
    send(res, 500, "Failed to read logs");
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (req.method === "POST" && pathname === "/api/log-check") {
    appendLog(req, res);
    return;
  }

  if (req.method === "GET" && pathname === "/api/logs") {
    readLogs(req, res);
    return;
  }

  if (req.method === "GET") {
    serveStatic(req, res, pathname);
    return;
  }

  send(res, 405, "Method Not Allowed");
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running at http://localhost:${PORT}`);
  // eslint-disable-next-line no-console
  console.log(`Wallet check logs: ${LOG_FILE}`);
});
