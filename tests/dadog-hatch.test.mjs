import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script,runInNewContext} from 'node:vm';

const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');

function companionSource(){
 const start=app.indexOf('function dadogCompanion(){');
 const end=app.indexOf('\nfunction home(){',start);
 assert.ok(start>=0&&end>start,'companion must precede existing Home function');
 return app.slice(start,end);
}
function companionMarkup(){return runInNewContext(companionSource()+'\ndadogCompanion();');}

test('the current Home source parses and embeds exactly one Dadog visual companion',()=>{
 assert.doesNotThrow(()=>new Script(app));
 assert.equal(app.split("dadogCompanion()+'<section class=").length,2);
 const markup=companionMarkup();
 assert.match(markup,/aria-labelledby="dadog-card-title"/);
 assert.match(markup,/data-dadog-state="resting"/);
 assert.match(markup,/data-dadog-status/);
 assert.match(markup,/aria-live="polite"/);
 assert.match(markup,/<svg viewBox="0 0 240 225"/);
 assert.match(markup,/data-dadog-toggle aria-pressed="false"/);
});

test('Dadog reuses existing Today and Capture actions and does not invent cloud behavior',()=>{
 const markup=companionMarkup(),source=companionSource();
 assert.match(markup,/data-go="today"/);
 assert.match(markup,/data-capture/);
 assert.match(markup,/No assistant API, cloud memory or home control is connected/);
 assert.doesNotMatch(source,/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|navigator\.mediaDevices|new Audio|setInterval/);
 assert.match(app,/if\('dadogToggle' in d\)/);
 assert.match(app,/panel\.dataset\.dadogState=awake\?'awake':'resting'/);
});

test('Dadog preserves reduced motion and mobile constraints',()=>{
 assert.match(style,/\.page-home \.home-dadog/);
 assert.match(style,/max-width:540px/);
 assert.match(style,/\.page-home \.dadog-awake-eyes/);
 assert.match(style,/@media\(prefers-reduced-motion:reduce\)[\s\S]*?\.dadog-visual svg/);
 assert.match(style,/body\[data-motion=reduced\] \.page-home \.dadog-visual svg/);
});

test('Dadog includes no separate task database or automatic external action',()=>{
 const source=companionSource();
 assert.doesNotMatch(source,/indexedDB|localStorage|sessionStorage|sendBeacon|\.post\s*\(|\.put\s*\(|window\.open/);
 assert.match(source,/Visual-only hatch/);
});
