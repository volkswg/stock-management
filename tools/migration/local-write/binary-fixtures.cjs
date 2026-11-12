/* eslint-disable @typescript-eslint/no-require-imports -- Deterministic private PNG fixtures; no application imports. */
const zlib = require('node:zlib');
function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
}
function chunk(name, data) {
    const type = Buffer.from(name), result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length); type.copy(result, 4); data.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([type, data])), result.length - 4);
    return result;
}
function png(data) {
    const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1); ihdr.writeUInt32BE(1, 4); ihdr[8] = 8; ihdr[9] = 2;
    return Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), chunk('IHDR', ihdr), chunk('wtST', data), chunk('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0]))), chunk('IEND', Buffer.alloc(0))]);
}
// Both ancillary payloads and their valid CRCs decode to eight replacement
// characters. Distinct PNG bytes must still be distinct HTTP operation intents.
function collisionPngPair() {
    const found = [];
    for (let n = 0; n < 65536 && found.length < 2; n++) {
        const data = Buffer.from([0x80 + (n & 63), 0x80 + ((n >>> 6) & 63), 0x80 + ((n >>> 12) & 63), 0x80]);
        const candidate = chunk('wtST', data), crc = candidate.subarray(-4);
        if ([...crc].every(byte => byte >= 0x80 && byte <= 0xbf)) found.push(png(data));
    }
    if (found.length !== 2 || found[0].equals(found[1]) || found[0].toString('utf8') !== found[1].toString('utf8')) throw Error('PNG control construction failed');
    return found;
}
function sizedPng(totalBytes) {
    const overhead = png(Buffer.alloc(0)).length;
    if (!Number.isInteger(totalBytes) || totalBytes < overhead || totalBytes > 20 * 1024 * 1024 + 1) throw Error('Fixture size outside the bounded upload matrix');
    return png(Buffer.alloc(totalBytes - overhead));
}
module.exports = { collisionPngPair, crc32, sizedPng };
