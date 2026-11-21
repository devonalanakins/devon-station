import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('command center presents only actual local capture and focus counts',()=>{
 const app=read('src/app.js');
 assert.doesNotThrow(()=>new Script(app));
 assert.match(app,/plannedToday=plannedCaptureGroups\(data\.active\.filter\(d=>d\.triage!=='Next'/);
 assert.match(app,/data\.focused\.length/);
 assert.match(app,/<small>\/ 3<\/small>/);
 assert.match(app,/data\.active\.length/);
 assert.match(app,/Current focus items/);
 assert.match(app,/Available active captures/);
 assert.match(app,/Owner-planned items today/);
 assert.match(app,/No external work starts without authorization/);
 assert.doesNotMatch(app,/Focus 92%|Energy 78%|Output \+34%|Now Playing.+Spotify/);
});

test('orbital home retains real actions, source evidence and mobile accessibility',()=>{
 const app=read('src/app.js'),css=read('src/style.css');
 for(const flag of ['data-capture','data-go="today"','data-go="command"','id="station-home-evidence"','data-home-evidence-refresh'])assert(app.includes(flag),flag);
 assert.match(app,/aria-label="Local workspace signals"/);
 assert.match(app,/aria-hidden="true"/);
 assert.match(css,/home-orbital-ring/);
 assert.match(css,/@media\(max-width:920px\)/);
 assert.match(css,/@media\(max-width:540px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/home-signal-grid/);
});
