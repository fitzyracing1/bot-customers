'use strict';

const SCHEMA = 'discuss-build-job/v0.1';
const RESULTS = new Set(['lit', 'dark', 'untested']);
const SOURCES = new Set(['bot-customers', 'discuss-build', 'manual', 'ingest']);
const ISSUE_TYPES = new Set(['issue', 'discussion', 'test-run']);

function isRepo(value) {
  return typeof value === 'string' && /^[^/\s]+\/[^/\s]+$/.test(value);
}

function issueShape(issue) {
  if (issue == null) return null;
  if (typeof issue !== 'object') {
    throw new Error('job.issue must be an object or null');
  }
  const type = issue.type || 'test-run';
  if (!ISSUE_TYPES.has(type)) {
    throw new Error(`job.issue.type must be issue, discussion, or test-run (got ${type})`);
  }
  const number = issue.number == null ? null : Number(issue.number);
  if (issue.number != null && !Number.isFinite(number)) {
    throw new Error('job.issue.number must be a number when present');
  }
  return {
    number,
    url: issue.url == null ? null : String(issue.url),
    title: issue.title == null ? '' : String(issue.title),
    type,
  };
}

function testerShape(tester) {
  if (tester == null) return null;
  return {
    tool: tester.tool == null ? null : String(tester.tool),
    version: tester.version == null ? null : String(tester.version),
    method: tester.method == null ? null : String(tester.method),
  };
}

function normalizeJob(input, defaults = {}) {
  if (!input || typeof input !== 'object') {
    throw new Error('job record must be an object');
  }
  const repo = input.repo || defaults.repo;
  if (repo != null && !isRepo(repo)) {
    throw new Error(`job.repo must be owner/repo (got ${repo})`);
  }
  const result = input.result;
  if (!RESULTS.has(result)) {
    throw new Error('job.result must be lit, dark, or untested');
  }
  const source = input.source || defaults.source || 'bot-customers';
  if (!SOURCES.has(source)) {
    throw new Error(`job.source must be one of ${[...SOURCES].join(', ')}`);
  }
  return {
    schema: SCHEMA,
    id: input.id || defaults.id || null,
    customerId: input.customerId || defaults.customerId || null,
    subscriptionId: input.subscriptionId || defaults.subscriptionId || null,
    source,
    repo: repo || null,
    issue: issueShape(input.issue),
    branch: input.branch == null ? null : String(input.branch),
    result,
    billed: false,
    billId: null,
    amount: null,
    logsSummary: input.logsSummary == null ? '' : String(input.logsSummary),
    startedAt: input.startedAt || null,
    finishedAt: input.finishedAt || null,
    tester: testerShape(input.tester),
    createdAt: input.createdAt || defaults.createdAt || null,
  };
}

module.exports = { SCHEMA, RESULTS, isRepo, normalizeJob };
