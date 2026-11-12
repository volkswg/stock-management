/* eslint-disable @typescript-eslint/no-require-imports -- Build a private test copy with one attested source override and an isolated runtime preload. */
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process');
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function build(source, destination) {
    source = fs.realpathSync(source);
    destination = path.resolve(destination);
    if (fs.existsSync(destination) || !fs.existsSync(path.join(source, 'src/instrumentation.ts')) || destination === source)
        throw Error('Use a new private test-build destination.');
    fs.mkdirSync(destination, {
        mode: 0o700
    });
    for (const name of ['src', 'public', 'package.json', 'yarn.lock', 'tsconfig.json', 'next.config.ts'])
        fs.cpSync(path.join(source, name), path.join(destination, name), {
            recursive: true
        });
    fs.cpSync(path.join(source, 'node_modules'), path.join(destination, 'node_modules'), {
        recursive: true, verbatimSymlinks: true, mode: fs.constants.COPYFILE_FICLONE
    });
    const entry = 'src/instrumentation.ts', factory = 'src/infrastructure/files/google-drive/createGoogleDriveServiceFromConfig.ts', runtime = '__local-write-harness/runtime.cjs';
    const before = {
        [entry]: sha(path.join(destination, entry)), [factory]: sha(path.join(destination, factory))
    };
    const expectedInstrumentation = 'import "server-only";\nexport async function register() {\n  if (process.env.NEXT_RUNTIME === "nodejs") {\n    const { installReadOnlyProviderGuard } = await import("./infrastructure/runtime/staging-read-only");\n    installReadOnlyProviderGuard();\n  }\n}\n';
    if (fs.readFileSync(path.join(destination, entry), 'utf8') !== expectedInstrumentation)
        throw Error('Instrumentation changed; review the test-copy delta.');
    fs.writeFileSync(path.join(destination, factory), 'import type { AppConfig } from "../../../config";\nimport type { GoogleDriveService } from "./GoogleDriveService";\nimport { FakeDrive } from "../../../local-write-harness/fake-drive.cjs";\nexport function createGoogleDriveServiceFromConfig(_config: AppConfig): GoogleDriveService | undefined {\n  if(process.env.STOCK_LOCAL_WRITE_HARNESS !== "true") throw new Error("Private test build cannot run without isolation.");\n  return new FakeDrive() as unknown as GoogleDriveService;\n}\n');
    fs.mkdirSync(path.dirname(path.join(destination, runtime)), {
        recursive: true
    });
    fs.copyFileSync(path.join(__dirname, 'runtime.cjs'), path.join(destination, runtime));
    fs.copyFileSync(path.join(__dirname, 'provider-outcomes.cjs'), path.join(destination, '__local-write-harness/provider-outcomes.cjs'));
    fs.writeFileSync(path.join(destination, '__local-write-harness/preload.cjs'), "require('./runtime.cjs').install();\n");
    fs.mkdirSync(path.join(destination, 'src/local-write-harness'), {
        recursive: true
    });
    fs.copyFileSync(path.join(__dirname, 'fake-drive.cjs'), path.join(destination, 'src/local-write-harness/fake-drive.cjs'));
    const walk = d => fs.readdirSync(d, {
        withFileTypes: true
    }).flatMap(e => e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
    const allowed = new Set([factory]);
    let same = 0;
    for (const folder of ['src', 'public'])
        for (const f of walk(path.join(source, folder))) {
            const rel = path.relative(source, f);
            if (!allowed.has(rel) && sha(f) !== sha(path.join(destination, rel)))
                throw Error('Unexpected test-build source change.');
            same++;
        }
    const attestation = {
        sourceCommit: cp.execFileSync('git', ['rev-parse', 'HEAD'], {
            cwd: source, encoding: 'utf8'
        }).trim(), unchangedFilesChecked: same - 1, changes: [...allowed].map(p => ({
            path: p, before: before[p], after: sha(path.join(destination, p))
        })), newFiles: [runtime, '__local-write-harness/provider-outcomes.cjs', '__local-write-harness/preload.cjs', 'src/local-write-harness/fake-drive.cjs'].map(p => ({
            path: p, sha256: sha(path.join(destination, p))
        })), providerMode: 'fake-only', productionSourceChanged: false
    };
    fs.writeFileSync(path.join(destination, 'test-copy-attestation.json'), JSON.stringify(attestation, null, 2), {
        mode: 0o600
    });
    const env = {
        PATH: process.env.PATH, HOME: process.env.HOME, CI: '1', NEXT_TELEMETRY_DISABLED: '1', STOCK_STORAGE: 'supabase'
    };
    const log = fs.openSync(path.join(destination, 'private-build.log'), 'wx', 0o600);
    const r = cp.spawnSync('npm', ['run', 'build'], {
        cwd: destination, env, stdio: ['ignore', log, log], timeout: 300000
    });
    fs.closeSync(log);
    if (r.status !== 0)
        throw Error('Private build failed; inspect its restricted log.');
    const chunks = walk(path.join(destination, '.next/static')).filter(f => f.endsWith('.js'));
    for (const f of chunks) {
        const text = fs.readFileSync(f, 'utf8');
        for (const forbidden of ['STOCK_DATABASE_URL', 'STOCK_STAGING_AUTH_TOKEN', 'stock_operational', 'postgresql://'])
            if (text.includes(forbidden))
                throw Error('Client boundary failed.');
    }
    attestation.clientChunksChecked = chunks.length;
    attestation.credentialFreeBuildPassed = true;
    fs.writeFileSync(path.join(destination, 'test-copy-attestation.json'), JSON.stringify(attestation, null, 2), {
        mode: 0o600
    });
    return attestation;
}
module.exports = {
    build
};
if (require.main === module) {
    try {
        if (process.argv.length !== 4)
            throw Error('Two exact paths required.');
        console.log(JSON.stringify(build(process.argv[2], process.argv[3])));
    }
    catch (e) {
        console.error(e.message);
        process.exitCode = 1;
    }
}
