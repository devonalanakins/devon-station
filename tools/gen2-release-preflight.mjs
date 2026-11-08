/**
 * DS011 Generation 2: READ-ONLY review gate. Never uploads, deploys, grants access
 * or authorizes a release. A future privileged workflow must have its own trusted
 * checkout, independently reviewed approval, resource isolation and restore gates.
 */
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {verifiedSourceCommit} from './prepare-rb01-review.mjs';
import {GEN2_MODULES,GEN2_ASSETS} from './prepare-gen2-review.mjs';

export const REPO='devonalanakins/devon-station';
// Pinned branches are source identity checks, NOT a claim that these drafts
// have been approved. This chain begins at #36; ancestors below #36 require
// separate review before any release can become eligible.
export const CHAIN=Object.freeze([
 [36,'feature/ds011-comms19-draft-delivery-reconciliation'],
 [42,'feature/ds011-comms52-offline-mail-recovery'],
 [43,'feature/ds011-mail-reply-draft'],
 [44,'feature/ds011-comms62-inbox-page-filter'],
 [47,'feature/ds011-ai-work02-owner-console'],
 [48,'feature/ds011-ai-work03-durable-controller'],
 [49,'feature/ds011-studio01-local-host'],
 [50,'feature/ds011-studio02-theia-desktop'],
 [51,'feature/ds011-studio03-host-hardening'],
 [52,'feature/ds011-studio04-local-verify'],
 [54,'feature/ds011-gen2-assistant-evidence-01'],
 [55,'feature/ds011-gen2-release-preflight-01']
].map(([number,branch])=>Object.freeze({number,branch})));
export const REVIEWED_CANDIDATE_SHA256='a08f8e7162561b58288c7f20b46481b12f021add3d52444cdf74cb3a48696465';
const SHA=/^[a-f0-9]{40}$/;
const DIGEST=/^[a-f0-9]{64}$/;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const keysEqual=(obj,keys)=>object(obj)&&Object.keys(obj).length===keys.length&&keys.every(k=>Object.hasOwn(obj,k));
const refusal=message=>{throw Error('DS011 Gen2 preflight refused: '+message);};

// This verifies a *review-only* artifact against a digest supplied independently
// by trusted caller code. It cannot convert a review artifact to an upload approval.
export function verifyGen2ReviewArtifact({manifest,candidateBytes,sourceCommit,reviewDigest}){
 if(!SHA.test(sourceCommit)||!DIGEST.test(reviewDigest))refusal('missing independently pinned source/digest');
 if(!object(manifest)||manifest.schemaVersion!==1||manifest.status!=='SOURCE_REVIEW_ONLY_NEVER_UPLOAD'||
    manifest.sourceRepository!==REPO||manifest.sourceCommit!==sourceCommit||
    manifest.uploadAuthorized!==false||manifest.mergeAuthorized!==false||
    manifest.productionVerified!==false)refusal('review-only source provenance invalid');
 const candidate=Buffer.isBuffer(candidateBytes)?candidateBytes:
  candidateBytes instanceof Uint8Array?Buffer.from(candidateBytes):null;
 if(!candidate||candidate.length<100||candidate.length>4*1024*1024)refusal('invalid candidate bytes');
 if(hash(candidate)!==reviewDigest||manifest.candidate?.sha256!==reviewDigest)
  refusal('independently pinned candidate digest mismatch');
 let modules;
 try{modules=JSON.parse(candidate.toString('utf8'));}catch{refusal('invalid candidate JSON');}
 if(!keysEqual(modules,GEN2_MODULES)||manifest.candidate.moduleCount!==GEN2_MODULES.length||
    manifest.candidate.assetCount!==GEN2_ASSETS.length||
    !keysEqual(manifest.candidate.moduleDigests,GEN2_MODULES)||
    !keysEqual(manifest.candidate.assetDigests,GEN2_ASSETS))
  refusal('unreviewed module or asset inventory');
 for(const name of GEN2_MODULES){
  if(typeof modules[name]!=='string'||hash(modules[name])!==manifest.candidate.moduleDigests[name])
   refusal('candidate module checksum mismatch');
 }
 // A public review tool checks structure; a future privileged uploader MUST
 // independently bind this to reviewed, trusted exact-head code and runtime.
 if(!modules['index.mjs'].startsWith("import {connect} from 'cloudflare:sockets';\n")||
    !modules['index.mjs'].endsWith("export default createStation(assets,undefined,undefined,connect);\n")||
    !modules['worker/index.mjs'].includes("if(url.pathname.startsWith('/api/assistant/'))")||
    !modules['worker/assistant-evidence.mjs'].includes("ASSISTANT_EVIDENCE_ENABLED"))
  refusal('expected locked entry and capability boundary absent');
 return Object.freeze({sourceCommit,reviewDigest,moduleCount:GEN2_MODULES.length,assetCount:GEN2_ASSETS.length,uploadAuthorized:false});
}

const REQUIRED_FINAL_CHECKS=Object.freeze(['verify','workerd','unified-application','test','integrated-worker','access-interop','browser']);
// Snapshots are evidence of GitHub API observations, not a signature or merge
// authorization. The production release decision is explicitly always NO_GO.
export function evaluateGen2Stack({pulls,checks,expectedSourceSha,artifact=null}){
 if(!SHA.test(expectedSourceSha)||!Array.isArray(pulls)||!Array.isArray(checks))refusal('missing exact-head evidence');
 const blockers=[],observations=[];
 const byNumber=new Map();
 for(const p of pulls){if(!Number.isSafeInteger(p?.number)||byNumber.has(p.number))blockers.push('duplicate_or_invalid_pr');
  else byNumber.set(p.number,p);}
 const checksByNumber=new Map();
 for(const c of checks){if(!Number.isSafeInteger(c?.number)||checksByNumber.has(c.number))blockers.push('duplicate_or_invalid_checks');
  else checksByNumber.set(c.number,c);}
 let previous=null;
 for(const [i,expected] of CHAIN.entries()){
  const p=byNumber.get(expected.number);
  if(!p||p.state!=='open'||p.head?.repo?.full_name!==REPO||p.base?.repo?.full_name!==REPO||
     p.head?.ref!==expected.branch||!SHA.test(p.head?.sha)||!SHA.test(p.base?.sha)){
   blockers.push('invalid_pr_'+expected.number);
   previous=null;continue;
  }
  const parent=previous;
  if(parent&&(p.base.ref!==parent.head.ref||p.base.sha!==parent.head.sha))
   blockers.push('stale_parent_'+expected.number);
  previous=p;
  if(p.draft!==false)blockers.push('draft_pr_'+expected.number);
  if(p.merged===true)blockers.push('merged_pr_snapshot_'+expected.number);
  const result=checksByNumber.get(expected.number);
  const rows=Array.isArray(result?.check_runs)?result.check_runs:null;
  if(!rows||!Number.isSafeInteger(result.total_count)||
     result.total_count!==rows.length||rows.length===0||rows.length>100){
   blockers.push('incomplete_checks_'+expected.number);
   observations.push({pr:expected.number,head:p.head.sha,checks:'unavailable'});continue;
  }
  const named=new Set(),bad=[];
  for(const c of rows){
   if(c?.head_sha!==p.head.sha||typeof c.name!=='string'||!c.name||
      named.has(c.name)||c.status!=='completed'||!['success','skipped','neutral'].includes(c.conclusion)||
      (c.conclusion==='skipped'&&c.name!=='public-source-snapshot')){
    bad.push(c?.name||'invalid');continue;
   }
   named.add(c.name);
  }
  if(i===CHAIN.length-1&&REQUIRED_FINAL_CHECKS.some(name=>!named.has(name)))
   bad.push('required_final_check_missing');
  if(bad.length)blockers.push('failing_or_unverified_checks_'+expected.number);
  observations.push({pr:expected.number,head:p.head.sha,checks:bad.length?'unverified':'observed_success',count:rows.length});
 }
 const last=byNumber.get(CHAIN.at(-1).number);
 if(last?.head?.sha!==expectedSourceSha)blockers.push('candidate_head_drift');
 if(byNumber.size!==CHAIN.length||checksByNumber.size!==CHAIN.length)blockers.push('unexpected_stack_entries');
 if(!artifact)blockers.push('review_artifact_not_verified');
 else if(artifact.sourceCommit!==expectedSourceSha||artifact.reviewDigest!==REVIEWED_CANDIDATE_SHA256||
         artifact.uploadAuthorized!==false)blockers.push('review_artifact_source_drift');
 blockers.push('root_ancestry_before_pr_36_unreviewed','owner_approval_not_present',
  'protected_uploader_not_established','isolated_recovery_not_verified',
  'physical_iphone_acceptance_not_verified','production_release_not_authorized');
 return Object.freeze({
  reportVersion:1,scope:'DS011_GEN2_SOURCE_ONLY',readOnly:true,
  sourceCommit:expectedSourceSha,candidateDigest:REVIEWED_CANDIDATE_SHA256,
  chainStart:36,chainEnd:CHAIN.at(-1).number,dependencyCount:CHAIN.length,
  observed:observations,blockers:[...new Set(blockers)],releaseDecision:'RELEASE_NO_GO',
  uploadAuthorized:false,canDeploy:false
 });
}

async function getJson(url,token,request=fetch){
 if(!url.startsWith('https://api.github.com/repos/'+REPO+'/'))refusal('unexpected provider endpoint');
 const headers={'Accept':'application/vnd.github+json','User-Agent':'DevonStation-Gen2-readonly-preflight/1',
  'X-GitHub-Api-Version':'2022-11-28'};
 if(token)headers.Authorization='Bearer '+token;
 let response;
 try{response=await request(url,{method:'GET',headers,redirect:'manual',signal:AbortSignal.timeout(6500)});}
 catch{refusal('GitHub read unavailable');}
 if(response.status!==200||!response.headers.get('Content-Type')?.includes('application/json')||
    Number(response.headers.get('Content-Length'))>1024*1024)refusal('untrusted GitHub read response');
 let data;
 try{
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength>1024*1024)refusal('oversized GitHub response');
  data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch{refusal('invalid GitHub JSON');}
 return data;
}
export async function observeGen2Stack({token='',request=fetch}={}){
 const pulls=[],checks=[];
 // Bounded, fixed-host, GET-only discovery. No broad issue search, arbitrary
 // endpoints, provider mutation, private business records or tooling execution.
 for(const {number} of CHAIN){
  const p=await getJson('https://api.github.com/repos/'+REPO+'/pulls/'+number,token,request);
  pulls.push({number:p.number,state:p.state,draft:p.draft,merged:p.merged_at!==null,
   head:{ref:p.head?.ref,sha:p.head?.sha,repo:{full_name:p.head?.repo?.full_name}},
   base:{ref:p.base?.ref,sha:p.base?.sha,repo:{full_name:p.base?.repo?.full_name}}});
  const check=await getJson('https://api.github.com/repos/'+REPO+'/commits/'+p.head?.sha+'/check-runs?per_page=100',token,request);
  checks.push({number,total_count:check.total_count,
   check_runs:Array.isArray(check.check_runs)?check.check_runs.map(c=>({
    name:c.name,head_sha:c.head_sha,status:c.status,conclusion:c.conclusion})):null});
 }
 return {pulls,checks};
}

async function main(){
 if(process.argv.length!==3||process.argv[2]!=='--report'||process.env.GITHUB_REPOSITORY!==REPO)
  refusal('read-only --report in the owning repository only');
 const actualHead=await verifiedSourceCommit();
 if(actualHead!==process.env.GEN2_EXPECTED_SOURCE_HEAD)refusal('checkout differs from triggering head');
 const root=fileURLToPath(new URL('../',import.meta.url));
 const [candidateBytes,manifestText]=await Promise.all([
  readFile(root+'release-review/gen2/candidate.modules.json'),
  readFile(root+'release-review/gen2/manifest.json','utf8')
 ]);
 const artifact=verifyGen2ReviewArtifact({manifest:JSON.parse(manifestText),candidateBytes,
  sourceCommit:actualHead,reviewDigest:REVIEWED_CANDIDATE_SHA256});
 const observed=await observeGen2Stack({token:process.env.GITHUB_TOKEN||''});
 const report=evaluateGen2Stack({...observed,expectedSourceSha:actualHead,artifact});
 console.log(JSON.stringify(report,null,2));
 // A well-formed NO_GO report succeeds so review CI can display blockers.
 // It is NEVER an approval, regardless of report contents.
}
if(process.argv[1]&&fileURLToPath(new URL('file://'+process.argv[1]))===fileURLToPath(import.meta.url))
 await main();
