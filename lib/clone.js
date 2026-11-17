'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { publicHttpsUrl, assertAllowedGitArgs, cloneEnv } = require('./safety');
const { runStep } = require('./run');

async function isPublicRepo(repo, opts = {}) {
  const fetchFn = opts.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') {
    // Without fetch, we still try an unauthenticated clone and let it fail
    // for private or missing repos.
    return { public: true, checked: false };
  }
  const url = `https://api.github.com/repos/${repo}`;
  const res = await fetchFn(url, {
    headers: {
      'User-Agent': 'bot-customers',
      Accept: 'application/vnd.github+json',
    },
  });
  if (res.status === 404) {
    return { public: false, checked: true, reason: `repository not found or not public: ${repo}` };
  }
  if (!res.ok) {
    return { public: false, checked: true, reason: `could not confirm ${repo} is public (HTTP ${res.status})` };
  }
  const body = await res.json();
  if (body.private) {
    return { public: false, checked: true, reason: `refusing to clone a private repository: ${repo}` };
  }
  return { public: true, checked: true };
}

function workDir(opts = {}) {
  if (opts.workDir) {
    fs.mkdirSync(opts.workDir, { recursive: true });
    return opts.workDir;
  }
  return fs.mkdtempSync(path.join(os.tmpdir(), 'bot-customers-'));
}

async function clonePublicRepo(repo, opts = {}) {
  const url = publicHttpsUrl(repo);
  const visibility = await isPublicRepo(repo, opts);
  if (!visibility.public) {
    throw new Error(visibility.reason);
  }
  const destRoot = workDir(opts);
  const dest = path.join(destRoot, repo.split('/')[1]);
  const args = assertAllowedGitArgs(['clone', '--depth', '1', url, dest]);
  const ran = await runStep(
    { command: 'git', args },
    {
      cwd: destRoot,
      timeoutMs: opts.cloneTimeoutMs || 120000,
      env: cloneEnv(opts.env),
      spawn: opts.spawn || spawn,
    },
  );
  if (!ran.ok) {
    const detail = ran.error || ran.stderr || ran.stdout || `exit ${ran.exitCode}`;
    throw new Error(`git clone failed for ${repo}: ${detail}`);
  }
  return { dest, destRoot, url, visibility };
}

function cleanupDir(dir) {
  if (!dir) return;
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { isPublicRepo, clonePublicRepo, workDir, cleanupDir };
