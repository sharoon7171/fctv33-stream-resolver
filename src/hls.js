import { buildCtuUrl, hasCtuParams } from "./crypto/ctu.js";

const CORS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Access-Control-Allow-Origin": "*",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

function cdnHeaders(referer) {
  return { "User-Agent": UA, Referer: referer, Origin: referer.replace(/\/$/, "") };
}

function stripSegment(input) {
  const buf = input instanceof Buffer ? input : Buffer.from(new Uint8Array(input));
  if (buf.length < 4 || buf[0] === 0x47) return new Uint8Array(buf);
  if (buf[0] !== 0x89 || buf[1] !== 0x50 || buf[2] !== 0x4e || buf[3] !== 0x47) {
    return new Uint8Array(buf);
  }
  const iend = buf.indexOf(Buffer.from("IEND"));
  if (iend >= 0 && iend + 8 < buf.length) return new Uint8Array(buf.subarray(iend + 8));
  for (let i = 0; i < Math.min(buf.length, 65536); i++) {
    if (buf[i] === 0x47 && i + 188 < buf.length && buf[i + 188] === 0x47) {
      return new Uint8Array(buf.subarray(i));
    }
  }
  return new Uint8Array(buf);
}

async function fetchUpstream(url, referer) {
  const target = hasCtuParams(url) ? buildCtuUrl(url) ?? url : url;
  const res = await fetch(target, { headers: cdnHeaders(referer), redirect: "follow" });
  const body = Buffer.from(await res.arrayBuffer());
  const head = body.subarray(0, Math.min(body.length, 200)).toString("utf8").toLowerCase();
  if (res.status >= 200 && res.status < 300 && body.length && !head.includes("<html")) {
    return body;
  }
  throw new Error(`upstream ${res.status}`);
}

export function proxyPath(m3u8Url, streamReferer, origin) {
  const params = new URLSearchParams({ url: m3u8Url, referer: streamReferer });
  const path = `/api/hls?${params}`;
  return origin ? `${origin.replace(/\/$/, "")}${path}` : path;
}

function rewriteManifest(body, target, referer, origin) {
  const base = new URL(target);
  return body
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      return proxyPath(new URL(trimmed, base).href, referer, origin);
    })
    .join("\n");
}

function isPlaylist(body, target) {
  const head = body.subarray(0, Math.min(body.length, 256)).toString("utf8");
  return head.includes("#EXTM3U") || target.includes(".m3u8");
}

function segmentPayload(body) {
  const stripped = stripSegment(body);
  if (stripped.length >= 188 && stripped[0] === 0x47) return Buffer.from(stripped);
  throw new Error("invalid segment payload");
}

export async function hlsProxy(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get("url");
  const referer = url.searchParams.get("referer");
  if (!target || !referer) {
    return Response.json({ error: "url and referer required" }, { status: 400 });
  }
  const origin = url.origin;
  try {
    const body = await fetchUpstream(target, referer);
    if (isPlaylist(body, target)) {
      const text = body.toString("utf8");
      const manifest = text.startsWith("#EXTM3U")
        ? rewriteManifest(text, target, referer, origin)
        : text;
      return new Response(manifest, {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/vnd.apple.mpegurl" },
      });
    }
    return new Response(new Uint8Array(segmentPayload(body)), {
      status: 200,
      headers: { ...CORS, "Content-Type": "video/mp2t" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "upstream failed";
    return new Response(message, { status: 502, headers: CORS });
  }
}
