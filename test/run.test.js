'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { EventEmitter } = require('events');
const { detect } = require('../lib/detect');
const { runPlan, summarizeLogs } = require('../lib/run');
const { buildJob, writeReports, renderMarkdown } = require('../lib/report');
const { SCHEMA } = require('../lib/schema');
const fs = require('fs');
const os = require('os');

const fx = (name) => path.join(__dirname, 'fixtures', name);

describe('run and reports', () => {
  it('marks an npm fixture that exits 0 as lit', async () => {
    const plan = detect(fx('npm-pass'));
    const ran = await runPlan(plan, { cwd: fx('npm-pass'), timeoutMs: 15000 });
    assert.equal(ran.result, 'lit');
    assert.equal(ran.method, 'npm test');
    assert.ok(ran.steps.every((s) => s.ok));
  });

  it('marks an npm fixture that exits 1 as dark', async () => {
    const plan = detect(fx('npm-fail'));
    const ran = await runPlan(plan, { cwd: fx('npm-fail'), timeoutMs: 15000 });
    assert.equal(ran.result, 'dark');
    assert.match(ran.logsSummary, /failed:/);
  });

  it('marks a Makefile fixture that succeeds as lit', async (t) => {
    const { spawnSync } = require('child_process');
    const hasMake = spawnSync('make', ['--version'], { encoding: 'utf8' }).status === 0;
    if (!hasMake) {
      t.skip('make is not installed on this machine');
      return;
    }
    const plan = detect(fx('make-pass'));
    const ran = await runPlan(plan, { cwd: fx('make-pass'), timeoutMs: 10000 });
    assert.equal(ran.result, 'lit');
    assert.equal(ran.method, 'make test');
  });

  it('marks a timed-out run as dark', async () => {
    const plan = detect(fx('npm-timeout'));
    const t0 = Date.now();
    const ran = await runPlan(plan, { cwd: fx('npm-timeout'), timeoutMs: 400 });
    const elapsed = Date.now() - t0;
    assert.equal(ran.result, 'dark');
    assert.match(ran.logsSummary, /timed out/);
    assert.ok(elapsed < 8000, `timeout should not wait for the full child script (elapsed ${elapsed}ms)`);
  });

  it('marks an undetectable project as untested', async () => {
    const plan = detect(fx('unknown'));
    const ran = await runPlan(plan, { cwd: fx('unknown'), timeoutMs: 1000 });
    assert.equal(ran.result, 'untested');
    assert.match(ran.logsSummary, /could not detect/);
  });

  it('truncates long logs in the summary', () => {
    const summary = summarizeLogs('x'.repeat(5000), 100);
    assert.match(summary, /truncated/);
    assert.ok(summary.length < 200);
  });

  it('emits a job record that matches the shared schema', () => {
    const job = buildJob({
      repo: 'fitzyracing1/fakegreen',
      customerId: 'cust_acme',
      result: 'lit',
      logsSummary: 'npm test exited 0',
      method: 'npm test',
      startedAt: '2026-11-17T03:00:00.000Z',
      finishedAt: '2026-11-17T03:01:00.000Z',
    });
    assert.equal(job.schema, SCHEMA);
    assert.equal(job.source, 'bot-customers');
    assert.equal(job.result, 'lit');
    assert.equal(job.billed, false);
    assert.equal(job.amount, null);
    assert.equal(job.tester.tool, 'bot-customers');
    assert.equal(job.tester.method, 'npm test');
    assert.equal(job.issue.type, 'test-run');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bot-report-'));
    const paths = writeReports(dir, job, { logs: 'full log' });
    const written = JSON.parse(fs.readFileSync(paths.jsonPath, 'utf8'));
    assert.equal(written.id, job.id);
    assert.equal(fs.readFileSync(paths.logsPath, 'utf8'), 'full log');
    assert.match(renderMarkdown(job), /never pushes/);
  });
});
