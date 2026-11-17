'use strict';
const { spawn } = require('child_process');

const DEFAULT_LOG_CHARS = 4000;

function summarizeLogs(text, maxChars = DEFAULT_LOG_CHARS) {
  const raw = String(text || '').replace(/\u0000/g, '');
  if (raw.length <= maxChars) return raw;
  const tail = raw.slice(-maxChars);
  return `…(truncated, last ${maxChars} characters)\n${tail}`;
}

function formatCommand(step) {
  return [step.command, ...(step.args || [])].join(' ');
}

function killTree(child) {
  if (!child) return;
  try {
    if (child.pid && process.platform !== 'win32') {
      process.kill(-child.pid, 'SIGKILL');
      return;
    }
  } catch {
    // The process may not be a group leader (or may already be gone).
  }
  try {
    child.kill('SIGKILL');
  } catch {
    // ignore
  }
}

function runStep(step, opts) {
  const cwd = opts.cwd;
  const timeoutMs = opts.timeoutMs;
  const env = opts.env || process.env;
  const spawnFn = opts.spawn || spawn;

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    const child = spawnFn(step.command, step.args || [], {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (child && child.stdout) child.stdout.destroy();
      if (child && child.stderr) child.stderr.destroy();
      resolve(result);
    };

    if (!child || typeof child.on !== 'function') {
      finish({
        ok: false,
        timedOut: false,
        exitCode: null,
        signal: null,
        stdout: '',
        stderr: 'failed to start process',
        error: 'failed to start process',
      });
      return;
    }

    const timer = setTimeout(() => {
      timedOut = true;
      killTree(child);
    }, timeoutMs);

    if (child.stdout) child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    if (child.stderr) child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => {
      finish({
        ok: false,
        timedOut,
        exitCode: null,
        signal: null,
        stdout,
        stderr: stderr + (stderr ? '\n' : '') + String(err.message),
        error: err.message,
      });
    });
    // Prefer 'exit' over 'close' so a grandchild holding inherited pipes
    // cannot keep us waiting after the process we spawned has already died.
    child.on('exit', (code, signal) => {
      finish({
        ok: !timedOut && code === 0,
        timedOut,
        exitCode: code,
        signal: signal || null,
        stdout,
        stderr,
        error: timedOut ? `timed out after ${Math.round(timeoutMs / 1000)}s` : null,
      });
    });
  });
}

async function runPlan(plan, opts) {
  const steps = [];
  const started = opts.now ? opts.now() : new Date().toISOString();
  const allLogs = [];
  let result = 'lit';
  let failedAt = null;

  if (!plan || !plan.ok) {
    const finished = opts.now ? opts.now() : new Date().toISOString();
    return {
      result: 'untested',
      startedAt: started,
      finishedAt: finished,
      logs: plan && plan.reason ? plan.reason : 'no test plan',
      logsSummary: plan && plan.reason ? plan.reason : 'no test plan',
      steps: [],
      method: null,
    };
  }

  const sequence = [...(plan.install || []), plan.test];
  for (const step of sequence) {
    const label = formatCommand(step);
    const ran = await runStep(step, opts);
    const chunk = [`$ ${label}`, ran.stdout, ran.stderr, ran.error ? `error: ${ran.error}` : `exit ${ran.exitCode}`]
      .filter(Boolean)
      .join('\n');
    allLogs.push(chunk);
    steps.push({
      command: label,
      ok: ran.ok,
      timedOut: ran.timedOut,
      exitCode: ran.exitCode,
      error: ran.error,
    });
    if (!ran.ok) {
      result = 'dark';
      failedAt = ran.timedOut ? `timed out running: ${label}` : `failed: ${label}`;
      break;
    }
  }

  const raw = allLogs.join('\n\n');
  const finished = opts.now ? opts.now() : new Date().toISOString();
  return {
    result,
    startedAt: started,
    finishedAt: finished,
    logs: raw,
    logsSummary: [failedAt, summarizeLogs(raw)].filter(Boolean).join('\n'),
    steps,
    method: plan.method,
  };
}

module.exports = { runStep, runPlan, summarizeLogs, formatCommand, killTree, DEFAULT_LOG_CHARS };
