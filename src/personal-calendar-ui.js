/* Deliberate, read-only personal calendar check. Never persist or transmit event content. */
globalThis.StationPersonalCalendar=(()=>{
 'use strict';
 let pending=null,epoch=0,result=null,error='';
 const host=()=>document.getElementById('station-personal-calendar');
 const make=(tag,content,cls)=>{
  const node=document.createElement(tag);node.textContent=String(content??'');
  if(cls)node.className=cls;return node;
 };
 function draw(){
  const root=host();if(!root)return;
  const list=root.querySelector('#personal-calendar-events');
  const status=root.querySelector('#personal-calendar-status');
  const clear=root.querySelector('[data-personal-calendar-clear]');
  list.replaceChildren();clear.hidden=!result&&!error;
  if(pending){status.textContent='Checking the approved personal calendar…';return;}
  if(error){status.textContent=error;return;}
  if(!result){status.textContent='No live personal calendar data loaded. Calendar-file preview remains separate.';return;}
  status.textContent='Personal calendar observed '+new Date(result.observedAt).toLocaleString()+
   '. Read-only snapshot; not proof of complete availability.';
  list.append(make('p',result.totalInWindow+' events in the preview window'+
   (result.partial?' · incomplete provider response':'')+'.','tiny muted'));
  if(result.excluded)list.append(make('p',result.excluded+' unsupported or cancelled provider entries omitted.','tiny muted'));
  if(!result.shown.length)list.append(make('p','No supported events shown. Other calendars and provider pages may contain additional commitments.','muted'));
  for(const event of result.shown){
   const node=document.createElement('article');node.className='calendar-live-event';
   node.append(make('span',event.startDay),make('strong',event.title),
    make('small',event.label+(event.spansMultipleDays?' · spans multiple days':'')+
     (event.confirmation==='tentative'?' · tentative':'')));
   list.append(node);
  }
  if(result.more)list.append(make('p','Additional or omitted events are not included in this short preview.','tiny muted'));
  list.append(make('p','From one owner-approved personal calendar. No calendar edit, invitation or job execution was performed.','tiny muted'));
 }
 function failure(response){
  if(response.status===401||response.type==='opaqueredirect'||response.redirected||
    response.status>=300&&response.status<400)return 'Sign in with the authorized owner identity before checking a calendar.';
  if(response.status===403)return 'This owner or personal calendar is not authorized.';
  if(response.status===503)return 'No approved personal calendar connection is available on this host.';
  return 'The personal calendar response could not be verified.';
 }
 async function boundedJson(response){
  if(!response.ok||!response.headers.get('Content-Type')?.toLowerCase().includes('application/json')||
    Number(response.headers.get('Content-Length'))>131072)throw Error('invalid');
  const reader=response.body?.getReader();if(!reader)throw Error('invalid');
  const chunks=[];let size=0;
  try{
   while(true){
    const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
    if(size>131072){await reader.cancel();throw Error('invalid');}
    chunks.push(value);
   }
  }finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;
  for(const part of chunks){bytes.set(part,offset);offset+=part.byteLength;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }
 async function check(){
  pending?.abort();const run=++epoch,controller=new AbortController();
  pending=controller;result=null;error='';draw();
  try{
   const day=localDay();
   const response=await fetch('/api/calendar/personal?day='+encodeURIComponent(day),{
    method:'GET',credentials:'same-origin',cache:'no-store',redirect:'manual',signal:controller.signal
   });
   if(run!==epoch)return;
   if(response.status!==200){error=failure(response);return;}
   const source=await boundedJson(response);
   if(run!==epoch)return;
   result=personalCalendarAgenda(source,day,7);
  }catch(e){
   if(run!==epoch||e?.name==='AbortError')return;
   error=e instanceof TypeError?'Network unavailable. The personal calendar was not checked.':
    'The calendar response was invalid or incomplete. Nothing is presented as current.';
  }finally{if(run===epoch){pending=null;draw();}}
 }
 function mounted(section){
  pending?.abort();pending=null;epoch++;result=null;error='';
  if(section!=='today')return;
  const root=host();if(!root)return;
  root.querySelector('[data-personal-calendar-check]').addEventListener('click',()=>{void check();});
  root.querySelector('[data-personal-calendar-clear]').addEventListener('click',()=>{
   pending?.abort();pending=null;epoch++;result=null;error='';draw();
  });
  draw();
 }
 mounted(location.hash.slice(1)||'home');
 return Object.freeze({mounted});
})();
