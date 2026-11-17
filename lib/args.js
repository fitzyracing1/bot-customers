'use strict';

const USAGE = `bot-customers — clone a public repo, run its tests, write a lit or dark job record.

Usage:
  bot-customers test <owner/repo>
  bot-customers test --dir <path>
  bot-customers detect --dir <path>

Options:
  --out <dir>              Report directory (default out)
  --timeout-seconds <n>    Time limit for install+test (default 180)
  --customer <id>          Attach a customer id to the job record
  --issue <n>              Optional issue number
  --issue-url <url>        Optional issue URL
  --title <text>           Optional issue title
  --branch <name>          Optional branch name to record
  --work-dir <dir>         Where to place a clone (default is a temp dir)
  --keep-work              Do not delete the temp clone when finished
  --help

This tool only reads public repositories. It never pushes, never comments,
and never opens issues, discussions, or pull requests on anyone's repository.

The job record (out/job.json) uses the shared discuss-build-job/v0.1 schema
and can be ingested by staging-customers:

  staging-customers job ingest out/job.json --customer cust_...
`;

function takeFlag(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1) return { value: undefined, rest: argv };
  if (i === argv.length - 1) throw new Error(`${name} needs a value`);
  const value = argv[i + 1];
  return { value, rest: argv.slice(0, i).concat(argv.slice(i + 2)) };
}

function hasFlag(argv, name) {
  return argv.includes(name);
}

function parseArgs(argv) {
  let rest = argv.slice();
  if (hasFlag(rest, '--help') || hasFlag(rest, '-h')) {
    return { help: true, command: 'help' };
  }

  const keepWork = hasFlag(rest, '--keep-work');
  rest = rest.filter((a) => a !== '--keep-work');

  let out, timeout, customer, issue, issueUrl, title, branch, workDir, dir;
  ({ value: out, rest } = takeFlag(rest, '--out'));
  ({ value: timeout, rest } = takeFlag(rest, '--timeout-seconds'));
  ({ value: customer, rest } = takeFlag(rest, '--customer'));
  ({ value: issue, rest } = takeFlag(rest, '--issue'));
  ({ value: issueUrl, rest } = takeFlag(rest, '--issue-url'));
  ({ value: title, rest } = takeFlag(rest, '--title'));
  ({ value: branch, rest } = takeFlag(rest, '--branch'));
  ({ value: workDir, rest } = takeFlag(rest, '--work-dir'));
  ({ value: dir, rest } = takeFlag(rest, '--dir'));

  const command = rest[0] || '';
  const repo = rest[1];

  const timeoutSeconds = timeout == null ? 180 : Number(timeout);
  if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
    throw new Error('--timeout-seconds must be a positive number');
  }

  return {
    help: false,
    command,
    repo: repo || null,
    dir: dir || null,
    out: out || 'out',
    timeoutSeconds,
    customer: customer || null,
    issue: issue || null,
    issueUrl: issueUrl || null,
    title: title || null,
    branch: branch || null,
    workDir: workDir || null,
    keepWork,
  };
}

module.exports = { parseArgs, USAGE };
