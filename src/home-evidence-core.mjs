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
 const phases=new Set(['authorized','submitting','running','waiting','unverified','cancel_requested','cancelled','completed','failed','blocked']);
 for(const j of data.jobs){
  if(!j||typeof j!=='object'||!allowed.has(j.projectSlug)||!states.has(j.state)||
     j.execution!==undefined&&(!j.execution||!phases.has(j.execution.phase)))
   throw Error('ungranted_or_invalid_job');
 }
 return {observedCount:data.jobs.length,review:data.jobs.filter(j=>j.state==='review').length,
  ready:data.jobs.filter(j=>j.state==='ready').length,
  executionRecords:data.jobs.filter(j=>!!j.execution).length,partial:data.nextCursor!==null};
}
