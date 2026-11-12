/* eslint-disable @typescript-eslint/no-require-imports -- Independent fixture integrity control. */
const test = require('node:test'), assert = require('node:assert/strict'), zlib = require('node:zlib'), crypto = require('node:crypto');
const { collisionPngPair, crc32 } = require('./binary-fixtures.cjs');
test('distinct valid PNGs with identical decoded text retain distinct byte hashes', () => {
    const pair = collisionPngPair();
    for (const image of pair) {
        assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
        const types = [];
        for (let pos = 8; pos < image.length;) {
            const length = image.readUInt32BE(pos), name = image.subarray(pos + 4, pos + 8).toString(), body = image.subarray(pos + 8, pos + 8 + length);
            assert.equal(crc32(image.subarray(pos + 4, pos + 8 + length)), image.readUInt32BE(pos + 8 + length));
            if (name === 'IDAT') assert.deepEqual(zlib.inflateSync(body), Buffer.from([0, 255, 0, 0]));
            types.push(name); pos += length + 12;
        }
        assert.deepEqual(types, ['IHDR', 'wtST', 'IDAT', 'IEND']);
    }
    assert.equal(pair[0].toString('utf8'), pair[1].toString('utf8'));
    assert.notEqual(crypto.createHash('sha256').update(pair[0]).digest('hex'), crypto.createHash('sha256').update(pair[1]).digest('hex'));
});
