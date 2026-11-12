/* Strict local projection of the owner's read-only personal calendar snapshot. */
const DAY=/^\d{4}-\d{2}-\d{2}$/;
const RFC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/;
const isoDay=s=>DAY.test(s)&&Number.isFinite(Date.parse(s+'T00:00:00Z'))&&
 new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;
const localDate=d=>String(d.getFullYear()).padStart(4,'0')+'-'+
 String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
export function personalCalendarAgenda(response,day,daysAhead=7){
 if(!isoDay(day)||!Number.isSafeInteger(daysAhead)||daysAhead<0||daysAhead>14||
  !response||response.source!=='google_calendar_personal'||response.scope!=='personal'||
  response.mode!=='read_only'||response.requestedDay!==day||
  !Number.isFinite(Date.parse(response.observedAt))||
  !Array.isArray(response.events)||response.events.length>100||
  typeof response.partial!=='boolean'||!Number.isSafeInteger(response.excluded)||
  response.excluded<0||response.excluded>100)throw Error('Unverified personal calendar response.');
 const limit=new Date(day+'T12:00:00Z');limit.setUTCDate(limit.getUTCDate()+daysAhead);
 const max=limit.toISOString().slice(0,10),out=[];
 for(const item of response.events){
  if(!item||typeof item.title!=='string'||item.title.length>180||
    !['confirmed','tentative'].includes(item.confirmation)||!item.start||!item.end)throw Error('Invalid calendar record.');
  let startDay,label,endDay=null;
  if(typeof item.start.date==='string'&&isoDay(item.start.date)&&
    typeof item.end.date==='string'&&isoDay(item.end.date)){
   startDay=item.start.date;endDay=item.end.date;
   if(endDay<=startDay)throw Error('Invalid event date window.');
   label='All day';
  }else if(typeof item.start.dateTime==='string'&&RFC.test(item.start.dateTime)&&
    typeof item.end.dateTime==='string'&&RFC.test(item.end.dateTime)){
   const start=new Date(item.start.dateTime),end=new Date(item.end.dateTime);
   if(!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||
      end.getTime()<=start.getTime())throw Error('Invalid timed event window.');
   startDay=localDate(start);
   label=start.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit'})+' · device local';
  }else throw Error('Mixed or unsupported event date.');
  if(startDay<=max&&(endDay?endDay>day:startDay>=day))out.push({
   title:item.title,startDay,endDay,label,confirmation:item.confirmation,
   spansMultipleDays:!!endDay&&Date.parse(endDay+'T00:00:00Z')-Date.parse(startDay+'T00:00:00Z')>86400000
  });
 }
 out.sort((a,b)=>a.startDay.localeCompare(b.startDay)||a.label.localeCompare(b.label)||a.title.localeCompare(b.title));
 return {shown:out.slice(0,12),totalInWindow:out.length,
  more:out.length>12||response.partial,partial:response.partial,
  observedAt:response.observedAt,excluded:response.excluded};
}
