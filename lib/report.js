'use strict';
const fs = require('fs');
const path = require('path');
const { normalizeJob, SCHEMA } = require('./schema');

const VERSION = require('../package.json').version;

function jobId(now, rng = Math.random) {
  return `job_${Date.parse(now) || Date.now().toString(36)}${Math.floor(rng() * 1e9).toString(36)}`;
}

function buildJob(opts) {
  const createdAt = opts.finishedAt || opts.now || new Date().toISOString();
  return normalizeJob({
    id: opts.id || jobId(createdAt, opts.rng),
    customerId: opts.customerId || null,
    source: 'bot-customers',
    repo: opts.repo || null,
    issue: opts.issue || (opts.issueNumber || opts.title
      ? {
        number: opts.issueNumber == null ? null : Number(opts.issueNumber),
        url: opts.issueUrl || null,
        title: opts.title || '',
        type: opts.issueType || 'test-run',
      }
      : { number: null, url: null, title: opts.repo ? `test run of ${opts.repo}` : 'local test run', type: 'test-run' }),
    branch: opts.branch || null,
    result: opts.result,
    logsSummary: opts.logsSummary || '',
    startedAt: opts.startedAt || null,
    finishedAt: opts.finishedAt || createdAt,
    tester: {
      tool: 'bot-customers',
      version: VERSION,
      method: opts.method || null,
    },
    createdAt,
  });
}

function renderMarkdown(job, extra = {}) {
  const lines = [];
  lines.push(`# bot-customers report${job.repo ? ` for ${job.repo}` : ''}`);
  lines.push('');
  lines.push('This tool only reads public repositories. It never pushes, never comments, and never opens issues, discussions, or pull requests.');
  lines.push('');
  lines.push(`- Result: **${job.result}**`);
  lines.push(`- Source: \`${job.source}\``);
  if (job.repo) lines.push(`- Repo: \`${job.repo}\``);
  if (job.branch) lines.push(`- Branch: \`${job.branch}\``);
  if (job.tester && job.tester.method) lines.push(`- Method: \`${job.tester.method}\``);
  if (job.startedAt) lines.push(`- Started: ${job.startedAt}`);
  if (job.finishedAt) lines.push(`- Finished: ${job.finishedAt}`);
  if (extra.workDir) lines.push(`- Work directory: \`${extra.workDir}\``);
  lines.push(`- Schema: \`${SCHEMA}\``);
  lines.push('');
  lines.push('## Logs summary');
  lines.push('');
  lines.push('```');
  lines.push(job.logsSummary || '(empty)');
  lines.push('```');
  lines.push('');
  lines.push('This JSON job record can be ingested by staging-customers:');
  lines.push('');
  lines.push('```');
  lines.push('staging-customers job ingest out/job.json --customer cust_...');
  lines.push('```');
  lines.push('');
  return lines.join('\n');
}

function writeReports(outDir, job, extra = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'job.json');
  const mdPath = path.join(outDir, 'report.md');
  const logsPath = path.join(outDir, 'logs.txt');
  fs.writeFileSync(jsonPath, JSON.stringify(job, null, 2) + '\n');
  fs.writeFileSync(mdPath, renderMarkdown(job, extra));
  if (extra.logs != null) fs.writeFileSync(logsPath, String(extra.logs));
  return { jsonPath, mdPath, logsPath };
}

module.exports = { buildJob, renderMarkdown, writeReports, VERSION };
