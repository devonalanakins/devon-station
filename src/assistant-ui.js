// Assistant Gen 2: deterministic, read-only project evidence. No model or execution adapter.
globalThis.StationAssistant=(()=>{
 const endpoint='/api/assistant/';
 const $id=(root,id)=>root.querySelector('#'+id);
 const put=(node,text)=>{node.textContent=String(text??'Unknown');return node;};
 const entry=(list,label,value,url)=>{
  const row=document.createElement('div');row.className='as-fact';
  const title=document.createElement('dt');put(title,label);row.append(title);
  const detail=document.createElement('dd');
  if(url&&/^https:\/\/github\.com\/devonalanakins\/devon-station\/(pull\/[0-9]+|commit\/[0-9a-f]{40}(\/checks)?|actions\/runs\/[1-9][0-9]*)$/.test(url)){
   const anchor=document.createElement('a');anchor.href=url;anchor.rel='noopener noreferrer';anchor.target='_blank';put(anchor,value);detail.append(anchor);
  }else put(detail,value);
  row.append(detail);list.append(row);
 };
 async function api(route){
  const response=await fetch(endpoint+route,{credentials:'same-origin',cache:'no-store',redirect:'manual'});
  if(response.status===401||response.type==='opaqueredirect'||response.redirected)throw Error('Owner sign-in is required.');
  if(response.status===403)throw Error('This project or workspace is not authorized.');
  if(response.status===503)throw Error('Read-only project evidence is not configured on this host.');
  if(!response.ok||!response.headers.get('Content-Type')?.includes('application/json'))
   throw Error('The source response could not be verified.');
  return response.json();
 }
 function evidence(root,data){
  const panel=$id(root,'as-evidence');panel.replaceChildren();
  const heading=document.createElement('h3');put(heading,'Source-backed result');panel.append(heading);
  const facts=document.createElement('dl');facts.className='as-facts';panel.append(facts);
  entry(facts,'Command',data.command||'Unknown');
  entry(facts,'Source',data.source==='github_public_repository_api'?'GitHub public repository API':'Unavailable');
  entry(facts,'Observed',data.observedAt&&Number.isFinite(Date.parse(data.observedAt))?new Date(data.observedAt).toLocaleString():'Unverified');
  entry(facts,'Main HEAD',data.main?.revision||'Unavailable',data.main?.url);
  const pr=data.selectedPullRequest;
  entry(facts,'Open PRs observed',data.openPullRequestsObserved===null?'Unavailable':data.openPullRequestsObserved);
  entry(facts,'Selected PR',pr?'#'+pr.number+' · '+(pr.draft?'Draft':'Open'):'Unavailable',pr?.url);
  if(pr)entry(facts,'PR HEAD',pr.headSha||'Unavailable');
  const ci=data.exactHeadCI;
  const labels={observed_pass:'Observed passing (not merge approval)',failed:'Failed',pending:'Pending',partial:'Partial / unverified',none_observed:'No checks observed',unavailable:'Unavailable'};
  entry(facts,'Exact-head Checks API',ci?((labels[ci.checkSummary]||'Unavailable')+
   (Number.isSafeInteger(ci.checkTotal)?' · '+ci.checkTotal+' reported':'')):'Unavailable',ci?.checksUrl);
  if(Array.isArray(ci?.checkRuns)&&ci.checkRuns.length){
   const count=Math.min(ci.checkRuns.length,5);
   entry(facts,'Checks observed',ci.checkRuns.slice(0,count).map(c=>
    c.name+': '+(c.status==='completed'?(c.conclusion||'unknown'):c.status)).join('; ')+
    (ci.checkRuns.length>count?' · +'+(ci.checkRuns.length-count)+' more':''),ci.checksUrl);
  }
  entry(facts,'Legacy commit statuses',ci?.legacyStatus==='none_reported'?'None reported':ci?.legacyStatus||'Unavailable');
  if(ci?.workflowRuns?.length){
   entry(facts,'Actions runs observed',ci.workflowRuns.map(r=>r.status+' / '+(r.conclusion||'pending')).join('; '));
  }else entry(facts,'Actions runs','None observed or inaccessible');
  const next=document.createElement('div');next.className='as-next';
  const lead=document.createElement('strong');put(lead,'One next action');next.append(lead);
  const p=document.createElement('p');put(p,data.nextAction||'Recheck authoritative source evidence.');next.append(p);panel.append(next);
  if(Array.isArray(data.unknowns)&&data.unknowns.length){
   const unknown=document.createElement('p');unknown.className='as-uncertainty';
   put(unknown,'Unverified: '+data.unknowns.join(', ').replaceAll('_',' '));panel.append(unknown);
  }
  const limit=document.createElement('p');limit.className='as-limitation';
  put(limit,'Read-only result. No task was executed, no model was billed, and no production deployment was verified.');panel.append(limit);
 }
 function mount(section){
  if(section!=='command')return;
  const view=document.getElementById('view');if(!view)return;
  let root=view.querySelector('#station-assistant');if(root?.dataset.ready==='1')return;
  if(!root){root=document.createElement('section');root.id='station-assistant';root.className='station-assistant';
   root.setAttribute('aria-label','Assistant project evidence');view.prepend(root);}
  root.dataset.ready='1';
  root.innerHTML='<div class="as-heading"><div><span class="eyebrow">PROJECT EVIDENCE · OWNER VIEW</span><h2>Know where things stand.</h2><p>Choose a project to review verified status, unknowns and its next step.</p></div><span class="as-mode">Read-only · No actions run</span></div>'+
   '<form id="as-form"><label for="as-project">Approved project</label><select id="as-project" required disabled><option value="">Loading permissions…</option></select>'+
   '<label for="as-command">Command</label><div class="as-compose"><input id="as-command" name="command" autocomplete="off" spellcheck="false" value="/status" maxlength="64" required aria-describedby="as-help"><button type="submit" class="primary" id="as-send" disabled>Inspect evidence</button></div>'+
   '<p class="tiny muted" id="as-help">Supported: /status or /continue. No code, messages, payments or deployments are sent.</p>'+
   '<div class="as-quick"><button type="button" data-assistant-command="/status" disabled>/status</button><button type="button" data-assistant-command="/continue" disabled>/continue</button></div></form>'+
   '<p id="as-status" class="as-status" role="status" aria-live="polite">Checking authorized projects…</p>'+
   '<p id="as-error" class="error" role="alert"></p><div id="as-evidence" class="as-evidence" aria-label="Evidence and provenance"></div>';
  const select=$id(root,'as-project'),send=$id(root,'as-send'),form=$id(root,'as-form'),
        status=$id(root,'as-status'),error=$id(root,'as-error'),details=$id(root,'as-evidence');
  let busy=false;
  const controls=enabled=>{select.disabled=!enabled;send.disabled=!enabled;
   root.querySelectorAll('[data-assistant-command]').forEach(b=>b.disabled=!enabled);};
  root.addEventListener('click',event=>{
   const b=event.target.closest('[data-assistant-command]');if(!b||busy||b.disabled)return;
   $id(root,'as-command').value=b.dataset.assistantCommand;form.requestSubmit();
  });
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(busy||!select.value)return;
   let command;
   try{command=parseAssistantCommand($id(root,'as-command').value).label;}
   catch{put(error,'Only /status and /continue are supported. Commands cannot authorize actions.');return;}
   busy=true;controls(false);root.setAttribute('aria-busy','true');
   put(error,'');details.replaceChildren();put(status,'Retrieving current GitHub evidence…');
   try{
    const params=new URLSearchParams({workspaceId:'software',projectId:select.value,command});
    const data=await api('evidence?'+params);
    if(!root.isConnected)return;
    if(data.readOnly!==true||data.projectId!==select.value||data.command!==command||data.workspaceId!=='software')
     throw Error('Evidence scope could not be verified.');
    evidence(root,data);put(status,'Source inspection complete. Execution not requested.');
   }catch(e){if(root.isConnected){put(status,'Evidence unavailable.');put(error,e.message==='Failed to fetch'?'Network unavailable. Try again when connected.':e.message);}}
   finally{busy=false;if(root.isConnected){root.setAttribute('aria-busy','false');controls(true);}}
  });
  (async()=>{
   try{
    const config=await api('projects');
    if(!root.isConnected)return;
    if(config.mode!=='read_only'||config.executionEnabled!==false||!Array.isArray(config.projects))throw Error('Project capability validation failed.');
    select.replaceChildren();
    for(const p of config.projects){
     if(p.workspaceId!=='software'||p.projectId!=='devon-station'||p.capability!=='read-evidence')continue;
     const option=document.createElement('option');option.value=p.projectId;put(option,p.name);select.append(option);
    }
    if(!select.options.length){put(status,'No authorized projects. Ask the owner to review the configured grants.');return;}
    controls(true);put(status,'Ready for a read-only source inspection.');
   }catch(e){if(root.isConnected){select.replaceChildren();put(status,'Assistant evidence unavailable.');put(error,e.message==='Failed to fetch'?'Network unavailable. Try again when connected.':e.message);}}
  })();
 }
 // App's initial render precedes this plugin's definition in the single hosted script.
 mount(location.hash.slice(1)||'command');
 return {mounted:mount};
})();
