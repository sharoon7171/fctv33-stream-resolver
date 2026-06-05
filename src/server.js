import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { route } from "./routes/index.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const webDir = join(root, "public");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
};

async function serveStatic(pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  try {
    const data = await readFile(join(webDir, relative));
    const type = MIME[extname(relative)] ?? "application/octet-stream";
    return new Response(data, { headers: { "Content-Type": type } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function handle(request) {
  const url = new URL(request.url);
  return url.pathname.startsWith("/api/") ? route(request) : serveStatic(url.pathname);
}

export function listen(port = 8787) {
  createServer(async (incoming, outgoing) => {
    const host = incoming.headers.host ?? `localhost:${port}`;
    const request = new Request(`http://${host}${incoming.url ?? "/"}`, {
      method: incoming.method,
      headers: incoming.headers,
    });
    const response = await handle(request);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port, () => {
    console.log(`http://localhost:${port}`);
  });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  listen(Number(process.env.PORT ?? "8787"));
}
