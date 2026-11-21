import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DADOG_CORE_CONTRACT,dadogCoreSnapshot} from '../src/dadog-core.mjs';

const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Dadog Core is owner-guided, model-independent and explicitly non-executing',()=>{
 assert.equal(DADOG_CORE_CONTRACT.product,'Dadog');
 assert.equal(DADOG_CORE_CONTRACT.scope,'personal-owner');
 assert.equal(DADOG_CORE_CONTRACT.nextActionSource,'owner-selected-focus');
 assert.equal(DADOG_CORE_CONTRACT.autonomousExecution,false);
 assert.equal(DADOG_CORE_CONTRACT.modelConnection,false);
 assert.equal(DADOG_CORE_CONTRACT.privateKnowledgeConnection,false);
 assert.equal(DADOG_CORE_CONTRACT.requiresExplicitApproval,true);
 assert(Object.isFrozen(DADOG_CORE_CONTRACT));
});

test('only an existing owner-selected focus item is surfaced without prioritization or mutation',()=>{
 const focused=[{title:'Finish the existing task',area:'Personal & Family'},{title:'Second task',area:'Writing & Publishing'}];
 const before=JSON.stringify(focused);
 const snapshot=dadogCoreSnapshot(focused);
 assert.deepEqual(snapshot.nextAction,{title:'Finish the existing task',area:'Personal & Family',source:'owner-selected-focus'});
 assert.equal(snapshot.selectedCount,2);
 assert.equal(snapshot.source,'existing-local-captures');
 assert.equal(snapshot.modelConnected,false);
 assert.equal(snapshot.canExecute,false);
 assert(Object.isFrozen(snapshot));
 assert(Object.isFrozen(snapshot.nextAction));
 assert.equal(JSON.stringify(focused),before);
});

test('empty and invalid owner focus never fabricate priorities',()=>{
 for(const input of [undefined,null,[],{},[{title:''}],[{title:123}]]){
  const snapshot=dadogCoreSnapshot(input);
  assert.equal(snapshot.nextAction,null);
  assert.equal(snapshot.canExecute,false);
 }
});

test('the rename leaves owner data keys, push-device identifiers and protocol header stable',()=>{
 const app=source('src/app.js'),pwa=source('src/pwa.js'),cloud=source('src/cloud.js'),mail=source('src/mail-ui.js');
 assert.match(app,/KEY='devon-station:local:v1'/);
 assert.match(app,/TAB_RECOVERY_KEY='devon-station:tab-recovery:v1'/);
 assert.match(pwa,/idKey='devon-station:push-device:v1'/);
 assert.match(cloud,/SYNC_CONFIRMED_KEY='devon-station:confirmed:tab:v2'/);
 assert.match(mail,/X-DevonStation-Mail-Diagnostics/);
 assert.match(source('tools/build-hosted-shell.mjs'),/src\/dadog-core\.mjs/);
});

test('Dadog is the current app and install label; former titles remain a mail compatibility allowlist',()=>{
 const html=source('src/index.html');
 const manifest=JSON.parse(source('pwa/manifest.webmanifest'));
 assert.match(html,/<title>Dadog<\/title>/);
 assert.match(html,/apple-mobile-web-app-title" content="Dadog"/);
 assert.match(html,/aria-label="Dadog home"/);
 assert.equal(manifest.name,'Dadog');
 assert.equal(manifest.short_name,'Dadog');
 assert.match(source('src/mail-ui.js'),/Dadog','Devon Station','DevonStation/);
 assert.match(source('tools/mail-owner-canary-console.mjs'),/Dadog','DevonStation','Devon Station/);
});
