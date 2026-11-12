/* eslint-disable @typescript-eslint/no-require-imports -- Attested private copy only. No source edits or deployment commands. */
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const { sha, requireGate } = require('./policy.cjs');
const hash = file => sha(fs.readFileSync(file));
function prepare(source, destination) {
  source = fs.realpathSync(source); destination = path.resolve(destination);
  requireGate(!fs.existsSync(destination) && destination !== source, 'NEW_PRIVATE_BUILD_REQUIRED');
  fs.mkdirSync(destination, { mode: 0o700 });
  for (const name of ['src', 'public', 'package.json', 'yarn.lock', 'tsconfig.json', 'next.config.ts']) fs.cpSync(path.join(source, name), path.join(destination, name), { recursive: true });
  const entry = 'src/instrumentation.ts', factory = 'src/infrastructure/files/google-drive/createGoogleDriveServiceFromConfig.ts';
  const expected = 'import "server-only";\nexport async function register() {\n  if (process.env.NEXT_RUNTIME === "nodejs") {\n    const { installReadOnlyProviderGuard } = await import("./infrastructure/runtime/staging-read-only");\n    installReadOnlyProviderGuard();\n  }\n}\n';
  requireGate(fs.readFileSync(path.join(source, entry), 'utf8') === expected, 'INSTRUMENTATION_DRIFT');
  fs.writeFileSync(path.join(destination, entry), expected.replace('    const { installReadOnlyProviderGuard }', '    const { install } = await import("./hosted-write/runtime.cjs");\n    await install();\n    const { installReadOnlyProviderGuard }'));
  fs.writeFileSync(path.join(destination, factory), 'import type { AppConfig } from "../../../config";\nimport type { GoogleDriveService } from "./GoogleDriveService";\nimport { HostedFakeDrive } from "../../../hosted-write/fake-drive.cjs";\nexport function createGoogleDriveServiceFromConfig(_config: AppConfig): GoogleDriveService { return new HostedFakeDrive() as unknown as GoogleDriveService; }\n');
  const target = path.join(destination, 'src/hosted-write'); fs.mkdirSync(target, { mode: 0o700 });
  for (const name of ['runtime.cjs', 'rpc.cjs', 'coordinator.cjs', 'policy.cjs', 'fake-drive.cjs']) fs.copyFileSync(path.join(__dirname, name), path.join(target, name));
  fs.copyFileSync(path.join(__dirname, '../local-write/provider-outcomes.cjs'), path.join(target, 'provider-outcomes.cjs'));
  fs.copyFileSync(path.join(__dirname, '../worksheets.json'), path.join(target, 'worksheets.json'));
  fs.copyFileSync(path.join(__dirname, 'private-endpoint.ts.txt'), path.join(target, 'private-endpoint.ts'));
  fs.mkdirSync(path.join(destination, 'src/app/api/ha-test'), { recursive: true });
  fs.writeFileSync(path.join(destination, 'src/app/api/ha-test/route.ts'), 'import { endpoint } from "@/hosted-write/private-endpoint";\nexport const GET = endpoint;\nexport const POST = endpoint;\n');
  const walk = directory => fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(directory, e.name)) : [path.join(directory, e.name)]);
  const allowed = new Set([entry, factory]), files = walk(path.join(source, 'src')).concat(walk(path.join(source, 'public')));
  for (const file of files) if (!allowed.has(path.relative(source, file))) requireGate(hash(file) === hash(path.join(destination, path.relative(source, file))), 'PRIVATE_BUILD_UNEXPECTED_DELTA');
  const attestation = { version: 1, sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim(), originalFilesVerified: files.length - allowed.size, originalFilesUnchanged: true, overrides: [...allowed].map(name => ({ path: name, before: hash(path.join(source, name)), after: hash(path.join(destination, name)) })), addedFiles: walk(target).concat([path.join(destination, 'src/app/api/ha-test/route.ts')]).map(file => ({ path: path.relative(destination, file), sha256: hash(file) })), hostedExecutionEnabled: false };
  fs.writeFileSync(path.join(destination, 'private-build-attestation.json'), JSON.stringify(attestation, null, 2), { mode: 0o600 });
  return attestation;
}
function build(source, destination) {
  const attestation = prepare(source, destination);
  fs.cpSync(path.join(source, 'node_modules'), path.join(destination, 'node_modules'), { recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE });
  const fd = fs.openSync(path.join(destination, 'private-build.log'), 'wx', 0o600);
  const result = cp.spawnSync('npm', ['run', 'build'], { cwd: destination, env: { PATH: process.env.PATH, HOME: process.env.HOME, CI: '1', NEXT_TELEMETRY_DISABLED: '1', STOCK_STORAGE: 'supabase' }, stdio: ['ignore', fd, fd], timeout: 300000 }); fs.closeSync(fd);
  requireGate(result.status === 0, 'PRIVATE_BUILD_FAILED');
  const map = JSON.parse(fs.readFileSync(path.join(destination, '.next/server/app-paths-manifest.json')));
  requireGate(map['/api/ha-test/route'], 'PRIVATE_ROUTE_MISSING'); delete map['/api/ha-test/route'];
  requireGate(sha(JSON.stringify(map, null, 2)) === '32f92c7a1ef17213d7a8642ca89e3e71218984982bf1bdce66b560ef35893e1e', 'PRIVATE_ORIGINAL_ROUTES_CHANGED');
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
  const chunks = walk(path.join(destination, '.next/static')).filter(p => p.endsWith('.js'));
  for (const file of chunks) for (const secret of ['STOCK_DATABASE_URL', 'STOCK_HA_', 'STOCK_STAGING_AUTH_TOKEN', 'VERCEL_AUTOMATION_BYPASS_SECRET', 'x-vercel-protection-bypass', 'stock_operational', 'postgresql://']) requireGate(!fs.readFileSync(file, 'utf8').includes(secret), 'PRIVATE_CLIENT_BOUNDARY');
  attestation.originalRouteManifestUnchanged = true; attestation.clientChunksChecked = chunks.length;
  attestation.buildPassed = true; fs.writeFileSync(path.join(destination, 'private-build-attestation.json'), JSON.stringify(attestation, null, 2), { mode: 0o600 });
  return attestation;
}
module.exports = { prepare, build };
if (require.main === module) { try { requireGate(process.argv.length === 4, 'TWO_PATHS_REQUIRED'); console.log(JSON.stringify(build(process.argv[2], process.argv[3]))); } catch (error) { console.error(error.message); process.exitCode = 1; } }
