/**
 * Minimal static file server for running browser tests locally.
 *
 * Usage: node test/browser/server.mjs
 * Then open http://localhost:8765/test/browser/test-runner.html
 *
 * ES modules (like the SDK) require HTTP serving — file:// won't work.
 */

import http from "node:http";
import fs from "node:fs";
import path from "node:path";

const PORT = 8765;
const ROOT = path.resolve(process.cwd());

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".map": "application/json; charset=utf-8",
};

const server = http.createServer((req, res) => {
  const safe = path.normalize(req.url.replace(/\?.*$/, "")).replace(/^(\.\.[\/\\])+/, "");
  const filePath = path.join(ROOT, safe);

  // Security: only serve files within project root
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === "ENOENT") {
        res.writeHead(404);
        res.end("Not Found: " + safe);
      } else if (err.code === "EISDIR") {
        // Try index.html
        const idx = path.join(filePath, "index.html");
        fs.readFile(idx, (e2, d2) => {
          if (e2) {
            res.writeHead(404);
            res.end("Not Found");
          } else {
            res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
            res.end(d2);
          }
        });
      } else {
        res.writeHead(500);
        res.end("Internal Error");
        console.error(err);
      }
    } else {
      res.writeHead(200, {
        "Content-Type": mime,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(data);
    }
  });
});

server.listen(PORT, () => {
  console.log(`🧪 Event Chronicle Browser Test Server`);
  console.log(`   http://localhost:${PORT}/test/browser/test-runner.html`);
  console.log(`   Press Ctrl+C to stop.`);
});
