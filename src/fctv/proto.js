function readVarint(buffer, offset) {
  let value = 0;
  let shift = 0;
  let index = offset;
  while (index < buffer.length) {
    const byte = buffer[index++];
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [value, index];
}

function readLengthDelimited(buffer, offset) {
  const [length, start] = readVarint(buffer, offset);
  return [buffer.subarray(start, start + length), start + length];
}

function readString(buffer, offset) {
  const [chunk, next] = readLengthDelimited(buffer, offset);
  return [chunk.toString("utf8"), next];
}

function readFields(buffer) {
  const fields = new Map();
  let offset = 0;
  while (offset < buffer.length) {
    const [tag, next] = readVarint(buffer, offset);
    offset = next;
    const field = tag >> 3;
    const wire = tag & 0x7;
    if (wire === 0) {
      const [value, after] = readVarint(buffer, offset);
      offset = after;
      const varintBuffer = Buffer.allocUnsafe(8);
      let size = 0;
      let temp = value;
      while (temp >= 0x80) {
        varintBuffer[size++] = (temp & 0x7f) | 0x80;
        temp >>>= 7;
      }
      varintBuffer[size++] = temp;
      const chunk = varintBuffer.subarray(0, size);
      const list = fields.get(field) ?? [];
      list.push(chunk);
      fields.set(field, list);
      continue;
    }
    if (wire !== 2) break;
    const [chunk, after] = readLengthDelimited(buffer, offset);
    offset = after;
    const list = fields.get(field) ?? [];
    list.push(chunk);
    fields.set(field, list);
  }
  return fields;
}

export function decodeEnvelope(buffer) {
  const fields = readFields(buffer);
  return {
    message: fields.get(3)?.[0]?.toString("utf8") ?? "",
    payload: fields.get(10) ?? [],
  };
}

export function decodeKvEntries(buffer) {
  const entries = [];
  let offset = 0;
  while (offset < buffer.length) {
    const [tag, next] = readVarint(buffer, offset);
    offset = next;
    if ((tag & 0x7) !== 2) continue;
    const [chunk, after] = readLengthDelimited(buffer, offset);
    offset = after;
    let code = 0;
    let value = "";
    let inner = 0;
    while (inner < chunk.length) {
      const [innerTag, innerNext] = readVarint(chunk, inner);
      inner = innerNext;
      const innerField = innerTag >> 3;
      const innerWire = innerTag & 0x7;
      if (innerWire === 0) {
        const [num, numNext] = readVarint(chunk, inner);
        inner = numNext;
        if (innerField === 1) code = num;
        continue;
      }
      if (innerWire === 2) {
        const [text, textNext] = readString(chunk, inner);
        inner = textNext;
        if (innerField === 2) value = text;
      }
    }
    if (code) entries.push({ code, value });
  }
  return entries;
}

export function decodeUserInfo(buffer) {
  const { payload } = decodeEnvelope(buffer);
  if (!payload[0]) return {};
  const fields = readFields(payload[0]);
  return {
    country: fields.get(2)?.[0]?.toString("utf8"),
    continent: fields.get(3)?.[0]?.toString("utf8"),
  };
}

function readVarintField(buffer) {
  if (!buffer) return undefined;
  return readVarint(buffer, 0)[0];
}

function decodeStreamItem(buffer) {
  const fields = readFields(buffer);
  const streamIdChunk = fields.get(1)?.[0];
  const streamId =
    streamIdChunk && streamIdChunk.length <= 8
      ? String(readVarint(streamIdChunk, 0)[0])
      : streamIdChunk?.toString("utf8");
  return {
    streamId,
    url: fields.get(4)?.[0]?.toString("utf8"),
    name: fields.get(3)?.[0]?.toString("utf8"),
    siteType: readVarintField(fields.get(9)?.[0]),
  };
}

export function decodeMatchDetail(buffer) {
  const { payload } = decodeEnvelope(buffer);
  if (!payload[0]) return { stream: [] };
  const root = readFields(payload[0]);
  return { stream: (root.get(2) ?? []).map(decodeStreamItem) };
}

export function decodeStreamDetail(buffer) {
  const { payload } = decodeEnvelope(buffer);
  if (!payload[0]) return {};
  const fields = readFields(payload[0]);
  const streamBuffer = fields.get(2)?.[0] ?? fields.get(1)?.[0] ?? payload[0];
  return decodeStreamItem(streamBuffer);
}
