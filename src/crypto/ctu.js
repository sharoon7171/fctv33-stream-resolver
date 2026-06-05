const ROT13 = 13;

function rot13(input) {
  return input.replace(/[a-zA-Z]/g, (char) => {
    const base = char <= "Z" ? 65 : 97;
    return String.fromCharCode(((char.charCodeAt(0) - base + ROT13) % 26) + base);
  });
}

function decodeParam(value) {
  if (!value) return "";
  const sliced = decodeURIComponent(value.slice(8));
  return Buffer.from(rot13(sliced), "base64").toString("utf8");
}

function parseHost(ctump) {
  for (const entry of ctump.split(",")) {
    const at = entry.indexOf("@");
    if (at >= 0) return entry.slice(at + 1);
  }
  return null;
}

export function buildCtuUrl(segmentUrl) {
  let parsed;
  try {
    parsed = new URL(segmentUrl);
  } catch {
    return null;
  }
  const ctump = decodeParam(parsed.searchParams.get("_ctump"));
  const ctuph = decodeParam(parsed.searchParams.get("_ctuph"));
  const host = parseHost(ctump);
  if (!host || !ctuph) return null;
  return `https://${host}${ctuph}`;
}

export function hasCtuParams(url) {
  try {
    const parsed = new URL(url);
    return parsed.searchParams.has("_ctump") && parsed.searchParams.has("_ctuph");
  } catch {
    return false;
  }
}
