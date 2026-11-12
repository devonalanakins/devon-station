/* Read-only personal .ics file adapter. No network, persistent storage or provider authority. */
export const CALENDAR_IMPORT_MAX_BYTES=262144;
const MAX_EVENTS=200, MAX_LINES=6000;
const isDay=s=>{
 if(!/^\d{8}$/.test(s))return false;
 const y=+s.slice(0,4),m=+s.slice(4,6),d=+s.slice(6,8);
 if(y<2000||y>2199||m<1||m>12)return false;
 return d>=1&&d<=new Date(Date.UTC(y,m,0)).getUTCDate();
};
const dayFrom=s=>s.slice(0,4)+'-'+s.slice(4,6)+'-'+s.slice(6,8);
const dayOf=date=>String(date.getFullYear()).padStart(4,'0')+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0');
const timeFrom=s=>s.slice(9,11)+':'+s.slice(11,13);
function decodeSummary(value){
 const s=value.replace(/\\([nN,;\\])/g,(_,c)=>c==='n'||c==='N'?' ':c).trim();
 return s.slice(0,180)||'Untitled event in file';
}
function parseStart(raw){
 if(!raw)return null;
 const {head,value}=raw,parts=head.split(';'),normalized=parts.map(x=>x.toUpperCase());
 const tz=parts.slice(1).find(x=>x.toUpperCase().startsWith('TZID='))?.slice(5)||null;
 if(tz&&(tz.length>64||tz.includes('..')||!/^[A-Za-z_][A-Za-z0-9_.+\-]*(?:\/[A-Za-z_][A-Za-z0-9_.+\-]*){0,3}$/.test(tz)))return null;
 if((normalized.includes('VALUE=DATE')||/^\d{8}$/.test(value))&&isDay(value)){
  return {startDay:dayFrom(value),label:'All day',allDay:true,endDay:null};
 }
 const m=/^(\d{8})T(\d{2})(\d{2})(\d{2})(Z?)$/.exec(value);
 if(!m||!isDay(m[1])||+m[2]>23||+m[3]>59||+m[4]>59||normalized.includes('VALUE=DATE'))return null;
 if(m[5]==='Z'){
  if(tz)return null;
  const instant=new Date(Date.UTC(+m[1].slice(0,4),+m[1].slice(4,6)-1,+m[1].slice(6,8),+m[2],+m[3],+m[4]));
  if(!Number.isFinite(instant.getTime()))return null;
  return {startDay:dayOf(instant),label:instant.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+' · device local',allDay:false,endDay:null};
 }
 return {startDay:dayFrom(m[1]),label:timeFrom(value)+(tz?' · '+tz+' (file time)':' · calendar local time'),allDay:false,endDay:null};
}
function parseEvent(properties){
 if(properties.has('RRULE')||properties.has('RDATE')||properties.has('EXDATE')||properties.has('RECURRENCE-ID'))
  return {skipped:'recurrence'};
 if(properties.get('STATUS')?.value.toUpperCase()==='CANCELLED')return {skipped:'cancelled'};
 const start=parseStart(properties.get('DTSTART'));
 if(!start)return {skipped:'unsupported'};
 const rawEnd=properties.get('DTEND');
 if(start.allDay&&rawEnd){
  if(!isDay(rawEnd.value)||dayFrom(rawEnd.value)<=start.startDay)return {skipped:'unsupported'};
  const range=(Date.parse(dayFrom(rawEnd.value)+'T00:00:00Z')-Date.parse(start.startDay+'T00:00:00Z'))/86400000;
  if(range>31)return {skipped:'unsupported'};
  start.endDay=dayFrom(rawEnd.value); // exclusive
 }
 const title=decodeSummary(properties.get('SUMMARY')?.value??'');
 return {event:{title,...start}};
}
export function parsePersonalIcs(source){
 if(typeof source!=='string'||new TextEncoder().encode(source).length>CALENDAR_IMPORT_MAX_BYTES||
  source.includes('\0'))throw Error('Choose a UTF-8 calendar file of at most 256 KB.');
 const physical=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n').split('\n');
 if(physical.length>MAX_LINES)throw Error('Calendar file contains too many lines.');
 const lines=[];
 for(const line of physical){
  if(/^[ \t]/.test(line)){
   if(!lines.length)throw Error('Calendar file folding is invalid.');
   lines[lines.length-1]+=line.slice(1);
  }else lines.push(line);
 }
 const stack=[],events=[],skipped={recurrence:0,unsupported:0,cancelled:0};
 let seenRoot=false,seenVersion=false,eventCount=0,properties=null;
 for(const line of lines){
  if(!line)continue;
  const sep=line.indexOf(':');if(sep<=0)throw Error('Calendar file contains an invalid property.');
  const head=line.slice(0,sep),value=line.slice(sep+1),name=head.split(';')[0].toUpperCase();
  if(name==='BEGIN'){
   const kind=value.toUpperCase();
   if(!stack.length){if(kind!=='VCALENDAR'||seenRoot)throw Error('Expected a single calendar root.');seenRoot=true;}
   else if(kind==='VEVENT'){
    if(stack.length!==1||stack[0]!=='VCALENDAR')throw Error('Nested calendar events are unsupported.');
    if(++eventCount>MAX_EVENTS)throw Error('Calendar contains too many events for a private preview.');
    properties=new Map();
   }
   stack.push(kind);continue;
  }
  if(name==='END'){
   const kind=value.toUpperCase();
   if(stack.pop()!==kind)throw Error('Calendar structure is incomplete.');
   if(kind==='VEVENT'){
    const parsed=parseEvent(properties);
    if(parsed.event)events.push(parsed.event);else skipped[parsed.skipped]++;
    properties=null;
   }
   continue;
  }
  if(stack.length===1&&stack[0]==='VCALENDAR'&&name==='VERSION'){
   if(value!=='2.0')throw Error('Only iCalendar version 2.0 is supported.');
   seenVersion=true;
  }
  if(stack.at(-1)==='VEVENT'&&properties&&['SUMMARY','DTSTART','DTEND','RRULE','RDATE','EXDATE','RECURRENCE-ID','STATUS'].includes(name)){
   if(properties.has(name))throw Error('Calendar event contains duplicate fields.');
   properties.set(name,{head,value});
  }
 }
 if(!seenRoot||!seenVersion||stack.length||!source.includes('END:VCALENDAR'))throw Error('Calendar file is incomplete or not iCalendar 2.0.');
 return {events,skipped,sourceKind:'user-selected-file',complete:false};
}
export function calendarFileAgenda(snapshot,day,daysAhead=7){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isInteger(daysAhead)||daysAhead<0||daysAhead>14)
  throw Error('Invalid calendar preview window.');
 const end=new Date(day+'T12:00:00Z');if(!Number.isFinite(end.getTime()))throw Error('Invalid preview date');
 end.setUTCDate(end.getUTCDate()+daysAhead);
 const max=end.toISOString().slice(0,10);
 const list=(snapshot?.events??[]).filter(e=>
  e.startDay<=max&&(e.endDay?e.endDay>day:e.startDay>=day))
  .sort((a,b)=>a.startDay.localeCompare(b.startDay)||a.label.localeCompare(b.label)||a.title.localeCompare(b.title));
 return {today:list.filter(e=>e.startDay<=day&&(!e.endDay||e.endDay>day)),
  upcoming:list.filter(e=>e.startDay>day),totalInWindow:list.length,shown:list.slice(0,12),more:list.length>12};
}
