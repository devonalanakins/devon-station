import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {SECTIONS,captureDraft,restoreLocal,todayCaptures,changeTodayFocus} from '../src/core.mjs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const date='2026-11-12T12:00:00.000Z';
const draft=n=>captureDraft({title:'Non-sensitive task '+n,area:'Family & Home'},[],date,'local:focus-'+n);
const state=()=>({version:1,prefs:{},drafts:[1,2,3,4].map(draft),feedback:[],outcomes:[],history:[]});

test('Home, Today and Assistant are distinct source-backed routes',()=>{
 for(const route of ['home','today','command'])assert(SECTIONS.includes(route));
 assert.equal(SECTIONS[0],'home');
 const app=read('src/app.js'),assistant=read('src/assistant-ui.js');
 assert.doesNotThrow(()=>new Script(app));
 assert.doesNotThrow(()=>new Script(assistant));
 assert.match(app,/home:home,today:today,workspace:workspace,command:command/);
 assert.match(app,/data-more-sections/);
 assert.match(assistant,/mount\(location\.hash\.slice\(1\)\|\|'home'\)/);
 assert.match(read('src/index.html'),/href="#home" class="monogram"/);
 assert.match(read('src/style.css'),/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});

test('Today focus changes are bounded, reversible and owner-selected',()=>{
 const local=state();
 for(const n of [1,2,3])local.outcomes=changeTodayFocus(local,'focus-'+n);
 assert.deepEqual(local.outcomes,['focus-1','focus-2','focus-3']);
 assert.deepEqual(todayCaptures(local).focused.map(d=>d.id),['local:focus-1','local:focus-2','local:focus-3']);
 assert.throws(()=>changeTodayFocus(local,'focus-4'),/up to three/);
 local.outcomes=changeTodayFocus(local,'focus-2');
 assert.deepEqual(local.outcomes,['focus-1','focus-3']);
 local.outcomes=changeTodayFocus(local,'focus-4');
 assert.deepEqual(local.outcomes,['focus-1','focus-3','focus-4']);
 assert.throws(()=>changeTodayFocus(local,'../config'),/Invalid local/);
 assert.throws(()=>changeTodayFocus(local,'unlisted'),/active local/);
});

test('local focus persists through safe restore without fabricating completion',()=>{
 const local=state();
 local.outcomes=changeTodayFocus(local,'focus-1');
 const restored=restoreLocal(local,[]);
 assert.deepEqual(restored.outcomes,['focus-1']);
 assert.equal(todayCaptures(restored).focused[0].title,'Non-sensitive task 1');
 restored.drafts[0].state='Archived';
 assert.equal(todayCaptures(restored).focused.length,0);
 assert.throws(()=>changeTodayFocus(restored,'focus-1'),/active local/);
 restored.outcomes=changeTodayFocus(restored,'focus-2');
 assert.deepEqual(restored.outcomes,['focus-2']);
 assert.deepEqual(restored.drafts.filter(d=>d.state==='Archived').length,1);
});

test('Home and Today do not imply real calendar, execution or approval state',()=>{
 const app=read('src/app.js');
 assert.match(app,/Focused captures do not launch agents/);
 assert.match(app,/Separate service approvals and business queues are not read here/);
 assert.match(app,/No calendar commitments are displayed by this local view/);
 assert.match(app,/No external work starts without authorization/);
 const builder=read('tools/build-hosted-shell.mjs');
 assert.match(builder,/Inspect authorized project evidence without executing actions/);
});
