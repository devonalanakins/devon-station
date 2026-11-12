/* Home evidence reads only already-authorized same-origin APIs. No execution or cached secrets. */
globalThis.StationHomeEvidence=(()=>{
 'use strict';
 let active=null,epoch=0;
 const get=(root,id)=>root.querySelector('#'+id);
 const text=(tag,value,cls)=>{
  const element=document.createElement(tag);element.textContent=String(value??'');
  if(cls)element.className=cls;return element;
 };
 const status=(slot,kind,message)=>{
  slot.dataset.state=kind;slot.setAttribute('aria-busy','false');
  slot.querySelector('.he-result').textContent=message;
  slot.querySelector('.he-detail').replaceChildren();
 };
 const detail=(slot,...elements)=>slot.querySelector('.he-detail').append(...elements);
 function failure(error){
  if(error?.name==='AbortError')return null;
  if(error?.kind==='auth')return ['sign-in','Sign in with the authorized owner identity to check this source.'];
  if(error?.kind==='denied')return ['denied','Access to this source was denied. No records were loaded.'];
  if(error?.kind==='unavailable')return ['unavailable','This source is not configured or temporarily unavailable on this host.'];
  if(error?.kind==='invalid')return ['invalid','The source response could not be verified. Nothing is presented as current.'];
  return ['network','Source request failed. Check your connection and refresh.'];
 }
 async function read(path,signal){
  const response=await fetch(path,{method:'GET',credentials:'same-origin',cache:'no-store',redirect:'manual',signal});
  if(response.status===401||response.type==='opaqueredirect'||response.redirected||
     response.status>=300&&response.status<400)throw {kind:'auth'};
  if(response.status===403)throw {kind:'denied'};
  if(response.status===503)throw {kind:'unavailable'};
  if(!response.ok||!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')||
     Number(response.headers.get('Content-Length'))>131072)throw {kind:'invalid'};
  // Reject oversized responses while reading: an untrusted proxy must not force
  // allocation of an unbounded body before the Content-Length check.
  const reader=response.body?.getReader();
  if(!reader)throw {kind:'invalid'};
  let size=0;const chunks=[];
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;
    size+=value.byteLength;
    if(size>131072){await reader.cancel();throw {kind:'invalid'};}
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}
  catch{throw {kind:'invalid'};}
 }
 const live=(slot,run)=>run===epoch&&slot.isConnected;
 async function project(slot,run,signal){
  try{
   const grants=await read('/api/assistant/projects',signal);
   if(!live(slot,run))return;
   let allowed;try{allowed=homeProjectGrant(grants);}catch{throw {kind:'invalid'};}
   if(!allowed){status(slot,'no-grant','No project-evidence grant is available for this owner.');return;}
   const query=new URLSearchParams({workspaceId:'software',projectId:'devon-station',command:'/status'});
   const source=await read('/api/assistant/evidence?'+query,signal);
   if(!live(slot,run))return;
   let result;try{result=homeEvidenceSummary(source);}catch{throw {kind:'invalid'};}
   status(slot,'observed','GitHub source checked '+new Date(result.observedAt).toLocaleString()+'.');
   const context=result.pr?
    'Most recently updated open PR #'+result.pr.number+(result.pr.draft?' · draft':' · open')+
    ' · HEAD '+result.pr.headSha.slice(0,9):
    'No open PR was returned by the authorized GitHub source.';
   detail(slot,text('p',context,'he-record'));
   const checks={
    observed_pass:'Checks API: observed passing (not merge or release approval).',
    failed:'Checks API: failure observed.',pending:'Checks API: pending.',
    partial:'Checks API: partial or unverified.',none_observed:'No check runs observed.',
    unavailable:'Exact-head checks unavailable.'
   };
   detail(slot,text('p',checks[result.checkSummary],'he-fact'));
   detail(slot,text('p','Next: '+result.nextAction,'he-next'));
   if(result.unknownCount)detail(slot,text('p',result.unknownCount+' evidence gap(s) reported.','he-uncertainty'));
   detail(slot,text('p','Read-only repository evidence. Deployment and live operation are not verified.','he-uncertainty'));
   if(result.pr){
    const a=text('a','Inspect PR #'+result.pr.number);a.href='https://github.com/devonalanakins/devon-station/pull/'+result.pr.number;
    a.target='_blank';a.rel='noopener noreferrer';a.className='source-link';
    detail(slot,a);
   }
  }catch(error){if(live(slot,run)){const f=failure(error);if(f)status(slot,...f);}}
 }
 async function work(slot,run,signal){
  try{
   const config=await read('/api/ai-work/config',signal);
   if(!live(slot,run))return;
   let allowed;try{allowed=homeWorkGrants(config);}catch{throw {kind:'invalid'};}
   if(!allowed.size){status(slot,'no-grant','There are no authorized Work projects for this owner.');return;}
   const source=await read('/api/ai-work/jobs',signal);
   if(!live(slot,run))return;
   let summary;try{summary=homeWorkSummary(source,allowed);}catch{throw {kind:'invalid'};}
   status(slot,'observed','Owner-scoped Work records checked. '+(summary.partial?'First page only.':'No additional pages reported.'));
   detail(slot,text('p',summary.observedCount+' saved job plans shown · '+summary.review+' require review · '+summary.ready+' plans approved, execution locked.','he-record'));
   if(summary.executionRecords)detail(slot,text('p',summary.executionRecords+' records include provider phase metadata; outcomes remain unverified here.','he-fact'));
   detail(slot,text('p','Listing contains metadata only. No task prompts were retrieved, and no work was executed.','he-uncertainty'));
  }catch(error){if(live(slot,run)){const f=failure(error);if(f)status(slot,...f);}}
 }
 function refresh(root){
  active?.abort();const run=++epoch;active=new AbortController();
  const projectSlot=get(root,'he-project'),workSlot=get(root,'he-work');
  if(!projectSlot||!workSlot)return;
  for(const slot of [projectSlot,workSlot]){
   slot.dataset.state='loading';slot.setAttribute('aria-busy','true');
   slot.querySelector('.he-result').textContent='Checking authorized source…';
   slot.querySelector('.he-detail').replaceChildren();
  }
  const button=root.querySelector('[data-home-evidence-refresh]');
  if(button)button.disabled=true;
  void Promise.allSettled([project(projectSlot,run,active.signal),work(workSlot,run,active.signal)]).then(()=>{
   if(run===epoch&&root.isConnected&&button)button.disabled=false;
  });
 }
 function mounted(section){
  active?.abort();active=null;epoch++;
  if(section!=='home')return;
  const root=document.getElementById('station-home-evidence');if(!root)return;
  root.addEventListener('click',event=>{
   if(event.target.closest('[data-home-evidence-refresh]'))refresh(root);
  });
  refresh(root);
 }
 mounted(location.hash.slice(1)||'home');
 return Object.freeze({mounted});
})();
