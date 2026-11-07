const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { mkdtempSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const { verifyApprovedRoot, runLocalVerify, listApprovedWorktrees } = require('../verification.cjs');

function fixture(t, {remote='https://github.com/devonalanakins/devon-station.git',fail=false}={}) {
  const root = mkdtempSync(join(tmpdir(),'ds-studio-verify-'));
  t.after(()=>rmSync(root,{recursive:true,force:true}));
  mkdirSync(join(root,'studio','test'),{recursive:true});
  writeFileSync(join(root,'studio','test','local-host.test.mjs'),
    "import { test } from 'node:test'; import assert from 'node:assert/strict'; test('real synthetic smoke', () => assert.equal(2+2,"+(fail?'5':'4')+"));\n");
  execFileSync('git',['init','-q',root]);
  execFileSync('git',['-C',root,'remote','add','origin',remote]);
  execFileSync('git',['-C',root,'add','.']);
  execFileSync('git',['-C',root,'-c','user.name=Studio CI','-c','user.email=studio@example.invalid',
    'commit','-qm','synthetic fixture']);
  return root;
}
test('runs real Git diff and Node tests with accurate pass receipts', async t=>{
  const root=fixture(t);
  assert.equal(await verifyApprovedRoot(root,'devon-station'),root);
  const r=await runLocalVerify({workspaceRoot:root,projectId:'devon-station'});
  assert.equal(r.result,'passed');
  assert.equal(r.steps.length,2);
  assert.ok(r.steps.every(s=>s.exitCode===0 && !s.timedOut));
  assert.equal(r.headUnchanged,true);
  assert.equal(r.ciVerified,false);
  assert.equal(r.deploymentVerified,false);
  assert.equal(r.publicSharing,false);
});
test('failed real test remains failed rather than appearing completed',async t=>{
  const root=fixture(t,{fail:true});
  const r=await runLocalVerify({workspaceRoot:root,projectId:'devon-station'});
  assert.equal(r.result,'failed');
  assert.equal(r.steps[0].exitCode,0);
  assert.equal(r.steps[1].exitCode,1);
});
test('rejects unrelated, unapproved and unsupported projects before execution',async t=>{
  const root=fixture(t,{remote:'git@github.com:other/devon-station.git'});
  await assert.rejects(runLocalVerify({workspaceRoot:root,projectId:'devon-station'}),/approved project/);
  await assert.rejects(verifyApprovedRoot(root,'invalid'),/Unknown project/);
  const own=fixture(t);
  await assert.rejects(runLocalVerify({workspaceRoot:own,projectId:'mizvo'}),/approved project/);
});
test('Orbit derives actual Git worktrees and commit identities',async t=>{
  const root=fixture(t);
  const values=await listApprovedWorktrees({workspaceRoot:root,projectId:'devon-station'});
  assert.equal(values.length,1);
  assert.equal(values[0].root,root);
  assert.match(values[0].head,/^[0-9a-f]{40}$/);
});
