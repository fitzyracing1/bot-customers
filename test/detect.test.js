'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { detect, makefileHasTarget } = require('../lib/detect');

const fx = (name) => path.join(__dirname, 'fixtures', name);

describe('detect', () => {
  it('detects npm when package.json has a test script', () => {
    const plan = detect(fx('npm-pass'));
    assert.equal(plan.ok, true);
    assert.equal(plan.ecosystem, 'node');
    assert.equal(plan.manager, 'npm');
    assert.equal(plan.method, 'npm test');
    assert.deepEqual(plan.install, []);
    assert.deepEqual(plan.test, { command: 'npm', args: ['test'] });
  });

  it('detects pnpm from pnpm-lock.yaml', () => {
    const plan = detect(fx('pnpm'));
    assert.equal(plan.manager, 'pnpm');
    assert.equal(plan.method, 'pnpm test');
  });

  it('detects yarn from yarn.lock', () => {
    const plan = detect(fx('yarn'));
    assert.equal(plan.manager, 'yarn');
    assert.deepEqual(plan.test, { command: 'yarn', args: ['test'] });
  });

  it('detects pytest markers', () => {
    const plan = detect(fx('pytest'));
    assert.equal(plan.ok, true);
    assert.equal(plan.ecosystem, 'python');
    assert.equal(plan.method, 'pytest');
    assert.ok(plan.install.length >= 2);
  });

  it('detects go.mod', () => {
    const plan = detect(fx('go'));
    assert.equal(plan.method, 'go test ./...');
    assert.deepEqual(plan.test, { command: 'go', args: ['test', './...'] });
  });

  it('detects Cargo.toml', () => {
    const plan = detect(fx('rust'));
    assert.equal(plan.method, 'cargo test');
  });

  it('detects a Makefile test target', () => {
    const plan = detect(fx('make-pass'));
    assert.equal(plan.ok, true);
    assert.equal(plan.method, 'make test');
  });

  it('prefers a node test script over a Makefile', () => {
    const plan = detect(fx('node-and-make'));
    assert.equal(plan.ecosystem, 'node');
    assert.equal(plan.method, 'npm test');
  });

  it('returns untested guidance when nothing matches', () => {
    const unknown = detect(fx('unknown'));
    assert.equal(unknown.ok, false);
    assert.match(unknown.reason, /could not detect/);
    const noTest = detect(fx('node-no-test'));
    assert.equal(noTest.ok, false);
    assert.match(noTest.reason, /no test script/);
  });

  it('rejects a missing directory', () => {
    const plan = detect(fx('does-not-exist'));
    assert.equal(plan.ok, false);
    assert.match(plan.reason, /not a directory/);
  });

  it('recognizes Makefile targets only at the start of a line', () => {
    assert.equal(makefileHasTarget('test:\n\t@echo ok\n', 'test'), true);
    assert.equal(makefileHasTarget('all:\n\techo test\n', 'test'), false);
  });
});
