import { hlsProxy } from "./hls-proxy.js";
import { resolveResponse } from "./resolve-link.js";

export async function route(request) {
  const url = new URL(request.url);
  if (url.pathname === "/api/hls") return hlsProxy(request);
  if (url.pathname === "/api/resolve-link") {
    return resolveResponse(url.searchParams.get("url") ?? "", url.origin);
  }
  return Response.json({ error: "not found" }, { status: 404 });
}
