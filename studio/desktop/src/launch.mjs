import { execFileSync, spawn } from 'node:child_process';
import { existsSync, realpathSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knownProject, projectForRemote } from '../../src/projects.mjs';

const desktopDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function parseDesktopArgs(argv) {
  const options = { port: 3100, ciSmoke: false };
  const seen = new Set();
  for (const arg of argv) {
    if (arg === '--ci-smoke' && !seen.has('ciSmoke')) {
      options.ciSmoke = true;
      seen.add('ciSmoke');
      continue;
    }
    const match = /^--(workspace|project|port)=(.+)$/.exec(arg);
    if (!match || seen.has(match[1])) throw new Error('Usage: --workspace=/absolute/git/repo --project=devon-station [--port=3100]');
    seen.add(match[1]);
    options[match[1]] = match[2];
  }
  if (!options.workspace || !isAbsolute(options.workspace)) throw new Error('An absolute workspace path is required');
  if (!knownProject(options.project)) throw new Error('An approved private project identity is required');
  const port = Number(options.port);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid local port');
  options.port = port;
  return options;
}

function git(root, ...args) {
  return execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', timeout: 4000, maxBuffer: 8192,
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim();
}

export function verifyDesktopWorkspace(workspace, project) {
  const root = realpathSync(workspace);
  if (!statSync(root).isDirectory()) throw new Error('Workspace must be a directory');
  let top, remote;
  try {
    top = realpathSync(git(root, 'rev-parse', '--show-toplevel'));
    // Local-only configuration avoids rewriting Git remotes using ambient insteadOf settings.
    remote = git(root, 'config', '--local', '--get', 'remote.origin.url');
  } catch {
    throw new Error('Workspace must be the root of a Git checkout with an origin remote');
  }
  if (top !== root || projectForRemote(remote) !== project) {
    throw new Error('Workspace origin does not match the approved Studio project');
  }
  return root;
}

export function desktopCommand(options) {
  const root = verifyDesktopWorkspace(options.workspace, options.project);
  const cli = join(desktopDir, 'node_modules', '@theia', 'cli', 'bin', 'theia.js');
  if (!existsSync(cli)) throw new Error('Theia is not installed; install the isolated studio/desktop package');
  return {
    executable: process.execPath,
    args: [cli, 'start', root, '--hostname=127.0.0.1', '--port=' + options.port,
      '--plugins=local-dir:' + join(desktopDir, 'plugins')],
    cwd: desktopDir,
    env: { ...process.env, THEIA_HOSTS: '127.0.0.1:' + options.port + ',localhost:' + options.port },
  };
}

export function launchDesktop(argv = process.argv.slice(2)) {
  const options = parseDesktopArgs(argv);
  const allowCI = options.ciSmoke && process.env.GITHUB_ACTIONS === 'true';
  if (!allowCI && (!process.stdin.isTTY || !process.stdout.isTTY)) {
    throw new Error('Desktop Studio requires a private interactive local terminal');
  }
  const command = desktopCommand(options);
  if (!allowCI) {
    process.stdout.write('DevonStation Studio: private local Theia workbench\n');
    process.stdout.write('http://127.0.0.1:' + options.port + '\n');
    process.stdout.write('Editing and terminals use your operating-system permissions; NOT a remote sandbox.\n');
    process.stdout.write('No AI billing or public activity reporting is connected.\n');
  }
  const child = spawn(command.executable, command.args, {
    cwd: command.cwd, env: command.env, stdio: 'inherit',
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
  child.on('error', error => {
    process.stderr.write('Studio backend failed: ' + error.message + '\n');
    process.exitCode = 1;
  });
  child.on('exit', (code, signal) => {
    process.exitCode = signal ? 128 + (signal === 'SIGINT' ? 2 : 15) : code ?? 1;
  });
  return child;
}

if (process.argv[1] && import.meta.url === new URL('file://' + resolve(process.argv[1])).href) {
  try { launchDesktop(); }
  catch (error) {
    process.stderr.write('Studio refused to start: ' + error.message + '\n');
    process.exitCode = 1;
  }
}
