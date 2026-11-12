import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {captureDraft,updateDraft,restoreLocal,planningDate,localDay,plannedCaptureGroups,calendarFileForCapture} from '../src/core.mjs';
import {validateOwnerState} from '../worker/state.mjs';
import {reconcileOwnerStates} from '../src/sync-core.mjs';

const at='2026-11-12T13:20:00.000Z',id='local:11111111-1111-4111-8111-111111111111';
const draft=(title='Check family schedule',planDate='2026-12-31')=>captureDraft({title,area:'Family & Home',planDate},[],at,id);
const record=(items=[])=>({version:1,prefs:{},drafts:items,feedback:[],outcomes:[],history:[]});
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('civil planning dates validate leap days without UTC timezone assumptions',()=>{
 for(const date of ['2024-02-29','2026-11-12','2000-02-29','2199-12-31'])assert.equal(planningDate(date),date);
 for(const value of ['2026-02-29','2100-02-29','2026-04-31','2026-00-12','2026-13-01','1999-12-31','2200-01-01','2026-2-01','2026-01-1','2026-11-12\nBEGIN:VEVENT']){
  assert.throws(()=>planningDate(value),/valid planning date/);
 }
 assert.equal(planningDate(''),null);
 assert.equal(planningDate(null),null);
 assert.equal(localDay(new Date(2026,10,12,23,30,0)),'2026-11-12');
 assert.throws(()=>localDay(new Date('invalid')),/Invalid local day/);
});

test('owner capture date survives safe local restore, editing and server validation',()=>{
 const original=draft(),first=record([original]);
 assert.equal(original.planDate,'2026-12-31');
 assert.equal(validateOwnerState(first).drafts[0].planDate,'2026-12-31');
 assert.equal(restoreLocal(first,[]).drafts[0].planDate,'2026-12-31');
 const edited=updateDraft([original],id,{title:'Review schedule',area:'Family & Home',planDate:'2027-01-01'},[]);
 assert.equal(edited[0].planDate,'2027-01-01');
 const routed=[{...original,state:'Routed locally'}];
 assert.equal(updateDraft(routed,id,{title:'Check schedule again',area:'Family & Home',planDate:'2027-01-02'},[])[0].state,'Routed locally');
 const cleared=updateDraft(edited,id,{title:'Review schedule',area:'Family & Home',planDate:''},[]);
 assert.equal('planDate' in cleared[0],false);
 assert.equal(validateOwnerState(record(cleared)).drafts[0].planDate,undefined);
 const repaired=restoreLocal(record([{...original,planDate:'2026-02-30'}]),[]);
 assert.equal(repaired.drafts[0].title,original.title);
 assert.equal('planDate' in repaired.drafts[0],false);
 assert.throws(()=>validateOwnerState(record([{...original,planDate:'2026-02-30'}])),/invalid_planning_date/);
 assert.throws(()=>validateOwnerState(record([{...original,planDate:'2026-11-12\nPRIVATE'}])),/invalid_planning_date/);
 assert.equal('planDate' in validateOwnerState(record([captureDraft({title:'Legacy owner draft',area:'Devon Works'},[],at,'local:legacy-1')])).drafts[0],false);
});

test('same-ID concurrent date edits cause a reviewed conflict rather than silent loss',()=>{
 const old=record([draft()]),device=structuredClone(old),cloud=structuredClone(old);
 device.drafts[0].planDate='2026-12-30';cloud.drafts[0].planDate='2027-01-01';
 const conflict=reconcileOwnerStates(old,device,cloud);
 assert.equal(conflict.safe,false);
 assert.deepEqual(conflict.conflicts,['drafts:'+id]);
 assert.equal(conflict.state,null);
 assert.equal(reconcileOwnerStates(old,structuredClone(old),cloud).state.drafts[0].planDate,'2027-01-01');
});

test('Today categories exclude archived captures and do not claim calendar commitments',()=>{
 const first=draft('Today item','2026-11-12');
 const earlier=captureDraft({title:'Yesterday task',area:'Family & Home',planDate:'2026-11-11'},[],at,'local:older');
 const later=captureDraft({title:'Future task',area:'Family & Home',planDate:'2026-11-13'},[],at,'local:later');
 const undated=captureDraft({title:'Unscheduled task',area:'Family & Home'},[],at,'local:undated');
 const g=plannedCaptureGroups([first,earlier,later,undated,{...first,id:'local:archived',state:'Archived'}],'2026-11-12');
 assert.deepEqual([g.today.length,g.earlier.length,g.later.length,g.unscheduled.length],[1,1,1,1]);
});

test('ICS export is tentative, transparent, folded UTF-8 with correct all-day boundaries',()=>{
 const title='Review family schedule, then prepare notes; '+('学💠'.repeat(90))+'\nNo calendar sync';
 const d=draft(title,'2026-12-31'),contents=calendarFileForCapture(d,new Date(at));
 assert.match(contents,/BEGIN:VCALENDAR\r\nVERSION:2\.0\r\n/);
 assert.match(contents,/DTSTAMP:20261112T132000Z\r\n/);
 assert.match(contents,/DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101\r\n/);
 assert.match(contents,/UID:11111111-1111-4111-8111-111111111111@devonstation\.local/);
 assert.match(contents,/STATUS:TENTATIVE\r\nTRANSP:TRANSPARENT/);
 assert.match(contents,/SUMMARY:Review family schedule\\, then prepare notes\\;/);
 assert.match(contents,/\\nNo calendar sync/);
 assert.doesNotMatch(contents,/\nBEGIN:VEVENT\n/);
 for(const physical of contents.split('\r\n'))assert(new TextEncoder().encode(physical).length<=75,'Long ICS physical line: '+physical.length);
 assert.equal(contents.endsWith('\r\n'),true);
 assert.throws(()=>calendarFileForCapture({...d,planDate:''}),/planning date/);
 assert.throws(()=>calendarFileForCapture({...d,state:'Archived'}),/active capture/);
 assert.throws(()=>calendarFileForCapture({...d,title:'patient record details'}),/Keep clinical details/);
});

test('calendar file creation requires explicit action and no calendar network calls',()=>{
 const html=read('src/index.html'),app=read('src/app.js');
 assert.match(html,/id="capture-date" type="date"/);
 assert.match(app,/data-calendar-file/);
 assert.match(app,/calendarFileForCapture\(draft\)/);
 assert.match(app,/No calendar service is connected/);
 assert.match(app,/No calendar event was created automatically/);
 assert.doesNotMatch(app,/fetch\(['"]https:\/\/calendar|calendar\.events\.insert/);
 assert.doesNotThrow(()=>new Script(app));
});
