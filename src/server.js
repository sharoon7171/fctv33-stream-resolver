import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { hlsProxy } from "./hls.js";
import { resolveResponse } from "./resolve.js";

const webDir = join(process.cwd(), "public");

export async function route(request) {
  const url = new URL(request.url);
  if (url.pathname === "/api/hls") return hlsProxy(request);
  if (url.pathname === "/api/resolve-link") {
    return resolveResponse(url.searchParams.get("url") ?? "", url.origin);
  }
  return Response.json({ error: "not found" }, { status: 404 });
}

async function serveStatic(pathname) {
  const relative = pathname === "/" ? "index.html" : pathname.slice(1);
  const filePath = join(webDir, relative);
  try {
    const data = await readFile(filePath);
    const ext = extname(filePath);
    const type =
      ext === ".html" ? "text/html" : ext === ".js" ? "text/javascript" : "application/octet-stream";
    return new Response(data, { headers: { "Content-Type": type } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

export function listen(port = 8787) {
  createServer(async (incoming, outgoing) => {
    const host = incoming.headers.host ?? `localhost:${port}`;
    const request = new Request(`http://${host}${incoming.url ?? "/"}`, {
      method: incoming.method,
      headers: incoming.headers,
    });
    const url = new URL(request.url);
    const response = url.pathname.startsWith("/api/")
      ? await route(request)
      : await serveStatic(url.pathname);
    outgoing.statusCode = response.status;
    response.headers.forEach((value, key) => outgoing.setHeader(key, value));
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  }).listen(port, () => {
    console.log(`http://localhost:${port}`);
  });
}

export default async function vercel(req, res) {
  try {
    const origin = `https://${req.headers.host ?? "localhost"}`;
    const parsed = new URL(req.url ?? "/", origin);
    const request = new Request(parsed.toString(), {
      method: req.method,
      headers: req.headers,
    });
    const response = await route(request);
    const body = Buffer.from(await response.arrayBuffer());
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.send(body);
  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : "request failed",
    });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  listen(Number(process.env.PORT ?? "8787"));
}
