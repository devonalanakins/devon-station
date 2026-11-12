export const AREAS=['Family & Home','Shinewell','Devon Works','Writing','ANEVUM','Incubator'];
export const SECTIONS=['home','today','command','workspace','inbox','portfolio','works','infrastructure','writing','anevum','reviews','settings','mail','aiwork'];
export const PIPELINE=['Capture','Classify','Scope','Prioritize','Design','Build','Test','Review','Release','Maintain','Archive'];
export const DEFAULTS={theme:'obsidian',accent:'cyan',density:'compact',motion:'system',contrast:'normal'};
export function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
export function safeURL(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch{return null;}}
export function settings(raw){const r={...DEFAULTS};for(const [key,opts] of Object.entries({theme:['obsidian','slate'],accent:['cyan','teal','violet'],density:['compact','comfortable'],motion:['system','reduced'],contrast:['normal','high']}))if(opts.includes(raw?.[key]))r[key]=raw[key];return r;}
export function filtered(items,{query='',area='All',status='All',type='All',priority='All'}={}){const q=query.trim().toLowerCase();return items.filter(x=>(area==='All'||x.area===area)&&(status==='All'||x.status===status)&&(type==='All'||x.type===type)&&(priority==='All'||x.priority===priority)&&(!q||[x.name,x.next,x.owner,x.source,...(x.dependencies instanceof Array?x.dependencies:[x.dependencies]),...(x.routes??[])].join(' ').toLowerCase().includes(q)));}
export function localDraftId(){return 'local:'+(typeof globalThis.crypto?.randomUUID==='function'?globalThis.crypto.randomUUID():Date.now().toString(36)+'-'+Math.random().toString(36).slice(2));}

/** An owner-selected civil planning date is not a confirmed external calendar event. */
export function planningDate(value){
 if(value===undefined||value===null||value==='')return null;
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('Choose a valid planning date.');
 const [year,month,day]=value.split('-').map(Number);
 if(year<2000||year>2199||month<1||month>12)throw Error('Choose a valid planning date.');
 const max=[31,((year%4===0&&year%100!==0)||year%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][month-1];
 if(day<1||day>max)throw Error('Choose a valid planning date.');
 return value;
}
export function localDay(now=new Date()){
 if(!(now instanceof Date)||!Number.isFinite(now.getTime()))throw Error('Invalid local day.');
 return String(now.getFullYear()).padStart(4,'0')+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
}
export function plannedCaptureGroups(captures,day){
 if(!planningDate(day))throw Error('A local day is required.');
 const active=(Array.isArray(captures)?captures:[]).filter(d=>d?.state!=='Archived');
 return {today:active.filter(d=>d.planDate===day),
  earlier:active.filter(d=>d.planDate&&d.planDate<day),
  later:active.filter(d=>d.planDate&&d.planDate>day),
  unscheduled:active.filter(d=>!d.planDate)};
}
/** Explicit portable ICS download, not automatic provider scheduling or sync. */
export function calendarFileForCapture(draft,stamp=new Date()){
 if(!draft||draft.state==='Archived'||!draft.planDate)throw Error('Select an active capture with a planning date.');
 const date=planningDate(draft.planDate),safe=captureDraft(draft,[],draft.createdAt,draft.id);
 if(!/^local:[a-zA-Z0-9-]{1,90}$/.test(draft.id)||!date||!(stamp instanceof Date)||
    !Number.isFinite(stamp.getTime())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(safe.title))
  throw Error('This capture cannot be exported as a calendar file.');
 const escICS=value=>String(value).replace(/\\/g,'\\\\').replace(/\r\n|\r|\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,');
 const [year,month,day]=date.split('-').map(Number);
 const next=new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
 const noDashes=value=>value.replaceAll('-','');
 const stampUTC=stamp.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//DevonStation//Owner Planning Export//EN',
  'CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+draft.id.slice(6).toLowerCase()+'@devonstation.local',
  'DTSTAMP:'+stampUTC,'DTSTART;VALUE=DATE:'+noDashes(date),'DTEND;VALUE=DATE:'+noDashes(next),
  'SUMMARY:'+escICS(safe.title),
  'DESCRIPTION:Owner planning reminder exported manually from DevonStation. Import into your calendar to save it there; no connection or confirmed appointment is implied.',
  'STATUS:TENTATIVE','TRANSP:TRANSPARENT','END:VEVENT','END:VCALENDAR'];
 const encoder=new TextEncoder();
 const fold=line=>{
  let result='',length=0;
  for(const character of line){
   const bytes=encoder.encode(character).length;
   if(length+bytes>75){result+='\r\n ';length=1;}
   result+=character;length+=bytes;
  }
  return result;
 };
 return lines.map(fold).join('\r\n')+'\r\n';
}

export function captureDraft(input,projects,now=new Date().toISOString(),id=localDraftId()){
 const title=String(input?.title??'').trim();if(title.length<2||title.length>500)throw Error('Write a title between 2 and 500 characters.');
 if(/\b(patient|diagnosis|medical record|social security number|ssn|password|bank account|credit card number)\b|(?:sk-|ghp_|github_pat_|xox[baprs]-)[a-zA-Z0-9_-]{10,}/i.test(title))throw Error('Keep clinical details, credentials and financial identifiers out of this console.');
 const area=AREAS.includes(input.area)?input.area:'Devon Works';const project=projects.find(p=>p.id===input.project&&p.area===area);
 const date=planningDate(input?.planDate);return {id,title,area,project:project?.id??null,destination:project?.source??null,state:'Draft',createdAt:now,...(date?{planDate:date}:{})};
}
export function addDraft(items,draft){const duplicate=items.find(x=>x.title.toLowerCase()===draft.title.toLowerCase()&&x.area===draft.area&&x.project===draft.project&&x.state!=='Archived');return {items:duplicate?items:[draft,...items].slice(0,200),duplicate:!!duplicate};}
export function updateDraft(items,id,input,projects){const original=items.find(x=>x.id===id);if(!original)throw Error('This local draft no longer exists.');const draft=captureDraft(input,projects,original.createdAt,id);const duplicate=addDraft(items.filter(x=>x.id!==id),draft).duplicate;if(duplicate)throw Error('Another local draft already contains that idea.');return items.map(x=>x.id===id?{...draft,state:original.state,updatedAt:new Date().toISOString()}:x);}
export const FEEDBACK_TYPES=['Design','Behavior','Feature','Bug'];
export function createFeedback(input,now=new Date().toISOString(),id=localDraftId()){const note=String(input?.note??'').trim();if(note.length<3||note.length>1200)throw Error('Write feedback between 3 and 1,200 characters.');if(/\b(?:patient|diagnosis|medical record|social security number|ssn|password|bank account|credit card number)\b|(?:sk-|ghp_|github_pat_|xox[baprs]-)[a-zA-Z0-9_-]{10,}/i.test(note))throw Error('Keep credentials out of feedback.');return {id,section:SECTIONS.includes(input.section)?input.section:'global',category:FEEDBACK_TYPES.includes(input.category)?input.category:'Design',note,state:'Open',createdAt:now};}
export function feedbackText(items){return items.map(x=>`[${x.category} · ${x.section} · ${x.state}] ${x.note}`).join('\n\n');}
// Focus marks are user-owned and must not be silently deleted merely because
// a read-only Notion project listing is empty, partial, or temporarily stale.
export function restoreLocal(raw,projects){if(raw?.version!==1)return {prefs:{...DEFAULTS},drafts:[],feedback:[],outcomes:[],history:[]};const drafts=[];for(const x of (Array.isArray(raw.drafts)?raw.drafts:[]).slice(0,200)){try{if(!/^local:[a-zA-Z0-9-]+$/.test(x.id)||!['Draft','Routed locally','Archived'].includes(x.state))continue;let safe=x;try{planningDate(x.planDate)}catch{safe={...x,planDate:null}}const d=captureDraft(safe,projects,x.createdAt,x.id);d.state=x.state;if(typeof x.updatedAt==='string'&&Number.isFinite(Date.parse(x.updatedAt)))d.updatedAt=x.updatedAt;drafts.push(d);}catch{}}const feedback=[];for(const x of (Array.isArray(raw.feedback)?raw.feedback:[]).slice(0,100)){try{if(!/^local:[a-zA-Z0-9-]+$/.test(x.id)||!['Open','Archived'].includes(x.state))continue;const f=createFeedback(x,x.createdAt,x.id);f.state=x.state;feedback.push(f);}catch{}}
 return {prefs:settings(raw.prefs),drafts,feedback,outcomes:Array.isArray(raw.outcomes)?[...new Set(raw.outcomes.filter(x=>typeof x==='string'&&/^[a-zA-Z0-9_-]{1,80}$/.test(x)))].slice(0,3):[],history:Array.isArray(raw.history)?raw.history.filter(x=>typeof x?.action==='string'&&typeof x?.at==='string').slice(0,30):[]};}
/** Tab-scoped pending changes are advisory until sanitized by restoreLocal. */
export function readTabRecoveryJournal(journal){
 if(!journal||typeof journal!=='object'||journal.version!==1||!journal.state||journal.state.version!==1)return null;
 if(!Array.isArray(journal.state.drafts)||!Array.isArray(journal.state.feedback)||
    !Array.isArray(journal.state.outcomes)||!Array.isArray(journal.state.history)||
    !journal.state.prefs||typeof journal.state.prefs!=='object')return null;
 try{if(JSON.stringify(journal).length>200000)return null}catch{return null}
 return journal.state;
}

/** Owner-selected focus is a local preference, not task completion or a calendar commitment. */
export function todayCaptures(local){
 const active=(Array.isArray(local?.drafts)?local.drafts:[]).filter(d=>d?.state!=='Archived'&&/^local:[a-zA-Z0-9-]+$/.test(d?.id));
 const focus=new Set(Array.isArray(local?.outcomes)?local.outcomes:[]);
 return {active,focused:active.filter(d=>focus.has(d.id.slice(6))).slice(0,3)};
}
/** A deliberate focus edit retains no stale references to archived or missing local drafts. */
export function changeTodayFocus(local,id){
 if(typeof id!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(id))throw Error('Invalid local focus target.');
 const active=new Set(todayCaptures(local).active.map(d=>d.id.slice(6)));
 if(!active.has(id))throw Error('Choose an active local capture.');
 const selected=[...new Set(Array.isArray(local?.outcomes)?local.outcomes:[])].filter(x=>active.has(x));
 if(selected.includes(id))return selected.filter(x=>x!==id);
 if(selected.length>=3)throw Error('Choose up to three focus items. Remove one before adding another.');
 return [...selected,id];
}

export function validateProject(p){const missing=['id','name','owner','area','next','gate','source'].filter(k=>!p?.[k]);if(missing.length)throw Error('Missing project fields: '+missing.join(', '));if(!AREAS.includes(p.area))throw Error('Unknown project area');if(!safeURL(p.source))throw Error('Source must be an HTTPS URL without credentials');if(p.repo&&!/^https:\/\/github\.com\/[^/]+\/[^/]+\/?$/.test(p.repo))throw Error('Repository must identify one GitHub repository');return true;}
