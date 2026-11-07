import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseDesktopArgs, verifyDesktopWorkspace } from '../src/launch.mjs';

function workspace(t, remote = 'https://github.com/devonalanakins/devon-station.git') {
  const root = mkdtempSync(join(tmpdir(), 'studio-desktop-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  execFileSync('git', ['-C', root, 'remote', 'add', 'origin', remote]);
  writeFileSync(join(root, 'readme.txt'), 'Real workspace\n');
  return root;
}
test('launcher requires one exact approved project and absolute workspace', () => {
  assert.deepEqual(parseDesktopArgs(['--workspace=/tmp/repo','--project=devon-station']),
    { workspace:'/tmp/repo',project:'devon-station',port:3100,ciSmoke:false });
  for (const argv of [
    ['--workspace=relative','--project=devon-station'],
    ['--workspace=/tmp','--project=nonexistent'],
    ['--workspace=/tmp','--project=devon-station','--hostname=0.0.0.0'],
    ['--workspace=/tmp','--project=devon-station','--port=0'],
    ['--workspace=/tmp','--project=devon-station','--port=3100','--port=3101'],
  ]) assert.throws(() => parseDesktopArgs(argv));
});
test('trusted origin is checked before launching writable Theia', t => {
  const root = workspace(t);
  assert.equal(verifyDesktopWorkspace(root, 'devon-station'), root);
  assert.throws(() => verifyDesktopWorkspace(root, 'mizvo'), /does not match/);
});
test('different repository owner is not trusted even if repository name matches', t => {
  const root = workspace(t, 'git@github.com:someone-else/devon-station.git');
  assert.throws(() => verifyDesktopWorkspace(root, 'devon-station'), /does not match/);
});
test('nested directories cannot enlarge the selected workspace', t => {
  const root = workspace(t);
  mkdirSync(join(root,'child'));
  assert.throws(() => verifyDesktopWorkspace(join(root,'child'), 'devon-station'), /does not match/);
});
test('non-repository directory is rejected', t => {
  const root = mkdtempSync(join(tmpdir(), 'studio-outside-'));
  t.after(() => rmSync(root, {recursive:true,force:true}));
  assert.throws(() => verifyDesktopWorkspace(root,'devon-station'), /root of a Git checkout/);
});
