import {parseAssistantCommand} from '../src/assistant-commands.mjs';

// Initial A0-only registry. Every upstream URL is built from an audited literal;
// no browser text, conversation output, or project metadata controls the host.
const PROJECTS=Object.freeze({
 'devon-station':Object.freeze({id:'devon-station',name:'DevonStation',workspaceId:'software',repository:'devonalanakins/devon-station'}),
});
const GITHUB_API='https://api.github.com';
const SHA=/^[a-f0-9]{40}$/;
const fail=(publicCode,status)=>{throw {publicCode,status};};
const exact=(o,keys)=>o&&typeof o==='object'&&!Array.isArray(o)&&
 Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));
const boundedText=(s,max=80)=>typeof s==='string'?s.slice(0,max):null;
function configuration(user,env){
 if(env.ASSISTANT_EVIDENCE_ENABLED!=='true')fail('assistant_disabled',503);
 if(typeof env.ASSISTANT_OWNER_SUB!=='string'||user.subject!==env.ASSISTANT_OWNER_SUB)fail('assistant_scope_denied',403);
 let grants;
 try{
  grants=JSON.parse(env.ASSISTANT_PROJECT_GRANTS_JSON);
  if(!Array.isArray(grants)||grants.length>20||grants.some(g=>
    !exact(g,['subject','workspaceId','projectId','capability'])||
    typeof g.subject!=='string'||typeof g.workspaceId!=='string'||typeof g.projectId!=='string'||
    g.capability!=='read-evidence'||g.workspaceId!=='software'||!Object.hasOwn(PROJECTS,g.projectId)))throw Error();
 }catch{fail('assistant_grants_unavailable',503);}
 return grants.filter(g=>g.subject===user.subject);
}
async function boundedJson(response){
 if(!response||response.status!==200)return null;
 if(!response.headers.get('Content-Type')?.toLowerCase().includes('application/json'))return null;
 if(Number(response.headers.get('Content-Length'))>196608)return null;
 const reader=response.body?.getReader();if(!reader)return null;
 let size=0;const pieces=[];
 try{
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
   if(size>196608){await reader.cancel();return null;}pieces.push(value);}
 }finally{reader.releaseLock();}
 const data=new Uint8Array(size);let offset=0;for(const p of pieces){data.set(p,offset);offset+=p.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data));}catch{return null;}
}
async function githubGet(path,transport,env){
 // The optional token is an independently configured, server-side read-only secret.
 // Never forward it to redirects or return it to the browser.
 const headers={'Accept':'application/vnd.github+json','User-Agent':'DevonStation-evidence/1','X-GitHub-Api-Version':'2022-11-28'};
 if(typeof env.GITHUB_EVIDENCE_TOKEN==='string'&&env.GITHUB_EVIDENCE_TOKEN.length>=10)
  headers.Authorization='Bearer '+env.GITHUB_EVIDENCE_TOKEN;
 try{
  const res=await transport(GITHUB_API+path,{method:'GET',headers,redirect:'manual',signal:AbortSignal.timeout(5000)});
  return await boundedJson(res);
 }catch{return null;}
}
const state=x=>x==='success'||x==='failure'||x==='pending'||x==='error'?x:null;
export async function handleAssistantEvidence({request,url,user,env,transport=fetch}){
 if(request.method!=='GET')fail('method_not_allowed',405);
 const grants=configuration(user,env);
 if(url.pathname==='/api/assistant/projects'){
  if(url.search)fail('invalid_assistant_query',400);
  return {projects:grants.map(g=>PROJECTS[g.projectId]).filter((p,i,list)=>list.indexOf(p)===i).map(p=>({
   projectId:p.id,workspaceId:p.workspaceId,name:p.name,repository:p.repository,capability:'read-evidence'
  })),mode:'read_only',executionEnabled:false};
 }
 if(url.pathname!=='/api/assistant/evidence')fail('not_found',404);
 const keys=[...url.searchParams.keys()];
 if(keys.length!==3||new Set(keys).size!==3||
    keys.some(k=>!['workspaceId','projectId','command'].includes(k)))fail('invalid_assistant_query',400);
 const projectId=url.searchParams.get('projectId'),workspaceId=url.searchParams.get('workspaceId');
 if(!Object.hasOwn(PROJECTS,projectId)||workspaceId!=='software')fail('project_not_authorized',403);
 if(!grants.some(g=>g.projectId===projectId&&g.workspaceId===workspaceId))fail('project_not_authorized',403);
 let command;
 try{command=parseAssistantCommand(url.searchParams.get('command'));}catch{fail('unsupported_assistant_command',400);}
 const project=PROJECTS[projectId],repo='/repos/'+project.repository;
 const observedAt=new Date().toISOString();
 const [repository,branch,pulls]=await Promise.all([
  githubGet(repo,transport,env),githubGet(repo+'/branches/main',transport,env),githubGet(repo+'/pulls?state=open&per_page=30',transport,env)
 ]);
 const mainSha=SHA.test(branch?.commit?.sha)?branch.commit.sha:null;
 const candidates=Array.isArray(pulls)?pulls.filter(p=>Number.isSafeInteger(p?.number)&&p.number>0&&p.number<1000000&&
     SHA.test(p?.head?.sha)&&p.state==='open').map(p=>({
       number:p.number,draft:p.draft===true,headSha:p.head.sha,base:boundedText(p.base?.ref,100),
       updatedAt:Number.isFinite(Date.parse(p.updated_at))?p.updated_at:null
     })).sort((a,b)=>(Date.parse(b.updatedAt||0)||0)-(Date.parse(a.updatedAt||0)||0)):null;
 const pull=candidates?.[0]??null;
 const [status,actions]=pull?await Promise.all([
  githubGet(repo+'/commits/'+pull.headSha+'/status',transport,env),
  githubGet(repo+'/actions/runs?head_sha='+pull.headSha+'&per_page=10',transport,env)
 ]):[null,null];
 const ciStatus=state(status?.state);
 const runs=Array.isArray(actions?.workflow_runs)?actions.workflow_runs.filter(r=>r.head_sha===pull.headSha).map(r=>({
  status:['queued','in_progress','completed'].includes(r.status)?r.status:'unknown',
  conclusion:['success','failure','cancelled','timed_out','action_required','neutral','skipped','startup_failure'].includes(r.conclusion)?r.conclusion:null,
  url:'https://github.com/'+project.repository+'/actions/runs/'+Number(r.id),
 })).filter(r=>!r.url.endsWith('/NaN')).slice(0,10):null;
 const unknowns=[];
 if(!repository||repository.full_name!==project.repository)unknowns.push('repository_metadata_unavailable');
 if(!mainSha)unknowns.push('main_head_unavailable');
 if(!candidates)unknowns.push('pull_requests_unavailable');
 else if(candidates.length===30)unknowns.push('pull_request_list_may_be_partial');
 if(pull&&!ciStatus&&runs===null)unknowns.push('exact_head_checks_unavailable');
 else if(pull&&!ciStatus&&!runs?.length)unknowns.push('no_exact_head_checks_observed');
 if(!pull&&candidates?.length===0)unknowns.push('no_open_pull_requests_observed');
 const failing=runs?.some(x=>['failure','timed_out','startup_failure'].includes(x.conclusion))||ciStatus==='failure'||ciStatus==='error';
 const nextAction=!mainSha?'Confirm the repository main HEAD from GitHub before acting.'
  :!candidates?'Recheck the open pull request list before selecting work.'
  :!pull?'Inspect the approved issue for the next bounded development task.'
  :failing?'Inspect failed exact-head checks on PR #'+pull.number+' before review.'
  :(!ciStatus&&(!runs||!runs.length))?'Verify exact-head CI for PR #'+pull.number+' before review.'
  :'Review PR #'+pull.number+' and its dependency chain before any merge.';
 return {
  command:command.label,executionClass:'A0',readOnly:true,projectId,workspaceId,
  observedAt,source:'github_public_repository_api',repository:project.repository,
  repositoryUrl:'https://github.com/'+project.repository,
  main:mainSha?{revision:mainSha,url:'https://github.com/'+project.repository+'/commit/'+mainSha}:null,
  openPullRequestsObserved:candidates?.length??null,
  selectedPullRequest:pull?{...pull,url:'https://github.com/'+project.repository+'/pull/'+pull.number}:null,
  exactHeadCI:pull?{revision:pull.headSha,commitStatus:ciStatus,workflowRuns:runs}:null,
  unknowns,nextAction,
  limitations:['Read-only public GitHub evidence; no private repository, deployment, merge, or live app verification.'],
 };
}
