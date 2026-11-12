
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {homePersonalScope,homePersonalDecisions,homeWorkSummary} from '../src/home-evidence-core.mjs';

const personal={scopeKind:'personal',scopeId:'personal-a'};
const grants={execution:'record_only',scopes:[personal,{scopeKind:'business',scopeId:'business-private'}]};
const project={projectId:'project-a',title:'Synthetic project'};
const action={recordId:'action-a',projectId:'project-a',summary:'Review safe synthetic action',status:'proposed',revision:1};
const journal={scope:personal,execution:'record_only',generation:3,projects:[project],
 actions:[action,{...action,recordId:'action-b',status:'approved'}],receipts:[],journalEvents:[]};
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('Home only selects one explicit personal scope; never guesses a business or second personal scope',()=>{
 assert.deepEqual(homePersonalScope(grants),{status:'selected',scope:personal});
 assert.deepEqual(homePersonalScope({...grants,scopes:[{scopeKind:'business',scopeId:'nona'}]}),{status:'none',scope:null});
 assert.deepEqual(homePersonalScope({...grants,scopes:[personal,{scopeKind:'personal',scopeId:'another'}]}),{status:'multiple',scope:null});
 assert.throws(()=>homePersonalScope({execution:'auto',scopes:[personal]}),/invalid_workspace_scopes/);
 assert.throws(()=>homePersonalScope({...grants,scopes:[personal,personal]}),/duplicate_workspace_scope/);
 assert.throws(()=>homePersonalScope({...grants,scopes:[{scopeKind:'personal',scopeId:'../../escape'}]}),/invalid_workspace_scopes/);
});

test('Decision summary is bounded and shows proposals without promoting them to execution',()=>{
 const s=homePersonalDecisions(journal,personal);
 assert.equal(s.proposedCount,1);
 assert.equal(s.total,2);
 assert.equal(s.recordOnly,true);
 assert.deepEqual(s.preview,[{summary:'Review safe synthetic action',project:'Synthetic project'}]);
 assert.doesNotMatch(JSON.stringify(s),/receipt|journalEvents|business-private/);
 for(const invalid of [
  {...journal,scope:{scopeKind:'business',scopeId:'personal-a'}},
  {...journal,execution:'automatic'},
  {...journal,actions:[{...action,projectId:'unknown'}]},
  {...journal,actions:[{...action,status:'executing'}]},
  {...journal,actions:[{...action,summary:'a'.repeat(181)}]},
  {...journal,actions:[action,action]},
  {...journal,projects:[{...project,title:''}]},
 ])assert.throws(()=>homePersonalDecisions(invalid,personal),undefined,JSON.stringify(invalid).slice(0,50));
 assert.throws(()=>homePersonalDecisions(journal,{scopeKind:'business',scopeId:'personal-a'}));
});
test('Work review previews expose only project slug and bounded metadata, not task prompts',()=>{
 const item={jobId:'a',projectSlug:'devon-station',state:'review',updatedAt:1794500000000,task:'SENSITIVE_DO_NOT_SHOW'};
 const config={jobs:[item,{...item,jobId:'b',state:'ready'}],nextCursor:null,executionEnabled:false,publicSharing:false};
 const result=homeWorkSummary(config,new Set(['devon-station']));
 assert.equal(result.review,1);assert.equal(result.ready,1);
 assert.equal(result.reviewPreview.length,1);
 assert.equal(result.reviewPreview[0].projectSlug,'devon-station');
 assert.doesNotMatch(JSON.stringify(result),/SENSITIVE_DO_NOT_SHOW|jobId/);
 assert.throws(()=>homeWorkSummary({...config,jobs:[{...item,projectSlug:'nona'}]},new Set(['devon-station'])),/ungranted_or_invalid_job/);
});
test('Home and Today share readonly review surfaces and existing navigation, no extra storage',()=>{
 const app=read('src/app.js'),ui=read('src/home-evidence-ui.js');
 assert.doesNotThrow(()=>new Script(app));
 assert.doesNotThrow(()=>new Script(ui));
 assert.match(app,/id="he-decisions"/);
 assert.match(app,/REVIEW STATUS \/ READ-ONLY/);
 assert.match(ui,/homePersonalScope\(scopes\)/);
 assert.match(ui,/homePersonalDecisions\(payload,selected.scope\)/);
 assert.match(ui,/\['home','today'\]\.includes\(section\)/);
 assert.match(ui,/routeButton\('Review plans in Work'/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|\/api\/workspace\/decide|\/api\/ai-work\/jobs\/[^']*\/decision/);
});
