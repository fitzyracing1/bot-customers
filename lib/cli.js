'use strict';
const path = require('path');
const { parseArgs, USAGE } = require('./args');
const { detect } = require('./detect');
const { runPlan } = require('./run');
const { clonePublicRepo, cleanupDir } = require('./clone');
const { buildJob, writeReports } = require('./report');
const { isRepo } = require('./schema');

function log(msg) {
  console.error('  ' + msg);
}

async function main(argv, deps = {}) {
  const opts = deps.parseArgs ? deps.parseArgs(argv) : parseArgs(argv);
  if (opts.help || !opts.command) {
    console.log(USAGE);
    if (!opts.help && !opts.command) {
      throw new Error('a command is required (test or detect)');
    }
    return { usage: true };
  }

  const now = deps.now || (() => new Date().toISOString());
  const outDir = path.resolve(opts.out);

  if (opts.command === 'detect') {
    if (!opts.dir) throw new Error('detect needs --dir <path>');
    const plan = (deps.detect || detect)(path.resolve(opts.dir));
    console.log(JSON.stringify(plan, null, 2));
    return plan;
  }

  if (opts.command !== 'test') {
    throw new Error(`unknown command: ${opts.command}. Pass --help to see usage.`);
  }

  if (!opts.dir && !opts.repo) {
    throw new Error('test needs <owner/repo> or --dir <path>');
  }
  if (opts.repo && !isRepo(opts.repo)) {
    throw new Error(`invalid repo: ${opts.repo}. Use owner/repo.`);
  }

  let workRoot = null;
  let targetDir = opts.dir ? path.resolve(opts.dir) : null;
  let cloned = null;

  try {
    if (!targetDir) {
      log(`cloning public repo ${opts.repo} (read-only, unauthenticated HTTPS)`);
      cloned = await (deps.clonePublicRepo || clonePublicRepo)(opts.repo, {
        workDir: opts.workDir,
        fetch: deps.fetch,
        spawn: deps.spawn,
      });
      workRoot = cloned.destRoot;
      targetDir = cloned.dest;
      log(`cloned to ${targetDir}`);
    }

    const plan = (deps.detect || detect)(targetDir);
    if (!plan.ok) log(`no test runner detected: ${plan.reason}`);
    else log(`detected ${plan.method}`);

    const ran = await (deps.runPlan || runPlan)(plan, {
      cwd: targetDir,
      timeoutMs: Math.round(opts.timeoutSeconds * 1000),
      now,
      spawn: deps.spawn,
    });
    log(`result ${ran.result}`);

    const job = (deps.buildJob || buildJob)({
      repo: opts.repo || null,
      customerId: opts.customer,
      issueNumber: opts.issue,
      issueUrl: opts.issueUrl,
      title: opts.title,
      branch: opts.branch,
      result: ran.result,
      logsSummary: ran.logsSummary,
      startedAt: ran.startedAt,
      finishedAt: ran.finishedAt,
      method: ran.method,
      now: ran.finishedAt,
    });
    const paths = (deps.writeReports || writeReports)(outDir, job, {
      logs: ran.logs,
      workDir: opts.keepWork ? targetDir : undefined,
    });
    log(`wrote ${paths.jsonPath}`);
    console.log(JSON.stringify(job, null, 2));
    return { job, paths, plan, ran, workDir: targetDir };
  } finally {
    if (cloned && workRoot && !opts.keepWork) {
      (deps.cleanupDir || cleanupDir)(workRoot);
    }
  }
}

module.exports = { main, USAGE };
