import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {CHAIN,REPO,REVIEWED_CANDIDATE_SHA256,evaluateGen2Stack,observeGen2Stack,verifyGen2ReviewArtifact} from '../tools/gen2-release-preflight.mjs';
import {GEN2_MODULES,GEN2_ASSETS} from '../tools/prepare-gen2-review.mjs';

const hash=s=>createHash('sha256').update(s).digest('hex');
const SHA=n=>n.toString(16).padStart(2,'0').repeat(20);
const finalSha=SHA(55);
const checkNames=['verify','workerd','unified-application','test','integrated-worker','access-interop','browser'];
function synthetic(){
 const pulls=CHAIN.map((p,i)=>({
  number:p.number,state:'open',draft:true,merged:false,
  head:{ref:p.branch,sha:SHA(p.number),repo:{full_name:REPO}},
  base:{ref:i?CHAIN[i-1].branch:'feature/ds011-comms18-draft-delivery-lineage',sha:i?SHA(CHAIN[i-1].number):SHA(35),repo:{full_name:REPO}}
 }));
 const checks=CHAIN.map(p=>({
  number:p.number,total_count:p.number===55?checkNames.length:1,
  check_runs:(p.number===55?checkNames:['verify']).map(name=>({
   name,head_sha:SHA(p.number),status:'completed',conclusion:'success'
  }))
 }));
 return {pulls,checks,expectedSourceSha:finalSha,artifact:{
  sourceCommit:finalSha,reviewDigest:REVIEWED_CANDIDATE_SHA256,uploadAuthorized:false
 }};
}
function inspect(v){return evaluateGen2Stack(v);}
function has(v,code){assert(inspect(v).blockers.includes(code),code);}
test('review preflight can inspect a consistent draft chain but NEVER authorize deployment',()=>{
 const r=inspect(synthetic());
 assert.equal(r.readOnly,true);
 assert.equal(r.releaseDecision,'RELEASE_NO_GO');
 assert.equal(r.uploadAuthorized,false);
 assert.equal(r.canDeploy,false);
 assert.equal(r.dependencyCount,12);
 assert.equal(r.observed.length,12);
 assert.equal(r.observed.at(-1).checks,'observed_success');
 assert.equal(r.blockers.filter(x=>x.startsWith('stale_parent_')).length,0);
 assert(r.blockers.includes('root_ancestry_before_pr_36_unreviewed'));
 assert(r.blockers.includes('protected_uploader_not_established'));
 assert(r.blockers.includes('owner_approval_not_present'));
 assert(r.blockers.includes('draft_pr_55'));
});
test('stale parent, owner/repo boundary and exact source drift are visible',()=>{
 let f=synthetic();f.pulls.at(-1).base.sha=SHA(1);has(f,'stale_parent_55');
 f=synthetic();f.pulls[5].head.repo.full_name='untrusted/fork';has(f,'invalid_pr_48');
 f=synthetic();f.pulls.at(-1).head.sha=SHA(1);has(f,'candidate_head_drift');
 f=synthetic();f.pulls[6].head.ref='wrong-branch';has(f,'invalid_pr_49');
 f=synthetic();f.pulls[1].state='closed';has(f,'invalid_pr_42');
});
test('missing, duplicated, unfinished and failing exact-head checks block review',()=>{
 let f=synthetic();f.checks.pop();has(f,'incomplete_checks_55');
 f=synthetic();f.checks.at(-1).check_runs[0].conclusion='failure';has(f,'failing_or_unverified_checks_55');
 f=synthetic();f.checks.at(-1).check_runs[0].status='in_progress';has(f,'failing_or_unverified_checks_55');
 f=synthetic();f.checks.at(-1).check_runs[0].conclusion='skipped';has(f,'failing_or_unverified_checks_55');
 f=synthetic();f.checks.at(-1).check_runs[0].head_sha=SHA(13);has(f,'failing_or_unverified_checks_55');
 f=synthetic();f.checks.at(-1).check_runs.pop();has(f,'incomplete_checks_55');
 f=synthetic();f.checks.at(-1).check_runs[0].name='unsafe';has(f,'failing_or_unverified_checks_55');
 f=synthetic();f.checks.at(-1).check_runs[1].name=f.checks.at(-1).check_runs[0].name;has(f,'failing_or_unverified_checks_55');
});
test('artifact mismatch, missing evidence and duplicate inputs remain NO_GO',()=>{
 let f=synthetic();f.artifact=null;has(f,'review_artifact_not_verified');
 f=synthetic();f.artifact.reviewDigest=hash('forged');has(f,'review_artifact_source_drift');
 f=synthetic();f.artifact.sourceCommit=SHA(1);has(f,'review_artifact_source_drift');
 f=synthetic();f.pulls.push({...f.pulls[0]});has(f,'duplicate_or_invalid_pr');
 f=synthetic();f.checks.push({...f.checks[0]});has(f,'duplicate_or_invalid_checks');
 assert.throws(()=>inspect({...synthetic(),expectedSourceSha:'invalid'}),/preflight refused/);
});
function artifact(){
 const modules=Object.fromEntries(GEN2_MODULES.map(name=>[name,'// synthetic module '+name]));
 const assets=Object.fromEntries(GEN2_ASSETS.map(name=>{
  const binary=name.endsWith('.png');
  const bytes=Buffer.from(name==='/index.html'?'<main>"privateDataLoaded":false</main>':name);
  return [name,{type:binary?'image/png':'text/plain;charset=utf-8',encoding:binary?'base64':'utf8',
   body:bytes.toString(binary?'base64':'utf8')}];
 }));
 modules['index.mjs']="import {connect} from 'cloudflare:sockets';\n"+
  "import {createStation} from './worker/index.mjs';\n"+
  "const assets="+JSON.stringify(assets)+";\n"+
  "export default createStation(assets,undefined,undefined,connect);\n";
 modules['worker/index.mjs']="if(url.pathname.startsWith('/api/assistant/')) return fake;\n";
 modules['worker/assistant-evidence.mjs']="const ASSISTANT_EVIDENCE_ENABLED=true;\n";
 const candidateBytes=Buffer.from(JSON.stringify(modules));
 const sourceCommit=SHA(55),reviewDigest=hash(candidateBytes);
 const manifest={
  schemaVersion:1,status:'SOURCE_REVIEW_ONLY_NEVER_UPLOAD',
  sourceRepository:REPO,sourceCommit,uploadAuthorized:false,mergeAuthorized:false,
  productionVerified:false,
  candidate:{sha256:reviewDigest,moduleCount:48,assetCount:7,
   moduleDigests:Object.fromEntries(GEN2_MODULES.map(name=>[name,hash(modules[name])])),
   assetDigests:Object.fromEntries(GEN2_ASSETS.map(name=>[name,hash(Buffer.from(assets[name].body,assets[name].encoding))]))}
 };
 return {manifest,candidateBytes,sourceCommit,reviewDigest};
}
test('offline artifact reader verifies exact whole-file and per-module hashes',()=>{
 const value=artifact(),ok=verifyGen2ReviewArtifact(value);
 assert.equal(ok.uploadAuthorized,false);
 assert.equal(ok.moduleCount,48);
 assert.equal(ok.reviewDigest,value.reviewDigest);
 const damaged={...value,candidateBytes:Buffer.from(value.candidateBytes)};
 damaged.candidateBytes[10]^=1;
 assert.throws(()=>verifyGen2ReviewArtifact(damaged),/digest mismatch/);
 assert.throws(()=>verifyGen2ReviewArtifact({...value,reviewDigest:hash('different')}),/digest mismatch/);
 const wrongAsset=artifact();
 wrongAsset.manifest.candidate.assetDigests['/index.html']=hash('forged asset contents');
 assert.throws(()=>verifyGen2ReviewArtifact(wrongAsset),/hosted asset digest mismatch/);
 const secret={...value,manifest:{...value.manifest,uploadAuthorized:true}};
 assert.throws(()=>verifyGen2ReviewArtifact(secret),/provenance invalid/);
 const extra=artifact();const decoded=JSON.parse(extra.candidateBytes.toString());decoded['extra.mjs']='unreviewed';
 extra.candidateBytes=Buffer.from(JSON.stringify(decoded));extra.reviewDigest=hash(extra.candidateBytes);
 extra.manifest.candidate.sha256=extra.reviewDigest;
 assert.throws(()=>verifyGen2ReviewArtifact(extra),/module or asset inventory/);
});
test('read-only provider connector accepts ONLY fixed GitHub GETs with no redirects',async()=>{
 const fixture=synthetic(),calls=[];
 const response=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}});
 const byNumber=new Map(fixture.pulls.map(p=>[p.number,p]));
 const bySha=new Map(fixture.checks.map(c=>[fixture.pulls.find(p=>p.number===c.number).head.sha,c]));
 const fetchImpl=async(url,options)=>{
  calls.push(url);
  assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');
  assert(url.startsWith('https://api.github.com/repos/'+REPO+'/'));
  let match=/\/pulls\/([0-9]+)$/.exec(url);
  if(match){const p=byNumber.get(Number(match[1]));return response({...p,merged_at:null});}
  match=/\/commits\/([a-f0-9]{40})\/check-runs\?per_page=100$/.exec(url);
  if(match)return response(bySha.get(match[1]));
  throw Error('unexpected URL: '+url);
 };
 const data=await observeGen2Stack({request:fetchImpl});
 assert.equal(calls.length,CHAIN.length*2);
 assert.equal(inspect({...data,expectedSourceSha:finalSha,artifact:fixture.artifact}).releaseDecision,'RELEASE_NO_GO');
 assert(!calls.some(x=>/upload|versions|deployments|secrets/.test(x)));
});
test('remote forged head SHA or provider redirect is rejected before unrelated API lookup',async()=>{
 let requests=0;
 const forged=async()=>{
  requests++;
  return new Response(JSON.stringify({number:36,head:{sha:'../secrets'},merged_at:null}),
   {headers:{'Content-Type':'application/json'}});
 };
 await assert.rejects(observeGen2Stack({request:forged}),/invalid PR head/);
 assert.equal(requests,1);
 const redirect=async()=>{
  requests++;
  return new Response('',{status:302,headers:{Location:'https://attacker.invalid/'}});
 };
 await assert.rejects(observeGen2Stack({request:redirect}),/untrusted GitHub read response/);
 assert.equal(requests,2);
});
