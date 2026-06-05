import { createCipheriv } from "node:crypto";
import { rot47 } from "./rot47.js";

const AES_KEY = Buffer.from("a7981cc9eb2f4d19dcfea57b101ecd89", "utf8");
const AES_IV = Buffer.from("8017d3a8f1400d2f", "utf8");

export function buildTokenUrl(obfuscatedUrl, rbSession) {
  const decoded = rot47(obfuscatedUrl).slice(8);
  const parsed = new URL(decoded);
  const cipher = createCipheriv("aes-256-cbc", AES_KEY, AES_IV);
  const encrypted = Buffer.concat([cipher.update(rbSession, "utf8"), cipher.final()]);
  const token = `${encodeURIComponent(encrypted.toString("base64"))}a`;
  return `${parsed.origin}/token-${token}${parsed.pathname}${parsed.search}`;
}
