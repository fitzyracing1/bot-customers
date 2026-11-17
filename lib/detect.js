'use strict';
const fs = require('fs');
const path = require('path');

function exists(dir, name) {
  return fs.existsSync(path.join(dir, name));
}

function readText(dir, name) {
  try {
    return fs.readFileSync(path.join(dir, name), 'utf8');
  } catch {
    return '';
  }
}

function readJson(dir, name) {
  try {
    return JSON.parse(readText(dir, name));
  } catch {
    return null;
  }
}

function hasNpmTestScript(pkg) {
  return Boolean(pkg && pkg.scripts && typeof pkg.scripts.test === 'string' && pkg.scripts.test.trim());
}

function needsNpmInstall(pkg) {
  if (!pkg) return false;
  const deps = Object.assign({}, pkg.dependencies, pkg.devDependencies, pkg.optionalDependencies);
  return Object.keys(deps).length > 0;
}

function makefileHasTarget(text, target) {
  const re = new RegExp(`^${target}\\s*:`, 'm');
  return re.test(text);
}

function hasPytestMarkers(dir) {
  if (exists(dir, 'pytest.ini') || exists(dir, 'conftest.py')) return true;
  const pyproject = readText(dir, 'pyproject.toml');
  if (/\[tool\.pytest/i.test(pyproject) || /\bpytest\b/i.test(pyproject)) return true;
  const setupCfg = readText(dir, 'setup.cfg');
  if (/\[tool:pytest\]/i.test(setupCfg) || /pytest/i.test(setupCfg)) return true;
  const testsDir = path.join(dir, 'tests');
  if (fs.existsSync(testsDir) && fs.statSync(testsDir).isDirectory()) {
    try {
      const names = fs.readdirSync(testsDir);
      if (names.some((n) => /^test_.*\.py$/.test(n) || /_test\.py$/.test(n))) return true;
    } catch {
      // ignore
    }
  }
  try {
    const names = fs.readdirSync(dir);
    if (names.some((n) => /^test_.*\.py$/.test(n) || /_test\.py$/.test(n))) return true;
  } catch {
    // ignore
  }
  return false;
}

function pythonInstall(dir) {
  const steps = [
    { command: 'python3', args: ['-m', 'venv', '.venv'] },
    { command: path.join(dir, '.venv', 'bin', 'pip'), args: ['install', 'pytest'] },
  ];
  if (exists(dir, 'requirements.txt')) {
    steps.push({ command: path.join(dir, '.venv', 'bin', 'pip'), args: ['install', '-r', 'requirements.txt'] });
  }
  return steps;
}

function detect(dir) {
  if (!dir || !fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return { ok: false, reason: `not a directory: ${dir || '(missing)'}` };
  }

  const pkg = exists(dir, 'package.json') ? readJson(dir, 'package.json') : null;
  if (pkg && hasNpmTestScript(pkg)) {
    let manager = 'npm';
    if (exists(dir, 'pnpm-lock.yaml')) manager = 'pnpm';
    else if (exists(dir, 'yarn.lock')) manager = 'yarn';
    else if (exists(dir, 'package-lock.json')) manager = 'npm';
    const install = [];
    if (needsNpmInstall(pkg)) {
      if (manager === 'pnpm') {
        install.push({ command: 'pnpm', args: exists(dir, 'pnpm-lock.yaml') ? ['install', '--frozen-lockfile'] : ['install'] });
      } else if (manager === 'yarn') {
        install.push({ command: 'yarn', args: exists(dir, 'yarn.lock') ? ['install', '--frozen-lockfile'] : ['install'] });
      } else if (exists(dir, 'package-lock.json')) {
        install.push({ command: 'npm', args: ['ci'] });
      } else {
        install.push({ command: 'npm', args: ['install'] });
      }
    }
    const testCmd = manager === 'yarn'
      ? { command: 'yarn', args: ['test'] }
      : { command: manager, args: ['test'] };
    return {
      ok: true,
      ecosystem: 'node',
      manager,
      method: `${manager} test`,
      install,
      test: testCmd,
    };
  }

  if (exists(dir, 'Cargo.toml')) {
    return {
      ok: true,
      ecosystem: 'rust',
      manager: 'cargo',
      method: 'cargo test',
      install: [],
      test: { command: 'cargo', args: ['test'] },
    };
  }

  if (exists(dir, 'go.mod')) {
    return {
      ok: true,
      ecosystem: 'go',
      manager: 'go',
      method: 'go test ./...',
      install: [],
      test: { command: 'go', args: ['test', './...'] },
    };
  }

  if (hasPytestMarkers(dir)) {
    return {
      ok: true,
      ecosystem: 'python',
      manager: 'pytest',
      method: 'pytest',
      install: pythonInstall(dir),
      test: { command: path.join(dir, '.venv', 'bin', 'python'), args: ['-m', 'pytest'] },
    };
  }

  const makefileName = exists(dir, 'Makefile') ? 'Makefile' : exists(dir, 'makefile') ? 'makefile' : null;
  if (makefileName) {
    const text = readText(dir, makefileName);
    if (makefileHasTarget(text, 'test')) {
      return {
        ok: true,
        ecosystem: 'make',
        manager: 'make',
        method: 'make test',
        install: [],
        test: { command: 'make', args: ['test'] },
      };
    }
  }

  if (pkg) {
    return { ok: false, reason: 'package.json is present but has no test script, and no other test runner was detected' };
  }
  return { ok: false, reason: 'could not detect npm, pnpm, yarn, pytest, go, cargo, or a Makefile test target' };
}

module.exports = { detect, hasNpmTestScript, needsNpmInstall, makefileHasTarget, hasPytestMarkers };
