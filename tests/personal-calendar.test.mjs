import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {createStation} from '../worker/index.mjs';
import {personalCalendarAgenda} from '../src/personal-calendar-core.mjs';

const origin='https://station.example.test';
const owner={subject:'owner-pinned',email:'owner@example.test'};
const today=new Date().toISOString().slice(0,10);
const dayOffset=(d,n)=>{const x=new Date(d+'T12:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10);};
const token='TEST_ONLY_NONLIVE_CALENDAR_TOKEN_123';
const env=Object.freeze({
 APP_ORIGIN:origin,OWNER_EMAIL:owner.email,
 PERSONAL_CALENDAR_READ_ENABLED:'true',PERSONAL_CALENDAR_APPROVED:'true',
 PERSONAL_CALENDAR_OWNER_SUB:owner.subject,PERSONAL_CALENDAR_PROVIDER:'google',
 PERSONAL_CALENDAR_SCOPE:'personal',PERSONAL_CALENDAR_ID:'personal@example.test',
 PERSONAL_CALENDAR_APPROVED_ID:'personal@example.test',
 PERSONAL_CALENDAR_ACCESS_TOKEN:token
});
const payload={kind:'calendar#events',items:[
 {status:'confirmed',summary:'Private family <img src=x onerror=alert(1)>',
  start:{date:today},end:{date:dayOffset(today,1)},
  description:'NEVER_EXPOSE_DESCRIPTION',attendees:[{email:'NEVER_EXPOSE_ATTENDEE'}],
  htmlLink:'https://evil.example/foo',id:'SECRET_ID'},
 {status:'cancelled',summary:'Cancelled secret',
  start:{date:today},end:{date:dayOffset(today,1)}},
 {status:'tentative',summary:'Future private reminder',
  start:{dateTime:today+'T09:00:00-05:00'},end:{dateTime:today+'T09:30:00-05:00'}}
 ]};
const encoded=data=>new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json;charset=utf-8'}});
function fixture({subject=owner.subject,email=owner.email,body=payload,transportOverride}={}){
 const calls=[];const network=async(url,options)=>{
  calls.push({url,options});
  return transportOverride?transportOverride(url,options):encoded(body);
 };
 const app=createStation({},async()=>({subject,email}),network);
 const query=path=>new Request(origin+path);
 return {calls,app,query};
}
test('calendar defaults to denial before external transport, even for authenticated owner',async()=>{
 const {app,calls,query}=fixture();
 for(const missing of [
  {},{PERSONAL_CALENDAR_READ_ENABLED:'false'}, {PERSONAL_CALENDAR_APPROVED:'false'},
  {PERSONAL_CALENDAR_ACCESS_TOKEN:'short'}, {PERSONAL_CALENDAR_SCOPE:'professional'},
  {PERSONAL_CALENDAR_APPROVED_ID:'other@example.test'},
  {PERSONAL_CALENDAR_ID:'../../clinical'}, {PERSONAL_CALENDAR_PROVIDER:'custom'}
 ]){
  const r=await app.fetch(query('/api/calendar/personal?day='+today),
   {...env,...missing,...(Object.keys(missing).length?{}:{PERSONAL_CALENDAR_READ_ENABLED:'false'})},{});
  assert([403,503].includes(r.status),'invalid configuration must deny');
 }
 assert.equal(calls.length,0);
 const outsider=fixture({subject:'different-person'}),denied=await outsider.app.fetch(outsider.query('/api/calendar/personal?day='+today),env,{});
 assert.equal(denied.status,403);assert.equal(outsider.calls.length,0);
 const otherEmail=fixture({email:'other@example.test'});
 assert.equal((await otherEmail.app.fetch(otherEmail.query('/api/calendar/personal?day='+today),env,{})).status,403);
 assert.equal(otherEmail.calls.length,0);
});
test('calendar rejects invalid request shape and unbounded historical requests',async()=>{
 const {app,calls,query}=fixture();
 for(const path of [
  '/api/calendar/personal','/api/calendar/personal?day=2035-01-01',
  '/api/calendar/personal?day=2026-02-30',
  '/api/calendar/personal?day='+today+'&calendarId=clinical',
  '/api/calendar/personal?day='+today+'&day='+today,
  '/api/calendar/anything?day='+today
 ]){
  const r=await app.fetch(query(path),env,{});
  assert([400,404].includes(r.status),path+' returned '+r.status);
 }
 const post=new Request(origin+'/api/calendar/personal?day='+today,{
  method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:'{}'});
 assert.equal((await app.fetch(post,env,{})).status,405);
 assert.equal(calls.length,0);
});
test('approved calendar reads fixed Google GET and redacts all nonessential provider fields',async()=>{
 const {app,calls,query}=fixture();
 const r=await app.fetch(query('/api/calendar/personal?day='+today),env,{});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.mode,'read_only');assert.equal(body.scope,'personal');assert.equal(body.source,'google_calendar_personal');
 assert.equal(body.requestedDay,today);assert.equal(body.events.length,2);assert.equal(body.excluded,1);
 assert.equal(body.partial,true);
 assert.equal(body.events[0].title,'Private family <img src=x onerror=alert(1)>');
 const outbound=JSON.stringify(body);
 for(const s of [token,'NEVER_EXPOSE_DESCRIPTION','NEVER_EXPOSE_ATTENDEE','SECRET_ID','evil.example','Authorization'])
  assert(!outbound.includes(s),'non-display source leaked: '+s);
 assert.equal(calls.length,1);
 const target=new URL(calls[0].url);
 assert.equal(target.origin,'https://www.googleapis.com');
 assert.equal(target.pathname,'/calendar/v3/calendars/personal%40example.test/events');
 assert.equal(target.searchParams.get('singleEvents'),'true');
 assert.equal(target.searchParams.get('showDeleted'),'false');
 assert.equal(target.searchParams.get('maxResults'),'100');
 assert.equal(calls[0].options.method,'GET');assert.equal(calls[0].options.redirect,'manual');
 assert.equal(calls[0].options.headers.Authorization,'Bearer '+token);
 const agenda=personalCalendarAgenda(body,today);
 assert.equal(agenda.shown.length,2);
 assert(agenda.shown.some(e=>e.title.includes('<img')));
 assert.equal(agenda.partial,true);assert.equal(agenda.excluded,1);
});
test('provider redirect, HTML, unauthorized, malformed and oversized JSON fail closed',async()=>{
 const opts=[
  ()=>new Response('',{status:302,headers:{Location:'https://evil.example/steal'}}),
  ()=>new Response('<p>Unexpected</p>',{status:200,headers:{'Content-Type':'text/html'}}),
  ()=>new Response('not-json',{status:200,headers:{'Content-Type':'application/json'}}),
  ()=>new Response('denied',{status:401,headers:{'Content-Type':'application/json'}}),
  ()=>new Response('a'.repeat(196609),{status:200,headers:{'Content-Type':'application/json'}})
 ];
 for(const bad of opts){
  const {app,query}=fixture({transportOverride:bad});
  const r=await app.fetch(query('/api/calendar/personal?day='+today),env,{});
  assert.equal(r.status,503);
  assert.equal((await r.json()).error,'personal_calendar_provider_unavailable');
 }
 const {app,query}=fixture({body:{...payload,items:payload.items.slice(0,1),nextPageToken:'NEXT'}});
 const r=await app.fetch(query('/api/calendar/personal?day='+today),env,{});
 assert.equal(r.status,200);assert.equal((await r.json()).partial,true);
});
test('Today UI cannot store calendar data, execute actions or widen provider authority',()=>{
 const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
 const ui=read('src/personal-calendar-ui.js'),app=read('src/app.js'),build=read('tools/build-hosted-shell.mjs');
 assert.doesNotThrow(()=>new Script(ui));assert.doesNotThrow(()=>new Script(app));
 assert.match(ui,/credentials:'same-origin'/);assert.match(ui,/cache:'no-store'/);
 assert.match(ui,/redirect:'manual'/);assert.match(ui,/pending\?\.abort\(\)/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|XMLHttpRequest|sendBeacon|innerHTML|method:'POST'/);
 assert.match(app,/StationPersonalCalendar\?\.mounted\?\.\(section\)/);
 assert.match(app,/station-personal-calendar/);
 assert.match(build,/read\('src\/personal-calendar-core.mjs'\)/);
 assert.match(build,/read\('src\/personal-calendar-ui.js'\)/);
});
test('invalid local evidence is refused without cross-calendar inference',()=>{
 const data={source:'google_calendar_personal',scope:'personal',mode:'read_only',
  requestedDay:today,observedAt:new Date().toISOString(),partial:false,excluded:0,
  events:[{title:'Family time',start:{date:today},end:{date:dayOffset(today,1)},confirmation:'confirmed'}]};
 assert.equal(personalCalendarAgenda(data,today).shown.length,1);
 for(const change of [
  {scope:'professional'},{mode:'write'}, {source:'untrusted'},
  {requestedDay:dayOffset(today,-1)}, {excluded:-1},
  {events:[{...data.events[0],start:{date:'2026-02-30'}}]},
  {events:[{...data.events[0],start:{date:today},end:{date:'2024-01-01'}}]},
  {events:[{...data.events[0],title:'a'.repeat(181)}]}
 ])assert.throws(()=>personalCalendarAgenda({...data,...change},today),undefined,JSON.stringify(change).slice(0,55));
});
