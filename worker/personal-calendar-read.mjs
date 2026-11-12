/* Optional, owner-approved read-only personal calendar adapter.
 * Never treat an authenticated DevonStation session as a provider OAuth grant.
 * No token refresh, provider writes, cache or cross-calendar discovery. */
const fail=(publicCode,status)=>{throw {publicCode,status};};
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const ID=/^[A-Za-z0-9._@%+-]{1,180}$/;
const RFC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_BYTES=196608;
function dayDate(s){
 if(!DAY.test(s))return null;
 const x=new Date(s+'T00:00:00Z');
 return Number.isFinite(x.getTime())&&x.toISOString().slice(0,10)===s?x:null;
}
function eventDate(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
 if(Object.keys(raw).includes('date')&&Object.keys(raw).includes('dateTime'))return null;
 if(typeof raw.date==='string'&&dayDate(raw.date))return {date:raw.date};
 if(typeof raw.dateTime==='string'&&RFC.test(raw.dateTime)&&Number.isFinite(Date.parse(raw.dateTime)))
  return {dateTime:raw.dateTime};
 return null;
}
function eventFrom(item){
 if(!item||typeof item!=='object'||Array.isArray(item))return null;
 if(item.status==='cancelled')return null;
 const start=eventDate(item.start),end=eventDate(item.end);
 if(!start||!end||Boolean(start.date)!==Boolean(end.date))return null;
 const a=start.date?Date.parse(start.date+'T00:00:00Z'):Date.parse(start.dateTime);
 const b=end.date?Date.parse(end.date+'T00:00:00Z'):Date.parse(end.dateTime);
 if(!Number.isFinite(a)||!Number.isFinite(b)||b<=a||b-a>32*86400000)return null;
 if(item.summary!==undefined&&typeof item.summary!=='string')return null;
 const title=String(item.summary??'').replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,180)||'Untitled personal event';
 return {title,start,end,confirmation:item.status==='tentative'?'tentative':'confirmed'};
}
async function boundedJson(response){
 if(response.status!==200||!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')||
   Number(response.headers.get('Content-Length'))>MAX_BYTES)return null;
 const reader=response.body?.getReader();if(!reader)return null;
 const chunks=[];let size=0;
 try{
  while(true){
   const {done,value}=await reader.read();if(done)break;
   size+=value.byteLength;
   if(size>MAX_BYTES){await reader.cancel();return null;}
   chunks.push(value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let n=0;
 for(const part of chunks){bytes.set(part,n);n+=part.byteLength;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return null;}
}
export async function handlePersonalCalendarRead({request,url,user,env,transport=fetch,now=Date.now()}){
 if(url.pathname!=='/api/calendar/personal')fail('not_found',404);
 if(request.method!=='GET')fail('method_not_allowed',405);
 if(url.searchParams.size!==1||![...url.searchParams.keys()].every(x=>x==='day'))fail('invalid_calendar_request',400);
 const day=url.searchParams.get('day'),at=dayDate(day);
 if(!at||Math.abs(at.getTime()-now)>3*86400000)fail('invalid_calendar_day',400);
 if(env.PERSONAL_CALENDAR_READ_ENABLED!=='true'||env.PERSONAL_CALENDAR_APPROVED!=='true')
  fail('personal_calendar_not_configured',503);
 if(typeof env.PERSONAL_CALENDAR_OWNER_SUB!=='string'||user.subject!==env.PERSONAL_CALENDAR_OWNER_SUB)
  fail('personal_calendar_scope_denied',403);
 if(env.PERSONAL_CALENDAR_PROVIDER!=='google'||env.PERSONAL_CALENDAR_SCOPE!=='personal'||
    !ID.test(env.PERSONAL_CALENDAR_ID??'')||
    env.PERSONAL_CALENDAR_APPROVED_ID!==env.PERSONAL_CALENDAR_ID||
    typeof env.PERSONAL_CALENDAR_ACCESS_TOKEN!=='string'||
    !/^[^\s\u0000-\u001f\u007f]{10,4096}$/.test(env.PERSONAL_CALENDAR_ACCESS_TOKEN))
  fail('personal_calendar_configuration_unavailable',503);
 const min=new Date(at);min.setUTCDate(min.getUTCDate()-2);
 const max=new Date(at);max.setUTCDate(max.getUTCDate()+10);
 const target=new URL('https://www.googleapis.com/calendar/v3/calendars/'+
    encodeURIComponent(env.PERSONAL_CALENDAR_ID)+'/events');
 target.search=new URLSearchParams({
  singleEvents:'true',orderBy:'startTime',maxResults:'100',showDeleted:'false',
  timeMin:min.toISOString(),timeMax:max.toISOString()
 }).toString();
 let data;
 try{
  // Fixed destination, explicit single-calendar scope, no redirect or user-controlled URL.
  const response=await transport(target.toString(),{
   method:'GET',redirect:'manual',signal:AbortSignal.timeout(5000),
   headers:{Accept:'application/json',Authorization:'Bearer '+env.PERSONAL_CALENDAR_ACCESS_TOKEN}
  });
  data=await boundedJson(response);
 }catch{fail('personal_calendar_provider_unavailable',503);}
 if(!data||data.kind!=='calendar#events'||!Array.isArray(data.items)||data.items.length>100||
   data.nextPageToken!==undefined&&(typeof data.nextPageToken!=='string'||data.nextPageToken.length>1024))
  fail('personal_calendar_provider_unavailable',503);
 const events=[];let excluded=0;
 for(const item of data.items){
  const e=eventFrom(item);
  if(e)events.push(e);else excluded++;
 }
 return {source:'google_calendar_personal',scope:'personal',mode:'read_only',
  observedAt:new Date(now).toISOString(),requestedDay:day,events,
  partial:!!data.nextPageToken||excluded>0,excluded,
  limitations:['Single owner-approved personal calendar only.','Provider snapshot is not complete availability.',
   'Read-only; no calendar actions, writes or owner draft changes occurred.']};
}
