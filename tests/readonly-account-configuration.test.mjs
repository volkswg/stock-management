import test from 'node:test';
import {execFileSync} from 'node:child_process';

// Reuse the actual-owner guard/account-reader checks from migration CI. Its
// separate process contains the TS loader/global fetch hook; all Google calls
// are mocked and the child receives no credentials or application env files.
test('read-only account configuration works while staging and provider/write denials remain enforced', () => {
  execFileSync(process.execPath, ['--test', 'tools/migration/readonly-staging.test.cjs'], {
    cwd: process.cwd(), env: {PATH: process.env.PATH}, timeout: 30_000, stdio: 'pipe',
  });
});
