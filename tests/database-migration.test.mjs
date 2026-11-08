import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('database migration offline validation, precision, identity and reconciliation suite', () => {
  const result = spawnSync('python3', ['-m', 'unittest', 'discover', '-s', 'tools/migration', '-p', 'test_*.py', '-v'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test('migration catalog matches every canonical worksheet header in order', () => {
  const catalog = JSON.parse(readFileSync('tools/migration/worksheets.json', 'utf8'));
  assert.equal(Object.keys(catalog).length, 23);
  for (const [table, spec] of Object.entries(catalog)) {
    const source = readFileSync(spec.source, 'utf8');
    const arrays = [...source.matchAll(/export const \w+ = \[([\s\S]*?)\]/g)].map(match => [...match[1].replace(/\/\/[^\n]*/g, '').matchAll(/"([^"\n]+)"/g)].map(cell => cell[1]));
    assert.ok(arrays.some(headers => JSON.stringify(headers) === JSON.stringify(spec.headers)), table);
  }
});
