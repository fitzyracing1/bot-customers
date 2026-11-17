'use strict';

const FORBIDDEN_GIT = [
  'push',
  'push --all',
];

const FORBIDDEN_SUBSTRINGS = [
  'git push',
  'gh pr ',
  'gh pr\t',
  'gh issue ',
  'gh issue comment',
  'gh api -X POST',
  'gh api -X PATCH',
  'gh api -X PUT',
  'gh api -X DELETE',
  'hub pull-request',
];

function publicHttpsUrl(repo) {
  if (!/^[^/\s]+\/[^/\s]+$/.test(repo)) {
    throw new Error(`invalid repo: ${repo}. Use owner/repo.`);
  }
  const [owner, name] = repo.split('/');
  if (owner === '.' || owner === '..' || name === '.' || name === '..') {
    throw new Error(`invalid repo: ${repo}`);
  }
  if (owner.includes(':') || name.includes(':')) {
    throw new Error(`invalid repo: ${repo}`);
  }
  return `https://github.com/${owner}/${name}.git`;
}

function assertNoWriteRemote(commandLine) {
  const text = String(commandLine || '').toLowerCase();
  for (const needle of FORBIDDEN_SUBSTRINGS) {
    if (text.includes(needle)) {
      throw new Error(`refusing to run a command that could write to a remote repository: ${needle.trim()}`);
    }
  }
}

function assertAllowedGitArgs(args) {
  const list = Array.isArray(args) ? args.map(String) : [];
  if (list[0] === 'push' || list.includes('push')) {
    throw new Error('bot-customers never runs git push');
  }
  return list;
}

function cloneEnv(extra = {}) {
  return {
    ...process.env,
    ...extra,
    GIT_TERMINAL_PROMPT: '0',
    GIT_ASKPASS: 'echo',
    GC_CONNECT_TIMEOUT: extra.GC_CONNECT_TIMEOUT,
  };
}

module.exports = {
  publicHttpsUrl,
  assertNoWriteRemote,
  assertAllowedGitArgs,
  cloneEnv,
  FORBIDDEN_SUBSTRINGS,
  FORBIDDEN_GIT,
};
