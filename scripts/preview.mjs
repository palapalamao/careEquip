import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = path.resolve(
  fileURLToPath(new URL("../res/web/dm/", import.meta.url)),
);
const prefix = "/pod/deviceManager/res/web/dm/";
http
  .createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname === "/") {
      res.writeHead(302, { Location: prefix + "index.html" });
      res.end();
      return;
    }
    if (!url.pathname.startsWith(prefix)) {
      res.writeHead(404);
      res.end();
      return;
    }
    const target = path.resolve(
      root,
      decodeURIComponent(url.pathname.slice(prefix.length) || "index.html"),
    );
    if (
      !target.startsWith(root + path.sep) &&
      target !== path.join(root, "index.html")
    ) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const data = await readFile(target);
      res.writeHead(200, {
        "Content-Type":
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
          }[path.extname(target)] || "application/octet-stream",
        "Cache-Control": "no-store",
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end();
    }
  })
  .listen(8094, "127.0.0.1", () =>
    process.stdout.write("Device Manager preview: http://127.0.0.1:8094\n"),
  );
