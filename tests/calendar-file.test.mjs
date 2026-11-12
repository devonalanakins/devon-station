import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Script} from 'node:vm';
import {parsePersonalIcs,calendarFileAgenda,CALENDAR_IMPORT_MAX_BYTES} from '../src/calendar-file-core.mjs';

const vc=body=>'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+body+'END:VCALENDAR\r\n';
const event=body=>'BEGIN:VEVENT\r\n'+body+'END:VEVENT\r\n';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('reads a selected valid iCalendar file into a bounded, explicitly partial snapshot',()=>{
 const source=vc(
  event('DTSTART;VALUE=DATE:20261112\r\nDTEND;VALUE=DATE:20261114\r\nSUMMARY:Family time\\, and planning\r\n')+
  event('DTSTART;TZID=America/New_York:20261112T090000\r\nDTEND;TZID=America/New_York:20261112T093000\r\nSUMMARY:School pickup\r\n')+
  event('DTSTART;VALUE=DATE:20261113\r\nSUMMARY:One day ahead\r\n')+
  event('DTSTART;VALUE=DATE:20261112\r\nRRULE:FREQ=DAILY;COUNT=5\r\nSUMMARY:Recurring omitted\r\n')+
  event('DTSTART;VALUE=DATE:20261112\r\nSTATUS:CANCELLED\r\nSUMMARY:Cancelled event\r\n')+
  event('DTSTART:bad-date\r\nSUMMARY:Unsupported date\r\n')
 );
 const snapshot=parsePersonalIcs(source);
 assert.equal(snapshot.sourceKind,'user-selected-file');
 assert.equal(snapshot.complete,false);
 assert.equal(snapshot.events.length,3);
 assert.deepEqual(snapshot.skipped,{recurrence:1,unsupported:1,cancelled:1});
 assert.equal(snapshot.events[0].title,'Family time, and planning');
 assert.equal(snapshot.events[0].endDay,'2026-11-14');
 assert.match(snapshot.events[1].label,/America\/New_York \(file time\)/);
 assert.equal(snapshot.events[1].startDay,'2026-11-12');
 const agenda=calendarFileAgenda(snapshot,'2026-11-12');
 assert.equal(agenda.today.length,2);
 assert.equal(agenda.upcoming.length,1);
 const tomorrow=calendarFileAgenda(snapshot,'2026-11-13',0);
 assert.equal(tomorrow.today.length,2); // multi-day and one-day event
 assert.equal(tomorrow.upcoming.length,0);
});
test('unfolds RFC-style lines and never renders untrusted markup as HTML in UI',()=>{
 const contents=vc(event('DTSTART;VALUE=DATE:20261112\r\nSUMMARY:<img src=x onerror=alert(1)>\r\n  plus a continuation\r\n'));
 const snapshot=parsePersonalIcs(contents);
 assert.equal(snapshot.events[0].title,'<img src=x onerror=alert(1)> plus a continuation');
 const ui=read('src/calendar-file-ui.js');
 assert.doesNotThrow(()=>new Script(ui));
 assert.match(ui,/title\.textContent=item\.title/);
 assert.doesNotMatch(ui,/innerHTML|insertAdjacentHTML/);
 assert.doesNotMatch(ui,/localStorage|sessionStorage|fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
 assert.match(ui,/new TextDecoder\('utf-8',\{fatal:true\}\)/);
 assert.match(ui,/mounted\(location\.hash\.slice\(1\)\|\|'home'\)/);
});
test('supports UTC timed events with explicit local conversion, rejects unknown date formats',()=>{
 const input=vc(
  event('DTSTART:20261112T153000Z\r\nSUMMARY:UTC meeting\r\n')+
  event('DTSTART;VALUE=DATE:20260229\r\nSUMMARY:Impossible leap date\r\n')+
  event('DTSTART;TZID=../../unsafe:20261112T090000\r\nSUMMARY:Bad TZID\r\n')
 );
 const snapshot=parsePersonalIcs(input);
 assert.equal(snapshot.events.length,1);
 assert.match(snapshot.events[0].label,/device local/);
 assert.equal(snapshot.skipped.unsupported,2);
});
test('recurring, modified and exceptions are omitted rather than falsely treated as complete',()=>{
 const contents=vc(
  event('DTSTART;VALUE=DATE:20261112\r\nRRULE:FREQ=WEEKLY\r\nSUMMARY:Repeat\r\n')+
  event('DTSTART;VALUE=DATE:20261112\r\nRECURRENCE-ID;VALUE=DATE:20261112\r\nSUMMARY:Override\r\n')+
  event('DTSTART;VALUE=DATE:20261112\r\nEXDATE;VALUE=DATE:20261115\r\nSUMMARY:Exception\r\n')
 );
 const snapshot=parsePersonalIcs(contents);
 assert.equal(snapshot.events.length,0);
 assert.equal(snapshot.skipped.recurrence,3);
 assert.equal(calendarFileAgenda(snapshot,'2026-11-12').totalInWindow,0);
});
test('refuses malformed roots, duplicate event fields and calendar escape attacks',()=>{
 const bad=[
  'BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261112\nEND:VEVENT\nEND:VCALENDAR',
  'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261112\nEND:VCALENDAR',
  vc(event('DTSTART;VALUE=DATE:20261112\r\nDTSTART;VALUE=DATE:20261113\r\nSUMMARY:Duplicate\r\n')),
  vc(event('DTSTART;VALUE=DATE:20261112\r\nSUMMARY:Bad\u0000data\r\n')),
  vc(event('DTSTART;VALUE=DATE:20261112\r\nSUMMARY:Fine\r\n'))+'BEGIN:VCALENDAR',
  vc('BEGIN:VALARM\r\nBEGIN:VEVENT\r\nDTSTART;VALUE=DATE:20261112\r\nEND:VEVENT\r\nEND:VALARM\r\n')
 ];
 for(const input of bad)assert.throws(()=>parsePersonalIcs(input),'Expected rejection');
 assert.throws(()=>parsePersonalIcs('X'.repeat(CALENDAR_IMPORT_MAX_BYTES+1)),/256 KB/);
 const large=vc(event('DTSTART;VALUE=DATE:20261112\r\nSUMMARY:Event\r\n').repeat(201));
 assert.throws(()=>parsePersonalIcs(large),/too many events/);
});
test('source-only calendar preview retains existing application and release boundaries',()=>{
 const app=read('src/app.js'),build=read('tools/build-hosted-shell.mjs');
 assert.match(app,/StationCalendarPreview\?\.mounted\?\.\(section\)/);
 assert.match(app,/id="station-calendar-import"/);
 assert.match(app,/No calendar service is connected/);
 assert.match(build,/read\('src\/calendar-file-core.mjs'\)/);
 assert.match(build,/read\('src\/calendar-file-ui.js'\)/);
 assert.doesNotThrow(()=>new Script(app));
});
