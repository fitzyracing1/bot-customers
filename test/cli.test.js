'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { parseArgs, USAGE } = require('../lib/args');
const { main } = require('../lib/cli');

const fx = (name) => path.join(__dirname, 'fixtures', name);

describe('args and CLI', () => {
  it('prints usage for --help', async () => {
    assert.equal(parseArgs(['--help']).help, true);
    assert.match(USAGE, /never pushes/);
    const result = await main(['--help']);
    assert.equal(result.usage, true);
  });

  it('requires a command when help was not asked', async () => {
    await assert.rejects(() => main([]), /a command is required/);
  });

  it('detects a local fixture without using the network', async () => {
    const plan = await main(['detect', '--dir', fx('npm-pass')]);
    assert.equal(plan.ok, true);
    assert.equal(plan.method, 'npm test');
  });

  it('tests a local passing fixture and writes a job record', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-out-'));
    const result = await main(['test', '--dir', fx('npm-pass'), '--out', out, '--customer', 'cust_acme']);
    assert.equal(result.job.result, 'lit');
    assert.equal(result.job.customerId, 'cust_acme');
    assert.equal(result.job.source, 'bot-customers');
    assert.equal(result.job.billed, false);
    const written = JSON.parse(fs.readFileSync(path.join(out, 'job.json'), 'utf8'));
    assert.equal(written.result, 'lit');
    assert.ok(fs.existsSync(path.join(out, 'report.md')));
  });

  it('tests a local failing fixture as dark', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-out-'));
    const result = await main(['test', '--dir', fx('npm-fail'), '--out', out]);
    assert.equal(result.job.result, 'dark');
  });

  it('rejects an invalid repo name without cloning', async () => {
    await assert.rejects(() => main(['test', 'not-a-repo']), /invalid repo/);
  });

  it('does not clone when --dir is used, even if a repo is also passed as unused', async () => {
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-out-'));
    let cloned = false;
    const result = await main(['test', '--dir', fx('npm-pass'), '--out', out], {
      clonePublicRepo: async () => {
        cloned = true;
        throw new Error('should not clone in --dir mode');
      },
    });
    assert.equal(cloned, false);
    assert.equal(result.job.result, 'lit');
    assert.equal(result.job.tester.method, 'npm test');
  });

  it('rejects an unknown command', async () => {
    await assert.rejects(() => main(['push']), /unknown command/);
  });
});
