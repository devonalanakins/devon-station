/* Source contracts for Home's read-only owner evidence; no browser storage or authority. */
const homeSha=/^[a-f0-9]{40}$/;
export function homeProjectGrant(data){
 if(!data||data.mode!=='read_only'||data.executionEnabled!==false||
    !Array.isArray(data.projects)||data.projects.length>20)throw Error('invalid_project_grants');
 return data.projects.some(p=>p&&p.workspaceId==='software'&&p.projectId==='devon-station'&&p.capability==='read-evidence');
}
export function homeEvidenceSummary(data){
 if(!data||data.command!=='/status'||data.projectId!=='devon-station'||data.workspaceId!=='software'||
    data.readOnly!==true||data.executionClass!=='A0'||data.source!=='github_public_repository_api'||
    typeof data.observedAt!=='string'||!Number.isFinite(Date.parse(data.observedAt))||
    !Array.isArray(data.unknowns)||data.unknowns.length>40||
    data.unknowns.some(x=>typeof x!=='string'||x.length>100))throw Error('invalid_project_evidence');
 const pr=data.selectedPullRequest,ci=data.exactHeadCI;
 if(pr!==null&&pr!==undefined){
  if(!Number.isSafeInteger(pr.number)||pr.number<1||pr.number>999999||
     !homeSha.test(pr.headSha)||pr.draft!==true&&pr.draft!==false||
     typeof pr.url!=='string'||pr.url!=='https://github.com/devonalanakins/devon-station/pull/'+pr.number)throw Error('invalid_pull_request');
  if(ci!==null&&ci!==undefined&&
     (ci.revision!==pr.headSha||!['observed_pass','failed','pending','partial','none_observed','unavailable'].includes(ci.checkSummary)||
      !Number.isSafeInteger(ci.checkTotal)&&ci.checkTotal!==null))throw Error('invalid_exact_head_checks');
 }else if(ci!==null&&ci!==undefined)throw Error('orphan_check_claim');
 if(data.nextAction!==null&&data.nextAction!==undefined&&
    (typeof data.nextAction!=='string'||data.nextAction.length>600))throw Error('invalid_next_action');
 return {
  observedAt:data.observedAt,
  pr:pr?{number:pr.number,draft:pr.draft,headSha:pr.headSha}:null,
  checkSummary:ci?.checkSummary??'unavailable',
  checkTotal:ci?.checkTotal??null,
  unknownCount:data.unknowns.length,
  nextAction:data.nextAction||'Inspect the owning issue for a bounded next task.'
 };
}
export function homeWorkGrants(data){
 if(!data||!Array.isArray(data.projects)||data.projects.length>10||
    data.executionEnabled!==false||data.publicSharing!==false)throw Error('invalid_work_capability');
 const allowed=new Set();
 for(const p of data.projects){
  if(!p||typeof p.slug!=='string'||!/^[a-z0-9-]{1,60}$/.test(p.slug)||
     typeof p.name!=='string'||p.name.length>100||allowed.has(p.slug))throw Error('invalid_work_grants');
  allowed.add(p.slug);
 }
 return allowed;
}
export function homeWorkSummary(data,allowed){
 if(!(allowed instanceof Set)||!allowed.size||!data||!Array.isArray(data.jobs)||
    data.jobs.length>50||data.executionEnabled!==false||data.publicSharing!==false||
    data.nextCursor!==null&&(typeof data.nextCursor!=='string'||data.nextCursor.length>4096))
   throw Error('invalid_work_source');
 const states=new Set(['review','ready','rejected','cancelled']);
 const jobIds=new Set();
 const phases=new Set(['authorized','submitting','running','waiting','unverified','cancel_requested','cancelled','completed','failed','blocked']);
 for(const j of data.jobs){
  if(!j||typeof j!=='object'||!homeWorkId.test(j.jobId)||jobIds.has(j.jobId)||
     !allowed.has(j.projectSlug)||!states.has(j.state)||
     j.execution!==undefined&&(!j.execution||!phases.has(j.execution.phase)))
   throw Error('ungranted_or_invalid_job');
  jobIds.add(j.jobId);
 }
 const reviewable=data.jobs.filter(j=>j.state==='review'&&!j.execution);
 return {observedCount:data.jobs.length,review:reviewable.length,
  ready:data.jobs.filter(j=>j.state==='ready'&&!j.execution).length,
  executionRecords:data.jobs.filter(j=>!!j.execution).length,partial:data.nextCursor!==null,
  reviewPreview:reviewable.slice(0,3).map(j=>({
   jobId:j.jobId,projectSlug:j.projectSlug,
   updatedAt:Number.isSafeInteger(j.updatedAt)&&j.updatedAt>0?j.updatedAt:null,
  }))};
}

const homeScopeId=/^[A-Za-z0-9_-]{1,64}$/;
const homeWorkId=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** Home/Today never select professional, business or client data implicitly. */
export function homePersonalScope(response){
 if(!response||response.execution!=='record_only'||!Array.isArray(response.scopes)||
    response.scopes.length>32)throw Error('invalid_workspace_scopes');
 const seen=new Set(),personal=[];
 for(const s of response.scopes){
  if(!s||typeof s.scopeKind!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(s.scopeKind)||
     !homeScopeId.test(s.scopeId))throw Error('invalid_workspace_scopes');
  const key=s.scopeKind+':'+s.scopeId;
  if(seen.has(key))throw Error('duplicate_workspace_scope');
  seen.add(key);
  if(s.scopeKind==='personal')personal.push({scopeKind:'personal',scopeId:s.scopeId});
 }
 return {status:personal.length===1?'selected':personal.length?'multiple':'none',
  scope:personal.length===1?personal[0]:null};
}
/** A journal record only establishes an owner-reviewed proposal, never execution. */
export function homePersonalDecisions(response,expectedScope){
 if(!expectedScope||expectedScope.scopeKind!=='personal'||!homeScopeId.test(expectedScope.scopeId)||
    !response||response.execution!=='record_only'||!response.scope||
    response.scope.scopeKind!==expectedScope.scopeKind||response.scope.scopeId!==expectedScope.scopeId||
    !Number.isSafeInteger(response.generation)||response.generation<0||
    !Array.isArray(response.projects)||response.projects.length>500||
    !Array.isArray(response.actions)||response.actions.length>500)throw Error('invalid_workspace_decisions');
 const approvedProjects=new Map();
 for(const p of response.projects){
  if(!p||!homeScopeId.test(p.projectId)||typeof p.title!=='string'||!p.title.trim()||
     p.title.length>240||approvedProjects.has(p.projectId))throw Error('invalid_workspace_projects');
  approvedProjects.set(p.projectId,p.title);
 }
 const knownIds=new Set(),proposed=[];
 for(const a of response.actions){
  if(!a||!homeScopeId.test(a.recordId)||knownIds.has(a.recordId)||
     !approvedProjects.has(a.projectId)||!['proposed','approved','rejected'].includes(a.status)||
     typeof a.summary!=='string'||a.summary.length<1||a.summary.length>180||
     !Number.isSafeInteger(a.revision)||a.revision<1)throw Error('invalid_workspace_action');
  knownIds.add(a.recordId);
  if(a.status==='proposed')proposed.push({recordId:a.recordId,projectId:a.projectId,summary:a.summary,project:approvedProjects.get(a.projectId)});
 }
 return {scope:{...expectedScope},generation:response.generation,total:response.actions.length,
  proposedCount:proposed.length,preview:proposed.slice(-3).reverse(),recordOnly:true};
}
