import assert from 'node:assert/strict';
import {readEvidence as readFileSync} from "./retirement-history.mjs";
import { createHash } from 'node:crypto';
export const userStateBefore = JSON.parse(readFileSync('tests/fixtures/user-state-worksheet-before.json', 'utf8'));
export const userStateFiles = new Set(Object.keys(userStateBefore.moves));
export const userStateDestinations = Object.values(userStateBefore.moves).map(e => e.to);
export const userStateHash = value => createHash('sha256').update(value).digest('hex');
export function userStateFuture() {
  return Object.fromEntries(Object.entries(userStateBefore.moves).flatMap(([file, e]) => {
    let source = e.source;
    for (const [from, to] of Object.entries(e.imports)) source = source.replace(`"${from}"`, `"${to}"`);
    return [[file, `export { ${e.export} } from "@/${e.to.slice(4, -3)}";\n`], [e.to, source]];
  }));
}
export function assertUserStateHistory(file, expected) {
  const e = userStateBefore.moves[file];
  assert.ok(e, file); assert.equal(e.sha256, expected); assert.equal(userStateHash(e.source), expected);
  let restored = readFileSync(e.to, 'utf8');
  for (const [from, to] of Object.entries(e.imports)) {
    assert.equal(restored.split(`"${to}"`).length - 1, 1, file);
    restored = restored.replace(`"${to}"`, `"${from}"`);
  }
  assert.equal(restored, e.source, file);
  assert.equal(readFileSync(file, 'utf8'), `export { ${e.export} } from "@/${e.to.slice(4, -3)}";\n`);
}
