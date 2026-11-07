import { cp, mkdir, rm, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktop = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(desktop, 'extensions/studio-control');
const folder = resolve(desktop, 'plugins');
const target = resolve(folder, 'devonstation-studio-control');
if (!source.startsWith(desktop + '/')) throw new Error('Unexpected extension source');
await realpath(source);
await mkdir(folder, { recursive: true });
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true, filter: path => !path.includes('/test/') });
console.log('Staged local DevonStation Studio controls with downloaded Theia plugins.');
