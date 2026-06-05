export function rot47(input) {
  return [...input]
    .map((char) => {
      const code = char.charCodeAt(0);
      if (code >= 0x21 && code <= 0x4f) return String.fromCharCode(code + 0x2f);
      if (code >= 0x50 && code <= 0x7e) return String.fromCharCode(code - 0x2f);
      return char;
    })
    .join("");
}
