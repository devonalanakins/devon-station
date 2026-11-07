import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { lstat, readdir, readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { PROJECTS, knownProject } from './projects.mjs';

const MAX_FILE_BYTES = 128 * 1024;
const MAX_LIST_ENTRIES = 128;
const PRIVATE_PARTS = new Set(['.git', '.env', '.secrets', 'node_modules', '.ssh', '.aws', '.wrangler', 'dist', 'build']);
const PRIVATE_SUFFIXES = /(?:\.pem|\.p12|\.pfx|\.key|\.env(?:\..*)?)$/i;

function isPrivate(part) {
  return PRIVATE_PARTS.has(part) || PRIVATE_SUFFIXES.test(part) || /^(?:id_rsa|id_ed25519|credentials|secrets)\b/i.test(part);
}
export function validRelativePath(value, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > 512 || value.includes('\\') || value.includes('\0')) return false;
  if (value === '') return allowEmpty;
  if (value.startsWith('/') || value.endsWith('/') || value.includes('//')) return false;
  return value.split('/').every(part => part.length > 0 && part !== '.' && part !== '..' && !isPrivate(part));
}
function json(res, status, value) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store, private',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
    'X-Frame-Options': 'DENY',
  });
  res.end(JSON.stringify(value));
}
function matchesToken(actual, expected) {
  if (typeof actual !== 'string' || !actual.startsWith('Bearer ')) return false;
  const actualBytes = Buffer.from(actual.slice(7));
  const expectedBytes = Buffer.from(expected);
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}
async function safeNode(root, relative, kind) {
  const parts = relative ? relative.split('/') : [];
  let current = root;
  for (const part of parts) {
    current = path.join(current, part);
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw new Error('invalid-path');
  }
  const resolved = await realpath(current);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) throw new Error('invalid-path');
  const info = await stat(resolved);
  if ((kind === 'directory' && !info.isDirectory()) || (kind === 'file' && !info.isFile())) throw new Error('wrong-kind');
  return { resolved, info };
}

/** Authenticated owner-local file inspector, deliberately without writes, execution, or network exposure. */
export async function createLocalStudioHost({ workspaceRoot, projectId, token }) {
  if (!knownProject(projectId)) throw new Error('Unknown project: refuse unapproved workspace identity');
  if (typeof token !== 'string' || !/^[A-Za-z0-9_-]{43,128}$/.test(token)) throw new Error('Strong host token required');
  const root = await realpath(workspaceRoot);
  if (!(await stat(root)).isDirectory()) throw new Error('Workspace must be a directory');
  const server = http.createServer(async (req, res) => {
    try {
      const origin = req.headers.origin;
      const port = req.socket.localPort;
      if (origin && origin !== 'http://127.0.0.1:' + port && origin !== 'http://localhost:' + port) {
        json(res, 403, { error: 'origin-denied' }); return;
      }
      if (!matchesToken(req.headers.authorization, token)) {
        json(res, 401, { error: 'unauthorized' }); return;
      }
      if (req.method !== 'GET') {
        json(res, 405, { error: 'read-only' }); return;
      }
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/project') {
        const record = PROJECTS[projectId];
        json(res, 200, { projectId, label: record.label, mode: 'read-only', reporting: 'off' }); return;
      }
      if (url.pathname === '/api/files') {
        const relative = url.searchParams.get('dir') ?? '';
        if (!validRelativePath(relative, true)) { json(res, 400, { error: 'invalid-path' }); return; }
        const { resolved } = await safeNode(root, relative, 'directory');
        const names = (await readdir(resolved, { withFileTypes: true }))
          .filter(entry => !isPrivate(entry.name) && !entry.isSymbolicLink())
          .slice(0, MAX_LIST_ENTRIES);
        json(res, 200, { directory: relative, entries: names.map(entry => ({
          name: entry.name, type: entry.isDirectory() ? 'directory' : entry.isFile() ? 'file' : 'other',
        })) }); return;
      }
      if (url.pathname === '/api/file') {
        const relative = url.searchParams.get('path');
        if (!validRelativePath(relative)) { json(res, 400, { error: 'invalid-path' }); return; }
        const { resolved, info } = await safeNode(root, relative, 'file');
        if (info.size > MAX_FILE_BYTES) { json(res, 413, { error: 'too-large' }); return; }
        const bytes = await readFile(resolved);
        if (bytes.length > MAX_FILE_BYTES || bytes.includes(0)) { json(res, 415, { error: 'non-text-or-too-large' }); return; }
        let content;
        try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
        catch { json(res, 415, { error: 'not-utf8' }); return; }
        json(res, 200, { path: relative, content, sha256: createHash('sha256').update(bytes).digest('hex'), readOnly: true }); return;
      }
      json(res, 404, { error: 'not-found' });
    } catch (error) {
      const status = error?.code === 'ENOENT' || error?.message === 'invalid-path' || error?.message === 'wrong-kind' ? 404 : 500;
      json(res, status, { error: status === 404 ? 'not-found' : 'host-error' });
    }
  });
  return { server, projectId };
}
export async function listenLocalStudioHost(options) {
  const token = options.token ?? randomBytes(32).toString('base64url');
  const host = await createLocalStudioHost({ ...options, token });
  await new Promise((resolve, reject) => {
    host.server.once('error', reject);
    host.server.listen(0, '127.0.0.1', resolve);
  });
  const address = host.server.address();
  return {
    ...host,
    token,
    address: 'http://127.0.0.1:' + address.port,
    close: () => new Promise((resolve, reject) => host.server.close(error => error ? reject(error) : resolve())),
  };
}
