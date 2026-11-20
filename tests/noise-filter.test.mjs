import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {captureDraft,restoreLocal,todayCaptures,changeTodayFocus,triageCapture,updateDraft,TRIAGE_CHOICES} from '../src/core.mjs';
import {emptyState,validateOwnerState} from '../worker/state.mjs';
import {reconcileOwnerStates} from '../src/sync-core.mjs';

const at='2026-11-19T19:00:00.000Z';
const id='local:11111111-1111-4111-8111-111111111111';
const source=()=>captureDraft({title:'Review release checklist',area:'Family & Home',planDate:'2026-11-23'},[],at,id);
const base=()=>{const state=emptyState();state.drafts=[source()];return state;};

test('existing captures default to Inbox and remain compatible with server state v1',()=>{
 const old=base(),local=restoreLocal(old,[]);
 assert.equal(TRIAGE_CHOICES.join(','),'Inbox,Next,Parked,Discarded');
 assert.equal(local.drafts[0].triage,undefined);
 assert.equal(validateOwnerState(old).drafts[0].triage,undefined);
 assert.equal(todayCaptures(local).active.length,1);
 assert.deepEqual(todayCaptures(local).focused,[]);
});

test('classification is reversible, preserves the draft/date, and never creates another task',()=>{
 let state=base();
 state.outcomes=changeTodayFocus(state,id.slice(6));
 for(const lane of ['Next','Parked','Discarded']){
  const result=triageCapture(state,id,lane,at);
  state={...state,...result};
  assert.equal(state.outcomes.length,0,'classification must release the Now focus slot');
  assert.equal(state.drafts.length,1);
  assert.equal(state.drafts[0].title,'Review release checklist');
  assert.equal(state.drafts[0].planDate,'2026-11-23');
  assert.equal(state.drafts[0].triage,lane);
  assert.equal(validateOwnerState(state).drafts[0].triage,lane);
  assert.equal(todayCaptures(state).active.length,lane==='Next'?1:0);
 }
 assert.throws(()=>changeTodayFocus(state,id.slice(6)),/active local capture/);
 state={...state,...triageCapture(state,id,'Inbox',at)};
 assert.equal(state.drafts[0].triage,undefined);
 assert.equal(todayCaptures(state).active.length,1);
 state.outcomes=changeTodayFocus(state,id.slice(6));
 assert.equal(todayCaptures(state).focused.length,1);
});

test('editing an existing capture retains its classification, including across restore',()=>{
 let state=base();
 state={...state,...triageCapture(state,id,'Parked',at)};
 state.drafts=updateDraft(state.drafts,id,{title:'Revised release checklist',area:'Family & Home',planDate:'2026-11-24'},[]);
 assert.equal(state.drafts[0].triage,'Parked');
 const restored=restoreLocal(state,[]);
 assert.equal(restored.drafts[0].triage,'Parked');
 assert.equal(restored.drafts[0].title,'Revised release checklist');
 assert.equal(restored.drafts[0].planDate,'2026-11-24');
 assert.equal(todayCaptures(restored).active.length,0);
});

test('untrusted classification is rejected by server; legacy local restore drops unknown lane without losing capture',()=>{
 const state=base();
 state.drafts[0].triage='Unknown';
 assert.throws(()=>validateOwnerState(state),/invalid_triage/);
 const restored=restoreLocal(state,[]);
 assert.equal(restored.drafts.length,1);
 assert.equal(restored.drafts[0].triage,undefined);
 assert.throws(()=>triageCapture(restored,id,'Definitely now'),/valid noise-filter destination/);
 assert.throws(()=>triageCapture(restored,'local:../danger','Parked'),/Invalid local capture/);
 const archived={...restored,drafts:[{...restored.drafts[0],state:'Archived'}]};
 assert.throws(()=>triageCapture(archived,id,'Next'),/Restore an archived capture/);
});

test('device reconciliation handles independent choices and exposes conflicting reclassification',()=>{
 const baseline=base();
 const device=structuredClone(baseline);
 device.drafts[0].triage='Parked';
 const cloud=structuredClone(baseline);
 assert.equal(reconcileOwnerStates(baseline,device,cloud).state.drafts[0].triage,'Parked');
 cloud.drafts[0].triage='Next';
 const conflict=reconcileOwnerStates(baseline,device,cloud);
 assert.equal(conflict.safe,false);
 assert.deepEqual(conflict.conflicts,['drafts:'+id]);
 assert.equal(conflict.state,null);
});

test('existing capture HTML and app remain parseable and use explicit owner classification',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const app=read('src/app.js'),css=read('src/style.css');
 assert.doesNotThrow(()=>new Script(app));
 assert.match(app,/function inbox\(\)\{/);
 assert.match(app,/data-triage/);
 assert.match(app,/triageCapture\(local,triageId,e\.target\.value\)/);
 assert.match(app,/data-inbox-filter/);
 assert.match(app,/Open Noise Filter/);
 assert.match(css,/noise-filter-choice/);
 assert.doesNotMatch(app,/auto.*publish.*triage|send.*mail.*triage/i);
});
