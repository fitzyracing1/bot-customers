'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { publicHttpsUrl, assertNoWriteRemote, assertAllowedGitArgs, cloneEnv } = require('../lib/safety');
const { isPublicRepo } = require('../lib/clone');

describe('safety', () => {
  it('builds an unauthenticated HTTPS GitHub URL and rejects bad names', () => {
    assert.equal(publicHttpsUrl('fitzyracing1/fakegreen'), 'https://github.com/fitzyracing1/fakegreen.git');
    assert.throws(() => publicHttpsUrl('not-a-repo'), /invalid repo/);
    assert.throws(() => publicHttpsUrl('acme/../etc'), /invalid repo/);
    assert.throws(() => publicHttpsUrl('acme:foo/bar'), /invalid repo/);
  });

  it('refuses git push and other remote writes', () => {
    assert.throws(() => assertAllowedGitArgs(['push', 'origin', 'main']), /never runs git push/);
    assert.throws(() => assertNoWriteRemote('git push origin HEAD'), /git push/);
    assert.throws(() => assertNoWriteRemote('gh pr create --title x'), /gh pr/);
    assert.throws(() => assertNoWriteRemote('gh issue comment 1 --body hi'), /gh issue/);
    assert.doesNotThrow(() => assertAllowedGitArgs(['clone', '--depth', '1', 'https://github.com/acme/app.git', 'app']));
    assert.doesNotThrow(() => assertNoWriteRemote('git clone --depth 1 https://github.com/acme/app.git app'));
  });

  it('disables git prompts when cloning', () => {
    const env = cloneEnv();
    assert.equal(env.GIT_TERMINAL_PROMPT, '0');
  });

  it('refuses a private repository reported by the API', async () => {
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ private: true }) });
    const result = await isPublicRepo('acme/secret', { fetch: fetchFn });
    assert.equal(result.public, false);
    assert.match(result.reason, /private repository/);
  });

  it('treats a 404 as not public', async () => {
    const fetchFn = async () => ({ ok: false, status: 404, json: async () => ({}) });
    const result = await isPublicRepo('acme/missing', { fetch: fetchFn });
    assert.equal(result.public, false);
    assert.match(result.reason, /not found or not public/);
  });

  it('accepts a public repository', async () => {
    const fetchFn = async () => ({ ok: true, status: 200, json: async () => ({ private: false }) });
    const result = await isPublicRepo('fitzyracing1/fakegreen', { fetch: fetchFn });
    assert.equal(result.public, true);
  });
});
