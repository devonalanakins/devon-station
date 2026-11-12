/* Explicit file selection grants read-only local preview. Never upload or persist event data. */
globalThis.StationCalendarPreview=(()=>{
 'use strict';
 let snapshot=null,fileLabel='',epoch=0,loading=false,error='';
 const root=()=>document.getElementById('station-calendar-import');
 function draw(){
  const node=root();if(!node)return;
  const status=node.querySelector('#calendar-import-status'),list=node.querySelector('#calendar-import-events');
  const clear=node.querySelector('#calendar-import-clear');
  list.replaceChildren();clear.hidden=!snapshot&&!loading&&!error;
  if(loading){status.textContent='Reading selected file locally…';return;}
  if(error){status.textContent=error;return;}
  if(!snapshot){
   status.textContent='No personal calendar file selected. No calendar commitments are connected.';
   return;
  }
  const skipped=snapshot.skipped;
  const omissions=skipped.recurrence+skipped.unsupported+skipped.cancelled;
  status.textContent='Read '+snapshot.events.length+' supported events from '+fileLabel+
   ' in this tab only. '+(omissions?omissions+' omitted (recurring '+skipped.recurrence+
   ', unsupported '+skipped.unsupported+', cancelled '+skipped.cancelled+'). ':'')+
   'This is a partial file snapshot, not live calendar availability.';
  const today=localDay(),agenda=calendarFileAgenda(snapshot,today,7);
  const heading=document.createElement('h4');
  heading.textContent='Events starting today or in the next 7 days';
  list.append(heading);
  if(!agenda.shown.length){
   const p=document.createElement('p');p.className='muted';
   p.textContent='No supported events in this file for the displayed window. Other calendars and recurring events are not checked.';
   list.append(p);
  }
  for(const item of agenda.shown){
   const article=document.createElement('article');article.className='calendar-import-event';
   const date=document.createElement('span');date.textContent=item.startDay===today?'Today':item.startDay;
   const title=document.createElement('strong');title.textContent=item.title;
   const time=document.createElement('small');time.textContent=item.label+(item.endDay?' · multi-day':'');
   article.append(date,title,time);list.append(article);
  }
  if(agenda.more){const p=document.createElement('p');p.className='muted';p.textContent='Additional events in this file are not shown in this compact preview.';list.append(p);}
 }
 async function receive(input){
  const file=input.files?.[0]??null;
  const run=++epoch;loading=false;error='';snapshot=null;fileLabel='';
  if(!file){draw();return;}
  if(!/\.ics$/i.test(file.name)||file.size>CALENDAR_IMPORT_MAX_BYTES||file.size===0){
   error='Choose a nonempty personal .ics file smaller than 256 KB. No events were imported.';draw();return;
  }
  loading=true;draw();
  try{
   const bytes=await file.arrayBuffer();if(bytes.byteLength>CALENDAR_IMPORT_MAX_BYTES)throw Error('Calendar file exceeds 256 KB.');
   const contents=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
   const parsed=parsePersonalIcs(contents);
   if(run!==epoch||!input.isConnected)return;
   snapshot=parsed;fileLabel=file.name.slice(0,120);
  }catch(ex){
   if(run!==epoch||!input.isConnected)return;
   error='Calendar preview rejected this file: '+String(ex?.message??'Invalid calendar data.');
  }finally{
   if(run===epoch&&input.isConnected){loading=false;input.value='';draw();}
  }
 }
 function mounted(section){
  epoch++;if(section!=='today')return;
  const node=root();if(!node)return;
  const input=node.querySelector('#calendar-import-file');
  input.addEventListener('change',()=>void receive(input));
  node.querySelector('#calendar-import-clear').addEventListener('click',()=>{
   epoch++;snapshot=null;fileLabel='';error='';loading=false;input.value='';draw();input.focus();
  });
  draw();
 }
 // The initial route renders before this module is appended to the hosted shell.
 mounted(location.hash.slice(1)||'home');
 return Object.freeze({mounted});
})();
