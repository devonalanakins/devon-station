import test from 'node:test';
import assert from 'node:assert/strict';
import {createStation} from '../worker/index.mjs';

const origin='https://station.example.test';
const owner={subject:'owner-sub',email:'owner@example.test'};
const grant={subject:'owner-sub',workspaceId:'software',projectId:'devon-station',capability:'read-evidence'};
const env={APP_ORIGIN:origin,OWNER_EMAIL:owner.email,ASSISTANT_EVIDENCE_ENABLED:'true',
 ASSISTANT_OWNER_SUB:owner.subject,ASSISTANT_PROJECT_GRANTS_JSON:JSON.stringify([grant])};
const head='b'.repeat(40),main='a'.repeat(40),root='https://api.github.com/repos/devonalanakins/devon-station';
const expected={
 [root]:{full_name:'devonalanakins/devon-station',default_branch:'main'},
 [root+'/branches/main']:{commit:{sha:main}},
 [root+'/pulls?state=open&per_page=30']:[{number:52,draft:true,state:'open',head:{sha:head},base:{ref:'feature/studio'},updated_at:'2026-11-08T21:00:00Z',title:'<img src=x onerror=alert(1)>'}],
 [root+'/commits/'+head+'/status']:{state:'pending',statuses:[],total_count:0},
 [root+'/actions/runs?head_sha='+head+'&per_page=10']:{total_count:1,workflow_runs:[{id:12345,head_sha:head,status:'completed',conclusion:'success'}]},
 [root+'/commits/'+head+'/check-runs?per_page=100']:{total_count:2,check_runs:[{name:'verify',head_sha:head,status:'completed',conclusion:'success'},{name:'public-snapshot',head_sha:head,status:'completed',conclusion:'skipped'}]}
};
const response=body=>new Response(JSON.stringify(body),{status:200,headers:{'Content-Type':'application/json'}});
function fixture({subject=owner.subject,source=expected,token}={}){
 const calls=[],transport=async(url,options)=>{
  calls.push(url);assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert(options.signal);
  assert.equal(options.headers.Authorization,token?'Bearer '+token:undefined);
  assert(url.startsWith(root)&&Object.hasOwn(source,url),'unexpected outbound URL: '+url);
  return response(source[url]);
 };
 return {app:createStation({},async()=>({...owner,subject}),transport),calls};
}
const get=(path='projects')=>new Request(origin+'/api/assistant/'+path);
const evidence='evidence?workspaceId=software&projectId=devon-station&command=%2Fstatus';
test('approved owner reads exactly scoped project allowlist without network or execution',async()=>{
 const {app,calls}=fixture();
 const r=await app.fetch(get(),env,{});
 assert.equal(r.status,200);
 assert.deepEqual((await r.json()).projects,[{projectId:'devon-station',workspaceId:'software',name:'DevonStation',
  repository:'devonalanakins/devon-station',capability:'read-evidence'}]);assert.equal(calls.length,0);
});
test('real structured GitHub evidence is bounded, source-backed and never upgrades to LIVE',async()=>{
 const {app,calls}=fixture({token:'test-read-only-token'});
 const r=await app.fetch(get(evidence),{...env,GITHUB_EVIDENCE_TOKEN:'test-read-only-token'},{});
 assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.command,'/status');assert.equal(data.executionClass,'A0');assert.equal(data.readOnly,true);
 assert.equal(data.main.revision,main);assert.equal(data.selectedPullRequest.number,52);
 assert.equal(data.selectedPullRequest.headSha,head);assert.equal(data.exactHeadCI.revision,head);
 assert.equal(data.exactHeadCI.commitStatus,null);assert.equal(data.exactHeadCI.legacyStatus,'none_reported');
 assert.equal(data.exactHeadCI.checkSummary,'observed_pass');assert.equal(data.exactHeadCI.checkTotal,2);
 assert.deepEqual(data.exactHeadCI.checkRuns.map(r=>r.conclusion),['success','skipped']);
 assert.equal(data.exactHeadCI.workflowRuns[0].conclusion,'success');
 assert.match(data.nextAction,/Review PR #52/);assert.equal(data.openPullRequestsObserved,1);assert.equal(calls.length,6);
 assert.doesNotMatch(JSON.stringify(data),/onerror|<img|test-read-only-token|deployment succeeded|\"status\":\"LIVE\"/i);
 const follow=await app.fetch(get(evidence.replace('%2Fstatus','%2Fcontinue')),env,{});
 assert.equal((await follow.json()).command,'/continue');
});
test('unknown source or checks remain unavailable and cannot be fabricated',async()=>{
 const source={...expected,[root+'/branches/main']:null,[root+'/pulls?state=open&per_page=30']:null,
  [root+'/commits/'+head+'/status']:null,[root+'/actions/runs?head_sha='+head+'&per_page=10']:null};
 const {app}=fixture({source});
 const r=await app.fetch(get(evidence),env,{}),result=await r.json();
 assert.equal(r.status,200);assert.equal(result.main,null);
 assert.equal(result.selectedPullRequest,null);assert.equal(result.exactHeadCI,null);
 assert(result.unknowns.includes('main_head_unavailable'));assert(result.unknowns.includes('pull_requests_unavailable'));
 assert.match(result.nextAction,/Confirm the repository main HEAD/);
});
test('scope, owner, command, method, query and feature flag are fail-closed before fetching',async()=>{
 const {app,calls}=fixture();
 const paths=[
  'evidence?workspaceId=professional&projectId=devon-station&command=%2Fstatus',
  'evidence?workspaceId=software&projectId=private-client&command=%2Fstatus',
  'evidence?workspaceId=software&projectId=devon-station&command=%2Fexecute',
  'evidence?workspaceId=software&projectId=devon-station&command=%2Fstatus&command=%2Fcontinue',
  'evidence?workspaceId=software&projectId=devon-station&command=%2Fstatus&url=https%3A%2F%2Fevil.example',
  'evidence?workspaceId=software&projectId=devon-station&command=%2Fstatus%0A%2Fexecute',
 ];
 for(const path of paths){const r=await app.fetch(get(path),env,{});assert([400,403].includes(r.status),path);}
 const post=new Request(origin+'/api/assistant/projects',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal((await app.fetch(post,env,{})).status,405);
 assert.equal((await app.fetch(get(),{...env,ASSISTANT_EVIDENCE_ENABLED:'false'},{})).status,503);
 assert.equal((await app.fetch(get(),{...env,ASSISTANT_PROJECT_GRANTS_JSON:'{"unsafe":true}'},{})).status,503);
 assert.equal((await app.fetch(get(),{...env,ASSISTANT_PROJECT_GRANTS_JSON:'[]'},{})).status,200);
 assert.equal((await app.fetch(get(evidence),{...env,ASSISTANT_PROJECT_GRANTS_JSON:'[]'},{})).status,403);
 assert.equal(calls.length,0);
 const outsider=fixture({subject:'different-owner'});
 assert.equal((await outsider.app.fetch(get(),env,{})).status,403);
 assert.equal(outsider.calls.length,0);
 const denied=createStation({},async()=>({...owner,email:'other@example.test'}),async()=>{throw Error('No network');});
 assert.equal((await denied.fetch(get(),env,{})).status,403);
});
test('provider redirect, 500, HTML, oversized output and forged run revision are not trusted',async()=>{
 let callCount=0;const transport=async(url,options)=>{
  callCount++;assert.equal(options.redirect,'manual');
  if(url.endsWith('/branches/main'))return new Response('',{status:302,headers:{Location:'https://evil.example.test/collect'}});
  if(url.endsWith('/pulls?state=open&per_page=30'))return response(expected[url]);
  if(url.includes('/commits/'))return new Response('<html>success</html>',{status:200,headers:{'Content-Type':'text/html'}});
  if(url.includes('/actions/runs?'))return response({workflow_runs:[{id:99,head_sha:'c'.repeat(40),status:'completed',conclusion:'success'}]});
  return new Response('provider failure',{status:500});
 };
 const app=createStation({},async()=>owner,transport);
 const r=await app.fetch(get(evidence),env,{}),data=await r.json();
 assert.equal(r.status,200);assert.equal(callCount,6);
 assert.equal(data.main,null);assert.equal(data.exactHeadCI.commitStatus,null);
 assert.equal(data.exactHeadCI.checkSummary,'unavailable');
 assert.deepEqual(data.exactHeadCI.workflowRuns,[]);assert(data.unknowns.includes('check_runs_unavailable'));
 assert(data.unknowns.includes('no_workflow_runs_observed'));
 assert.equal(data.selectedPullRequest.url,'https://github.com/devonalanakins/devon-station/pull/52');
});


test('failed check outranks an all-green workflow and empty legacy statuses',async()=>{
 const source={...expected,
  [root+'/commits/'+head+'/check-runs?per_page=100']:{total_count:2,check_runs:[
   {name:'verification',head_sha:head,status:'completed',conclusion:'failure'},
   {name:'security',head_sha:head,status:'completed',conclusion:'success'}]}};
 const {app}=fixture({source});const r=await app.fetch(get(evidence),env,{});
 assert.equal(r.status,200);const data=await r.json();
 assert.equal(data.exactHeadCI.checkSummary,'failed');
 assert.match(data.nextAction,/Inspect failed exact-head checks/);
});

test('in-progress, stale-head, partial and unavailable checks do not imply readiness',async()=>{
 const checkKey=root+'/commits/'+head+'/check-runs?per_page=100';
 const cases=[
  [{total_count:1,check_runs:[{name:'still running',head_sha:head,status:'in_progress',conclusion:null}]},'pending',null],
  [{total_count:2,check_runs:[{name:'correct',head_sha:head,status:'completed',conclusion:'success'},
   {name:'foreign',head_sha:'c'.repeat(40),status:'completed',conclusion:'failure'}]},'partial','check_runs_partial'],
  [{total_count:101,check_runs:Array.from({length:100},(_,i)=>({name:'check'+i,head_sha:head,status:'completed',conclusion:'success'}))},'partial','check_runs_partial'],
  [null,'unavailable','check_runs_unavailable'],
 ];
 for(const [value,expectedSummary,unknown] of cases){
  const {app}=fixture({source:{...expected,[checkKey]:value}});
  const result=await (await app.fetch(get(evidence),env,{})).json();
  assert.equal(result.exactHeadCI.checkSummary,expectedSummary);
  assert.match(result.nextAction,/Recheck exact-head CI/);
  if(unknown)assert(result.unknowns.includes(unknown));
 }
});

test('legacy status failure is not concealed by successful modern checks',async()=>{
 const source={...expected,[root+'/commits/'+head+'/status']:{state:'failure',statuses:[{state:'failure'}]}};
 const {app}=fixture({source});const data=await(await app.fetch(get(evidence),env,{})).json();
 assert.equal(data.exactHeadCI.commitStatus,'failure');
 assert.equal(data.exactHeadCI.legacyStatus,'failure');
 assert.match(data.nextAction,/Inspect failed exact-head checks/);
});

test('invalid run IDs and mismatched SHA never produce links or false passing checks',async()=>{
 const source={...expected,
  [root+'/actions/runs?head_sha='+head+'&per_page=10']:{total_count:3,workflow_runs:[
   {id:-1,head_sha:head,status:'completed',conclusion:'success'},
   {id:'unsafe',head_sha:head,status:'completed',conclusion:'success'},
   {id:212,head_sha:'c'.repeat(40),status:'completed',conclusion:'success'}]},
  [root+'/commits/'+head+'/check-runs?per_page=100']:{total_count:1,check_runs:[
   {name:'spoof',head_sha:'c'.repeat(40),status:'completed',conclusion:'success'}]}};
 const {app}=fixture({source});const data=await(await app.fetch(get(evidence),env,{})).json();
 assert.deepEqual(data.exactHeadCI.workflowRuns,[]);
 assert.equal(data.exactHeadCI.checkSummary,'partial');
 assert(data.unknowns.includes('workflow_runs_may_be_partial'));
 assert(data.unknowns.includes('check_runs_partial'));
 assert.match(data.nextAction,/Recheck exact-head CI/);
 assert.doesNotMatch(JSON.stringify(data),/actions\/runs\/NaN|actions\/runs\/-1/);
});


test('an explicit pending legacy status prevents review advice even if Checks API passes',async()=>{
 const source={...expected,[root+'/commits/'+head+'/status']:{state:'pending',statuses:[{state:'pending'}]}};
 const {app}=fixture({source});const result=await(await app.fetch(get(evidence),env,{})).json();
 assert.equal(result.exactHeadCI.legacyStatus,'pending');
 assert.match(result.nextAction,/Recheck exact-head CI/);
});

test('missing legacy statuses and completed checks without conclusions remain unverified',async()=>{
 const source={...expected,
  [root+'/commits/'+head+'/status']:{state:'success'},
  [root+'/commits/'+head+'/check-runs?per_page=100']:{total_count:1,check_runs:[
   {name:'incomplete',head_sha:head,status:'completed',conclusion:null}]}};
 const {app}=fixture({source});const result=await(await app.fetch(get(evidence),env,{})).json();
 assert.equal(result.exactHeadCI.legacyStatus,'unavailable');
 assert.equal(result.exactHeadCI.checkSummary,'pending');
 assert(result.unknowns.includes('legacy_status_unavailable'));
 assert.match(result.nextAction,/Recheck exact-head CI/);
});

test('unpaginated workflow evidence is explicitly partial when total count is absent',async()=>{
 const source={...expected,[root+'/actions/runs?head_sha='+head+'&per_page=10']:{workflow_runs:expected[root+'/actions/runs?head_sha='+head+'&per_page=10'].workflow_runs}};
 const {app}=fixture({source});const result=await(await app.fetch(get(evidence),env,{})).json();
 assert(result.unknowns.includes('workflow_runs_may_be_partial'));
 assert.match(result.nextAction,/Recheck exact-head CI/);
});
