import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {homeProjectGrant,homeEvidenceSummary,homeWorkGrants,homeWorkSummary} from '../src/home-evidence-core.mjs';

const project={mode:'read_only',executionEnabled:false,projects:[
 {workspaceId:'software',projectId:'devon-station',capability:'read-evidence',name:'DevonStation'}]};
const sha='a'.repeat(40);
const url='https://github.com/devonalanakins/devon-station/pull/57';
const evidence={readOnly:true,executionClass:'A0',command:'/status',workspaceId:'software',projectId:'devon-station',
 source:'github_public_repository_api',observedAt:'2026-11-12T13:00:00.000Z',
 selectedPullRequest:{number:57,draft:true,headSha:sha,url},
 exactHeadCI:{revision:sha,checkSummary:'observed_pass',checkTotal:3},
 unknowns:['deployment_unverified'],nextAction:'Review PR #57; release needs approval.'};
const work={projects:[{slug:'devon-station',name:'DevonStation'},{slug:'rhen',name:'Rhen'}],
 executionEnabled:false,publicSharing:false};
const jobs={executionEnabled:false,publicSharing:false,nextCursor:null,jobs:[
 {jobId:'a',state:'review',projectSlug:'devon-station',task:'SECRET_NOT_TO_SHOW'},
 {jobId:'b',state:'ready',projectSlug:'rhen',execution:{phase:'running'},task:'OTHER_SECRET'}
]};

test('only pinned owner-scoped project grants permit GitHub read-only checks',()=>{
 assert.equal(homeProjectGrant(project),true);
 assert.equal(homeProjectGrant({...project,projects:[]}),false);
 assert.equal(homeProjectGrant({...project,projects:[{workspaceId:'professional',projectId:'devon-station',capability:'read-evidence'}]}),false);
 assert.equal(homeProjectGrant({...project,projects:[{workspaceId:'software',projectId:'devon-station',capability:'execute'}]}),false);
 assert.throws(()=>homeProjectGrant({...project,executionEnabled:true}),/invalid_project_grants/);
 assert.throws(()=>homeProjectGrant({projects:[]}),/invalid_project_grants/);
});
test('source summary requires exact PR HEAD, fixed repository URL and readonly A0 contract',()=>{
 const result=homeEvidenceSummary(evidence);
 assert.equal(result.pr.number,57);assert.equal(result.pr.headSha,sha);
 assert.equal(result.checkSummary,'observed_pass');
 assert.equal(result.unknownCount,1);
 for(const mutation of [
  {readOnly:false},{executionClass:'A1'},{projectId:'nona'}, {command:'/execute'},
  {source:'llm_summary'},{observedAt:'not-a-date'},
  {selectedPullRequest:{...evidence.selectedPullRequest,url:'https://evil.test/steal'}},
  {selectedPullRequest:{...evidence.selectedPullRequest,headSha:'garbage'}},
  {exactHeadCI:{revision:'b'.repeat(40),checkSummary:'observed_pass',checkTotal:2}},
  {unknowns:['a'.repeat(101)]},
  {nextAction:'a'.repeat(601)}
 ]) assert.throws(()=>homeEvidenceSummary({...evidence,...mutation}),undefined,JSON.stringify(mutation).slice(0,70));
 assert.equal(homeEvidenceSummary({...evidence,selectedPullRequest:null,exactHeadCI:null}).pr,null);
});
test('Work summary contains only authorized metadata, never prompt text or unauthorized project counts',()=>{
 const grants=homeWorkGrants(work),result=homeWorkSummary(jobs,grants);
 assert.equal(result.observedCount,2);assert.equal(result.review,1);assert.equal(result.ready,1);
 assert.equal(result.executionRecords,1);assert.equal(result.partial,false);
 assert.doesNotMatch(JSON.stringify(result),/SECRET_NOT_TO_SHOW|OTHER_SECRET|task/);
 assert.equal(homeWorkSummary({...jobs,nextCursor:'cursor'},grants).partial,true);
 assert.throws(()=>homeWorkGrants({...work,publicSharing:true}),/invalid_work_capability/);
 assert.throws(()=>homeWorkGrants({...work,projects:[...work.projects,work.projects[0]]}),/invalid_work_grants/);
 assert.throws(()=>homeWorkSummary(jobs,new Set(['rhen'])),/ungranted_or_invalid_job/);
 assert.throws(()=>homeWorkSummary({...jobs,jobs:[{projectSlug:'devon-station',state:'executing'}]},grants),/ungranted_or_invalid_job/);
 assert.throws(()=>homeWorkSummary({...jobs,executionEnabled:true},grants),/invalid_work_source/);
});
test('Home UI mounts existing source contracts without broadening execution or storage',()=>{
 const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const ui=read('src/home-evidence-ui.js');
 assert.doesNotThrow(()=>new Script(ui));
 assert.match(ui,/credentials:'same-origin'/);
 assert.match(ui,/cache:'no-store'/);
 assert.match(ui,/redirect:'manual'/);
 assert.match(ui,/reader.cancel\(\)/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|api\/ai-work\/jobs[^']*',\s*{/);
 const app=read('src/app.js'),builder=read('tools/build-hosted-shell.mjs');
 assert.match(app,/StationHomeEvidence\?\.mounted\?\.\(section\)/);
 assert.match(app,/station-home-evidence/);
 assert.match(builder,/read\('src\/home-evidence-core.mjs'\)/);
 assert.match(builder,/read\('src\/home-evidence-ui.js'\)/);
});
