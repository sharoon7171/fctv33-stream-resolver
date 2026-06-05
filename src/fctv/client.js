import { rot47 } from "../crypto/rot47.js";
import { paramHash6, orderParams } from "../crypto/hash.js";
import {
  BS_CODES,
  DATA_API,
  DIGIT,
  SIGN_CODE,
  SIGN_PATH,
  SITE_ORIGIN,
  SITE_TYPE,
} from "../config.js";
import {
  decodeEnvelope,
  decodeKvEntries,
  decodeMatchDetail,
  decodeStreamDetail,
  decodeUserInfo,
} from "./proto.js";

const BASE_HEADERS = {
  Referer: `${SITE_ORIGIN}/`,
  Origin: SITE_ORIGIN,
  Accept: "application/json, text/plain, */*",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};

function headers(ctx) {
  const referer = ctx?.referer ?? BASE_HEADERS.Referer;
  const origin = ctx?.origin ?? ctx?.referer?.replace(/\/$/, "") ?? BASE_HEADERS.Origin;
  return { ...BASE_HEADERS, Referer: referer, Origin: origin };
}

export class FctvClient {
  constructor() {
    this.sigs = new Map();
    this.sigKey = "";
  }

  async fetchConfig() {
    const res = await fetch(`${DATA_API}/api/common/params`, { headers: BASE_HEADERS });
    return JSON.parse(rot47(await res.text()));
  }

  async streamReferer(d, pageReferer) {
    const config = await this.fetchConfig();
    const web = JSON.parse(config["common:web:client"] ?? "{}");
    const host = web[d]?.iframePlayerDomains?.[0];
    if (host) {
      const normalized = host.replace(/^https?:\/\//, "").replace(/\/$/, "");
      return `https://${normalized}/`;
    }
    return pageReferer;
  }

  async geo(ctx) {
    const buf = Buffer.from(await this.get("/api/user/info", ctx));
    return decodeUserInfo(buf);
  }

  async bootSigs(matchId, sportType, ctx) {
    const key = `${matchId}:${sportType}`;
    if (this.sigKey === key && this.sigs.size) return;
    const q = new URLSearchParams();
    q.set("stream", "true");
    q.set("sportType", String(sportType));
    q.set("matchId", matchId);
    for (const code of BS_CODES) q.append("code", String(code));
    const buf = Buffer.from(await this.get(`/api/common/bs?${q}`, ctx));
    const { message, payload } = decodeEnvelope(buf);
    if (message !== "Success") throw new Error(`bs bootstrap failed: ${message}`);
    this.sigs = new Map(
      payload.flatMap((chunk) => decodeKvEntries(chunk)).map((e) => [e.code, e.value]),
    );
    this.sigKey = key;
  }

  async matchDetail(params, ctx) {
    await this.bootSigs(params.matchId, params.sportType, ctx);
    const query = {
      matchId: params.matchId,
      sportType: params.sportType,
      language: 0,
      stream: true,
    };
    const buf = Buffer.from(await this.signed(SIGN_PATH, query, this.sigs, ctx));
    return decodeMatchDetail(buf);
  }

  async streamDetail(params, ctx) {
    const url = new URL(`${DATA_API}/api/stream/detail`);
    url.searchParams.set("streamId", params.streamId);
    url.searchParams.set("matchId", params.matchId);
    url.searchParams.set("sportType", String(params.sportType));
    url.searchParams.set("siteType", String(params.siteType ?? SITE_TYPE));
    url.searchParams.set("digit", params.digit ?? DIGIT);
    if (params.continent) url.searchParams.set("continent", params.continent);
    if (params.country) url.searchParams.set("country", params.country);
    const res = await fetch(url, { headers: headers(ctx) });
    const buf = Buffer.from(await res.arrayBuffer());
    const envelope = decodeEnvelope(buf);
    if (envelope.message !== "Success") {
      throw new Error(`stream detail failed: ${envelope.message}`);
    }
    return {
      stream: decodeStreamDetail(buf),
      rbSession: res.headers.get("rb-session") ?? undefined,
    };
  }

  async get(path, ctx) {
    const res = await fetch(`${DATA_API}${path}`, { headers: headers(ctx) });
    return res.arrayBuffer();
  }

  async signed(path, params, sigs, ctx) {
    const suffix = sigs.get(SIGN_CODE);
    if (!suffix) throw new Error(`missing body signature for ${path}`);
    const q = new URLSearchParams();
    for (const [key, value] of Object.entries(orderParams(params))) {
      q.set(key, String(value));
    }
    const url = `${DATA_API}/sfver${paramHash6(params)}${suffix}${path}?${q}`;
    const res = await fetch(url, { headers: headers(ctx) });
    return res.arrayBuffer();
  }
}
