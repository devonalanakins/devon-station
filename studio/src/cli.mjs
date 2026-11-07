import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { listenLocalStudioHost } from './local-host.mjs';

export function parseArgs(argv) {
  const settings = {};
  for (const arg of argv) {
    const match = /^--(root|project)=(.+)$/.exec(arg);
    if (!match || settings[match[1]]) throw new Error('Usage: node studio/src/cli.mjs --root=/absolute/repo --project=devon-station');
    settings[match[1]] = match[2];
  }
  if (!settings.root || !settings.project) throw new Error('Both --root and --project are required');
  return { workspaceRoot: resolve(settings.root), projectId: settings.project };
}

export async function runCli(argv = process.argv.slice(2), output = process.stdout) {
  if (!process.stdin.isTTY || !output.isTTY) throw new Error('Studio local host requires a private interactive terminal');
  const host = await listenLocalStudioHost(parseArgs(argv));
  output.write('Studio private local host: ' + host.address + '\n');
  output.write('Read-only. No terminal, file writes, agents, or public broadcasting enabled.\n');
  output.write('One-session bearer token: ' + host.token + '\n');
  output.write('Stop with Ctrl-C. Never publish or paste this token.\n');
  return host;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch(error => { process.stderr.write('Studio refused to start: ' + error.message + '\n'); process.exitCode = 1; });
}
