import { FctvClient } from "../fctv/client.js";
import { SITE_TYPE } from "../fctv/config.js";
import { parseMatchUrl } from "../fctv/url.js";
import { buildTokenUrl } from "../crypto/token.js";
import { proxyPath } from "./hls-proxy.js";

export async function resolveResponse(pageUrl, origin) {
  if (!pageUrl) return Response.json({ error: "url required" }, { status: 400 });
  try {
    const client = new FctvClient();
    const geo = await client.geo();
    const parsed = await parseMatchUrl(pageUrl, client);
    if (!parsed) throw new Error("Could not parse match page URL");
    const ctx = { referer: parsed.referer, origin: parsed.origin };
    const match = await client.matchDetail(
      { matchId: parsed.matchId, sportType: parsed.sportType },
      ctx,
    );
    const stream = match.stream.find((item) => item.streamId) ?? match.stream[0];
    if (!stream?.streamId) throw new Error("no stream on match");
    const detail = await client.streamDetail(
      {
        streamId: stream.streamId,
        matchId: parsed.matchId,
        sportType: parsed.sportType,
        siteType: stream.siteType ?? SITE_TYPE,
        digit: parsed.digit,
        country: geo.country,
        continent: geo.continent,
      },
      { referer: parsed.streamReferer, origin: new URL(parsed.streamReferer).origin },
    );
    if (!detail.stream.url || !detail.rbSession) {
      throw new Error("stream/detail missing url or rb-session");
    }
    const tokenUrl = buildTokenUrl(detail.stream.url, detail.rbSession);
    const payload = {
      name: stream.name ?? null,
      playableUrl: proxyPath(tokenUrl, parsed.streamReferer, origin),
    };
    return Response.json(payload);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "resolve failed" },
      { status: 502 },
    );
  }
}
