import { createHash } from "node:crypto";
import { PARAM_ORDER } from "../fctv/config.js";

const NUMERIC = new Set(["sportType", "language", "leagueId", "seasonId", "siteType"]);

function coerce(key, value) {
  if (typeof value === "string" && NUMERIC.has(key) && /^\d+$/.test(value)) {
    return Number(value);
  }
  return value;
}

export function orderParams(params) {
  const coerced = {};
  for (const [key, value] of Object.entries(params)) {
    coerced[key] = coerce(key, value);
  }
  const rank = new Map(PARAM_ORDER.map((key, i) => [key, i]));
  const keys = Object.keys(coerced).sort(
    (a, b) => (rank.get(a) ?? -1) - (rank.get(b) ?? -1),
  );
  const ordered = {};
  for (const key of keys) ordered[key] = coerced[key];
  return ordered;
}

export function paramHash6(params) {
  return createHash("md5")
    .update(JSON.stringify(orderParams(params)), "utf8")
    .digest("hex")
    .slice(0, 6);
}
