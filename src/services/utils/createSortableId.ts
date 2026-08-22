import { randomBytes } from "node:crypto";

let lastTimestamp = 0;
let sequence = 0;

export function createSortableId(): string {
  const now = Date.now();
  if (now > lastTimestamp) {
    lastTimestamp = now;
    sequence = randomBytes(2).readUInt16BE() & 0x0fff;
  } else {
    sequence += 1;
    if (sequence > 0x0fff) {
      lastTimestamp += 1;
      sequence = 0;
    }
  }

  const bytes = randomBytes(16);
  bytes.writeUIntBE(lastTimestamp, 0, 6);
  bytes[6] = 0x70 | (sequence >> 8);
  bytes[7] = sequence & 0xff;
  bytes[8] = 0x80 | (bytes[8] & 0x3f);

  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
}
