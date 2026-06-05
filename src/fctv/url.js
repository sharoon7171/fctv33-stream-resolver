import { SPORTS } from "./config.js";

const LOCALES = new Set(["en", "zh", "th", "vi", "id", "pt", "es", "tr", "ru", "ko", "ja"]);

function decodeMdata(raw) {
  try {
    const normalized = decodeURIComponent(raw).replace(/\s/g, "");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const plain = Buffer.from(padded, "base64").toString("utf8");
    const [matchId, sportType] = plain.split("_");
    if (!matchId || !sportType || !/^\d+$/.test(matchId)) return null;
    return { matchId, sportType: Number(sportType) };
  } catch {
    return null;
  }
}

function siteDigit(host) {
  return host.toLowerCase().includes("fctv33") ? "foth" : "seth";
}

function parsePath(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  let i = 0;
  if (parts[i] && LOCALES.has(parts[i])) i += 1;
  const sportSlug = parts[i];
  if (!sportSlug) return null;
  const sportType = SPORTS[sportSlug];
  if (sportType === undefined || sportType === 0) return null;
  const segment = parts[i + 1];
  if (!segment?.includes("-")) return null;
  const matchId = segment.slice(segment.lastIndexOf("-") + 1);
  if (!/^\d+$/.test(matchId)) return null;
  const referer = `${url.origin}/`;
  const mdata = url.searchParams.get("mdata");
  if (mdata) {
    const fromMdata = decodeMdata(mdata);
    if (fromMdata) {
      return {
        matchId: fromMdata.matchId,
        sportType: fromMdata.sportType,
        digit: siteDigit(url.hostname),
        referer,
        origin: url.origin,
      };
    }
  }
  return {
    matchId,
    sportType,
    digit: siteDigit(url.hostname),
    referer,
    origin: url.origin,
  };
}

export async function parseMatchUrl(input, client) {
  const parsed = parsePath(input);
  if (!parsed) return null;
  const streamReferer = await client.streamReferer(parsed.digit, parsed.referer);
  return { ...parsed, streamReferer };
}
