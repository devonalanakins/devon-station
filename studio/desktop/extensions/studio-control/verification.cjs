'use strict';
const { spawn, execFileSync } = require('node:child_process');
const { createHash } = require('node:crypto');
const { realpathSync, statSync } = require('node:fs');
const { isAbsolute, join, sep } = require('node:path');
const { pathToFileURL } = require('node:url');

const SOURCE_TEST = 'studio/test/local-host.test.mjs';
const MAX_OUTPUT = 64 * 1024;
const iso = () => new Date().toISOString();
function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', timeout: 5000, maxBuffer: 128 * 1024,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}
async function verifyApprovedRoot(workspaceRoot, projectId) {
  if (typeof workspaceRoot !== 'string' || !isAbsolute(workspaceRoot)) throw new Error('Absolute workspace required');
  const root = realpathSync(workspaceRoot);
  if (!statSync(root).isDirectory()) throw new Error('Not a directory');
  const { knownProject, projectForRemote } = await import(
    new URL('../../../src/projects.mjs', pathToFileURL(__filename))
  );
  if (!knownProject(projectId)) throw new Error('Unknown project identity');
  const top = realpathSync(git(root, 'rev-parse', '--show-toplevel'));
  const remote = git(root, 'config', '--local', '--get', 'remote.origin.url');
  if (top !== root || projectForRemote(remote) !== projectId) {
    throw new Error('Workspace identity differs from the approved project');
  }
  return root;
}
async function executeObserved(executable, args, cwd, onOutput, timeoutMs) {
  return await new Promise((resolve, reject) => {
    let output = '';
    let truncated = false;
    let timedOut = false;
    const started = Date.now();
    // Node's test runner sets NODE_TEST_CONTEXT for its own subprocess. If inherited
    // by another "node --test", it can return 0 WITHOUT running a single test.
    // Strip that context for every observed command, including nested CI acceptance.
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawn(executable, args, {
      cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, env,
    });
    const add = (source, bytes) => {
      const text = bytes.toString('utf8');
      const remaining = MAX_OUTPUT - Buffer.byteLength(output, 'utf8');
      if (remaining > 0) output += Buffer.from(text).subarray(0, remaining).toString('utf8');
      if (remaining <= 0 || Buffer.byteLength(text, 'utf8') > remaining) truncated = true;
      if (typeof onOutput === 'function') onOutput(source, text.slice(0, 16384));
    };
    child.stdout.on('data', bytes => add('stdout', bytes));
    child.stderr.on('data', bytes => add('stderr', bytes));
    const timer = setTimeout(() => { timedOut = true; child.kill('SIGKILL'); }, timeoutMs);
    child.once('error', error => { clearTimeout(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timer);
      resolve({
        exitCode: code, signal: signal ?? null, timedOut, durationMs: Date.now() - started,
        outputSha256: createHash('sha256').update(output).digest('hex'), outputTruncated: truncated,
      });
    });
  });
}
async function runLocalVerify({ workspaceRoot, projectId, onOutput } = {}) {
  const root = await verifyApprovedRoot(workspaceRoot, projectId);
  if (projectId !== 'devon-station') throw new Error('No explicitly approved local test preset for this project');
  const checked = realpathSync(join(root, SOURCE_TEST));
  if (!checked.startsWith(root + sep) || !statSync(checked).isFile()) {
    throw new Error('Focused test entry must be a regular file inside the approved project');
  }
  const startedAt = iso();
  const headAtStart = git(root, 'rev-parse', '--verify', 'HEAD');
  const dirtyAtStart = git(root, 'status', '--porcelain').length > 0;
  const steps = [];
  steps.push({
    label: 'git diff HEAD --check',
    ...(await executeObserved('git', ['-C', root, 'diff', 'HEAD', '--check'], root, onOutput, 10000)),
  });
  steps.push({
    label: 'node --test ' + SOURCE_TEST,
    ...(await executeObserved(process.execPath, ['--test', checked], root, onOutput, 90000)),
  });
  const headAtEnd = git(root, 'rev-parse', '--verify', 'HEAD');
  const dirtyAtEnd = git(root, 'status', '--porcelain').length > 0;
  const consistent = headAtStart === headAtEnd;
  const observedPass = steps.every(step => step.exitCode === 0 && !step.timedOut && !step.signal);
  // These are LOCAL results only. Successful local checks are never CI/release evidence.
  return Object.freeze({
    schema: 'devonstation.studio.local-verify.v1',
    source: 'local-process-observed',
    projectId,
    startedAt,
    finishedAt: iso(),
    gitHead: headAtStart,
    headUnchanged: consistent,
    dirtyAtStart,
    dirtyAtEnd,
    result: !consistent ? 'inconclusive' : observedPass ? 'passed' : 'failed',
    coverage: 'focused-studio-host-test-and-tracked-diff-only',
    steps,
    ciVerified: false,
    deploymentVerified: false,
    publicSharing: false,
  });
}
async function listApprovedWorktrees({ workspaceRoot, projectId }) {
  const root = await verifyApprovedRoot(workspaceRoot, projectId);
  const raw = git(root, 'worktree', 'list', '--porcelain');
  const result = [];
  for (const chunk of raw.split(/\n\n+/)) {
    const lines = chunk.split(/\r?\n/);
    const line = lines.find(item => item.startsWith('worktree '));
    if (!line) continue;
    const candidate = line.slice(9);
    try {
      const checked = await verifyApprovedRoot(candidate, projectId);
      const branch = lines.find(item => item.startsWith('branch '))?.slice(7).replace(/^refs\/heads\//, '') ?? 'detached HEAD';
      result.push({ root: checked, branch, head: lines.find(item => item.startsWith('HEAD '))?.slice(5) ?? '' });
    } catch {
      // Do not display unrelated worktrees merely because Git knows their path.
    }
  }
  return result;
}
module.exports = { verifyApprovedRoot, runLocalVerify, listApprovedWorktrees };
