/* eslint-disable @typescript-eslint/no-require-imports -- Reproducible code/fixture seals; reads repository files only. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { sha, requireGate } = require('./policy.cjs');
function tree(root, folders) {
  const entries = [], walk = directory => {
    for (const item of fs.readdirSync(directory, { withFileTypes: true })) {
      if (item.name === '__pycache__' || item.name === '.DS_Store') continue;
      const file = path.join(directory, item.name); requireGate(!item.isSymbolicLink(), 'SEALED_SOURCE_SYMLINK');
      if (item.isDirectory()) walk(file); else entries.push([path.relative(root, file), sha(fs.readFileSync(file))]);
    }
  };
  for (const folder of folders) walk(path.join(root, folder));
  entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0); return sha(JSON.stringify(entries));
}
function seals(root = path.resolve(__dirname, '../../..')) {
  return { sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), adapterSha256: tree(root, ['tools/migration/hosted-write', 'tools/migration/local-write']), applicationTreeSha256: tree(root, ['src', 'public']), fixtureSha256: sha(['worksheets.json', 'local-write/binary-fixtures.cjs', 'local-write/capacity-workload.cjs'].map(name => sha(fs.readFileSync(path.join(root, 'tools/migration', name)))).join('\n')) };
}
function verifySeals(binding) { const actual = seals(); for (const [key, value] of Object.entries(actual)) requireGate(binding[key] === value, 'CODE_SEAL_' + key.toUpperCase()); return actual; }
module.exports = { seals, verifySeals };
if (require.main === module) console.log(JSON.stringify(seals(), null, 2));
