import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { listenLocalStudioHost, createLocalStudioHost, validRelativePath } from '../src/local-host.mjs';
import { PROJECTS, knownProject, projectForRemote } from '../src/projects.mjs';

const root = await mkdtemp(path.join(tmpdir(), 'devon-studio-test-'));
await mkdir(path.join(root, 'src'));
await writeFile(path.join(root, 'src', 'hello.mjs'), 'export const result = 42;\n');
await writeFile(path.join(root, '.env'), 'SECRET=abc\n');
await writeFile(path.join(root, '.ENV'), 'SHOULD_NOT_ESCAPE=1\n');
await mkdir(path.join(root, '.GIT'));
await writeFile(path.join(root, '.GIT', 'config'), 'private git config\n');
await writeFile(path.join(root, 'fake.key'), 'private');
await writeFile(path.join(root, 'binary.dat'), Buffer.from([0, 1, 2]));
await writeFile(path.join(root, 'huge.txt'), 'x'.repeat(128 * 1024 + 1));
await symlink(tmpdir(), path.join(root, 'escape'));
const app = await listenLocalStudioHost({ workspaceRoot: root, projectId: 'devon-station' });
after(async () => { await app.close(); await rm(root, { recursive: true, force: true }); });
async function get(pathname, { token = app.token, method = 'GET', origin } = {}) {
  const res = await fetch(app.address + pathname, { method, headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}), ...(origin ? { Origin: origin } : {}) } });
  return { status: res.status, json: await res.json(), headers: res.headers };
}

test('project identity maps only exact owner repository remotes', () => {
  assert.ok(knownProject('devon-station'));
  assert.ok(!knownProject('unknown'));
  assert.equal(projectForRemote('https://github.com/devonalanakins/devon-station.git'), 'devon-station');
  assert.equal(projectForRemote('git@github.com:devonalanakins/knowledge.git'), 'knowledge');
  assert.equal(projectForRemote('https://github.com/another/knowledge.git'), null);
  assert.equal(projectForRemote('https://github.com/devonalanakins/knowledge.git/evil'), null);
  assert.equal(PROJECTS['devon-station'].publicSlug, 'devonstation');
});
test('invalid identity or weak secret fails closed', async () => {
  await assert.rejects(createLocalStudioHost({ workspaceRoot: root, projectId: 'unknown', token: app.token }), /Unknown project/);
  await assert.rejects(createLocalStudioHost({ workspaceRoot: root, projectId: 'devon-station', token: 'password' }), /Strong host token/);
});
test('server only listens on loopback and public sharing is off', async () => {
  assert.equal(app.server.address().address, '127.0.0.1');
  const result = await get('/api/project');
  assert.equal(result.status, 200);
  assert.deepEqual(result.json, { projectId: 'devon-station', label: 'DevonStation', mode: 'read-only', reporting: 'off' });
  assert.equal(result.headers.get('cache-control'), 'no-store, private');
});
test('requires bearer token for every route', async () => {
  assert.equal((await get('/api/project', { token: null })).status, 401);
  assert.equal((await get('/api/file?path=src/hello.mjs', { token: 'wrong' })).status, 401);
});
test('rejects cross-origin browser requests and all writes', async () => {
  assert.equal((await get('/api/project', { origin: 'https://attacker.example' })).status, 403);
  assert.equal((await get('/api/project', { method: 'POST' })).status, 405);
});
test('rejects DNS-rebinding Host headers even with the correct bearer token', async () => {
  const result = await new Promise((resolve, reject) => {
    const request = http.get(app.address + '/api/project', {
      headers: { Host: 'attacker.example', Authorization: 'Bearer ' + app.token },
    }, response => {
      let body = '';
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    });
    request.on('error', reject);
  });
  assert.equal(result.status, 403);
  assert.equal(result.body.error, 'host-denied');
});

test('lists approved files without hidden credentials or symlinks', async () => {
  const result = await get('/api/files');
  assert.equal(result.status, 200);
  assert.ok(result.json.entries.some(e => e.name === 'src'));
  assert.ok(!result.json.entries.some(e => ['.env', '.ENV', '.GIT', 'fake.key', 'escape'].includes(e.name)));
});
test('reads a real local file and returns a content hash', async () => {
  const result = await get('/api/file?path=src/hello.mjs');
  assert.equal(result.status, 200);
  assert.equal(result.json.content, 'export const result = 42;\n');
  assert.match(result.json.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.json.readOnly, true);
});
test('refuses traversal, private paths and symlink escapes', async () => {
  for (const candidate of ['../src/hello.mjs', '.env', '.ENV', '.GIT/config', 'fake.key', 'escape/fake', '/etc/passwd', 'src\\hello.mjs']) {
    assert.notEqual((await get('/api/file?path=' + encodeURIComponent(candidate))).status, 200, candidate);
  }
  assert.equal(validRelativePath('../src/hello.mjs'), false);
  assert.equal(validRelativePath('.GIT/config'), false);
  assert.equal(validRelativePath('.ENV'), false);
});
test('rejects binary and oversized file content', async () => {
  assert.equal((await get('/api/file?path=binary.dat')).status, 415);
  assert.equal((await get('/api/file?path=huge.txt')).status, 413);
});
test('does not expose a terminal, write API, or public activity endpoint', async () => {
  for (const pathname of ['/api/run', '/api/write', '/api/presence']) {
    assert.equal((await get(pathname)).status, 404);
  }
});
test('CLI requires explicit project and repo without unknown flags', async () => {
  const { parseArgs } = await import('../src/cli.mjs');
  assert.deepEqual(parseArgs(['--root=/tmp/workspace', '--project=devon-station']), { workspaceRoot: '/tmp/workspace', projectId: 'devon-station' });
  assert.throws(() => parseArgs(['--root=/tmp/workspace']), /required/);
  assert.throws(() => parseArgs(['--root=/tmp/workspace', '--project=devon-station', '--public']), /Usage/);
});
